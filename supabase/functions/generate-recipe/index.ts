import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Shelf-life reference table (in days). Keys are lowercased ingredient names.
// Anything within SHELF_LIFE_WARNING_DAYS of estimated spoilage is flagged "use-soon".
const SHELF_LIFE_DAYS: Record<string, number> = {
  // proteins
  chicken: 2, turkey: 2, beef: 3, pork: 3, fish: 2, salmon: 2, tuna: 2, shrimp: 2, bacon: 7, sausage: 7, tofu: 5, tempeh: 5, eggs: 21,
  // dairy
  milk: 5, yogurt: 7, cheese: 14, feta: 7, mozzarella: 7, parmesan: 30, cream: 7, butter: 14, sourcream: 10, cottagecheese: 7,
  // leafy greens
  spinach: 5, lettuce: 5, arugula: 5, kale: 7, salad: 5, mixedgreens: 5, swisschard: 5, collardgreens: 5,
  // vegetables
  tomato: 7, tomatoes: 7, cucumber: 7, zucchini: 7, bellpepper: 7, pepper: 7, mushrooms: 5, mushroom: 5, avocado: 5, broccoli: 7, cauliflower: 7, asparagus: 5, greenbeans: 7, beans: 7, corn: 5, eggplant: 7, okra: 4, basil: 5, cilantro: 7, parsley: 7, mint: 7, scallions: 7, greenonion: 7, springonion: 7,
  // root + firm veg
  carrot: 30, carrots: 30, potato: 30, potatoes: 30, onion: 30, onions: 30, garlic: 60, ginger: 21, sweetpotato: 30, beets: 21, beet: 21, radish: 14, radishes: 14, turnip: 21, parsnip: 21, leek: 14, leeks: 14, shallot: 30, celery: 14,
  // fruits
  banana: 5, bananas: 5, apple: 14, apples: 14, pear: 7, pears: 7, strawberry: 3, strawberries: 3, blueberry: 7, blueberries: 7, raspberry: 3, raspberries: 3, blackberry: 3, blackberries: 3, grape: 7, grapes: 7, orange: 14, lemon: 21, lime: 21, mango: 5, pineapple: 5, peach: 4, peaches: 4, plum: 5, plums: 5, watermelon: 7, melon: 7, kiwi: 7, avocado: 5,
  // breads / baked
  bread: 5, baguette: 3, tortilla: 7, pita: 5, naan: 5, buns: 5, bagel: 5, croissant: 3,
  // herbs / other
  scallion: 7, chili: 7, jalapeno: 7, habanero: 7,
  "chili pepper": 7, "green onion": 7, "spring onion": 7, "bell pepper": 7, "sweet potato": 30, "cottage cheese": 7, "sour cream": 10, "mixed greens": 5, "swiss chard": 5, "collard greens": 5, "green beans": 7, "tree nuts": 180,
};

const SHELF_LIFE_WARNING_DAYS = 2;

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

interface PantryItem {
  name: string;
  logged_at: string;
}

interface Profile {
  allergies: string[];
  lifestyle: string[];
  cuisines: string[];
  adults: number;
  children: number;
  goals: string[];
}

interface FlexContext {
  stock_level: string;
  cook_capacity: string;
  meal_type: string;
  comfort_score: number;
}

interface RequestBody {
  action: "generate" | "adjust";
  profile: Profile;
  pantry: PantryItem[];
  flex: FlexContext;
  adjustment?: string;
  previousRecipe?: {
    title: string;
    description: string;
    time_minutes: number;
    servings: number;
    ingredients: string[];
    steps: string[];
    tags: string[];
  };
}

function normalizeIngredient(name: string): string {
  return name.trim().toLowerCase().replace(/s$/, "");
}

function lookupShelfLife(name: string): number | null {
  const n = name.trim().toLowerCase();
  if (SHELF_LIFE_DAYS[n] != null) return SHELF_LIFE_DAYS[n];
  const singular = n.replace(/s$/, "");
  if (SHELF_LIFE_DAYS[singular] != null) return SHELF_LIFE_DAYS[singular];
  for (const key of Object.keys(SHELF_LIFE_DAYS)) {
    if (n.includes(key) || key.includes(n)) return SHELF_LIFE_DAYS[key];
  }
  return null;
}

function flagUseSoon(pantry: PantryItem[]) {
  const now = Date.now();
  return pantry.map((item) => {
    const logged = new Date(item.logged_at).getTime();
    const ageDays = Math.max(0, (now - logged) / (1000 * 60 * 60 * 24));
    const shelfLife = lookupShelfLife(item.name);
    if (shelfLife == null) {
      return { ...item, use_soon: false, days_left: null, shelf_life_days: null };
    }
    const daysLeft = Math.round(shelfLife - ageDays);
    return {
      ...item,
      use_soon: daysLeft <= SHELF_LIFE_WARNING_DAYS,
      days_left: daysLeft,
      shelf_life_days: shelfLife,
    };
  });
}

function buildPrompt(body: RequestBody, flaggedPantry: ReturnType<typeof flagUseSoon>) {
  const { profile, flex, adjustment, previousRecipe, action } = body;

  const useSoonItems = flaggedPantry.filter((p) => p.use_soon).map((p) => p.name);
  const pantryNames = body.pantry.map((p) => p.name);

  const capacityLabel =
    flex.cook_capacity === "quick" ? "Quick & Easy (under 25 minutes, minimal cleanup)" :
    flex.cook_capacity === "proper" ? "Cook properly today (no time limit, from-scratch techniques welcome)" :
    "Standard (30-45 minutes, balanced effort)";

  const comfortLabel =
    flex.comfort_score <= 33 ? "comfort food / familiar flavors" :
    flex.comfort_score >= 67 ? "adventurous / try something new and bold" :
    "balanced between comfort and adventure";

  const stockLabel =
    flex.stock_level === "empty" ? "pantry is mostly empty — use staples and a few fresh items" :
    flex.stock_level === "full" ? "kitchen is fully stocked — assume common pantry staples (oil, salt, spices, flour, rice, pasta) are available" :
    "kitchen is averagely stocked — assume basic staples are available";

  const servings = Math.max(1, (profile.adults || 1) + Math.max(0, Math.round((profile.children || 0) * 0.6)));

  let system = `You are FlexiMeal AI, a creative but practical meal-planning sous-chef. You generate recipes that respect the user's dietary profile, pantry, and current context. You ALWAYS respond with strict JSON and nothing else.`;

  let user = `Generate a ${flex.meal_type} recipe.

USER PROFILE:
- Allergies / exclusions: ${profile.allergies.length ? profile.allergies.join(", ") : "none"}
- Dietary lifestyle: ${profile.lifestyle.length ? profile.lifestyle.join(", ") : "none specified"}
- Preferred cuisines: ${profile.cuisines.length ? profile.cuisines.join(", ") : "no preference"}
- Household: ${profile.adults} adults, ${profile.children} children
- Servings to target: ${servings}
- Goals that matter to them: ${profile.goals.length ? profile.goals.join(", ") : "none specified"}

CURRENT CONTEXT:
- Kitchen stock level: ${stockLabel}
- Cook capacity today: ${capacityLabel}
- Comfort-to-adventurous slider: ${flex.comfort_score}/100 → ${comfortLabel}

PANTRY ITEMS (use these as the starting point; you may add common staples):
${pantryNames.length ? pantryNames.join(", ") : "(pantry is empty — suggest a recipe that needs only common staples)"}

${useSoonItems.length ? `USE-SOON ITEMS (prioritize using these — they are near spoilage): ${useSoonItems.join(", ")}` : ""}

REQUIREMENTS:
1. Respect every allergy/exclusion strictly — never include those ingredients.
2. Honor the dietary lifestyle (vegan/vegetarian/keto/etc.) — do not violate it.
3. Lean toward the preferred cuisines when possible.
4. Match the cook capacity and meal type realistically.
5. Target the servings count above.
6. If use-soon items are listed, build the recipe around them.
7. Keep ingredients realistic and commonly available.

Respond with STRICT JSON in this exact shape (no markdown, no commentary):
{
  "title": "string — recipe name",
  "description": "string — 1-2 sentence appetizing summary",
  "time_minutes": number,
  "servings": number,
  "ingredients": ["string", ...],
  "steps": ["string", ...],
  "tags": ["string", ...]
}`;

  if (action === "adjust" && adjustment && previousRecipe) {
    system += ` When adjusting, keep the same JSON shape. Apply the requested change while staying within the user's dietary constraints.`;
    user = `Here is a recipe the user just received:
${JSON.stringify(previousRecipe, null, 2)}

Apply this micro-adjustment: "${adjustment}"

Keep the user's profile and pantry context in mind:
- Allergies: ${profile.allergies.join(", ") || "none"}
- Lifestyle: ${profile.lifestyle.join(", ") || "none"}
- Pantry: ${pantryNames.join(", ") || "empty"}

Return the FULL adjusted recipe as STRICT JSON with the same shape (title, description, time_minutes, servings, ingredients, steps, tags). Do not include any markdown or commentary.`;
  }

  return { system, user };
}

async function callGroq(system: string, user: string) {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured on the server.");
  }

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.85,
      max_tokens: 1400,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Groq API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Groq returned an empty response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    // try to extract JSON object from text
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Could not parse JSON from Groq response.");
    parsed = JSON.parse(match[0]);
  }

  if (typeof parsed !== "object" || parsed === null || !("title" in parsed)) {
    throw new Error("Groq response did not contain a valid recipe object.");
  }
  return parsed;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;

    if (!body || !body.profile || !body.flex || !Array.isArray(body.pantry)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: profile, flex, pantry." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const flaggedPantry = flagUseSoon(body.pantry);
    const { system, user } = buildPrompt(body, flaggedPantry);
    const recipe = await callGroq(system, user);

    return new Response(
      JSON.stringify({ recipe, pantry_flags: flaggedPantry }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown server error.";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
