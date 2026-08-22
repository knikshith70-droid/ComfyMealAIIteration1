import { supabase } from "./supabase";
import type { FlexSession, PantryItem, Profile, Recipe, PantryFlag } from "./supabase";

const DEMO_MODE = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function upsertProfile(profile: Profile): Promise<Profile> {
  const { data, error } = await supabase.from("profiles").upsert(profile).select().single();
  if (error) throw error;
  return data as Profile;
}

export async function fetchOptions(category: string) {
  const { data, error } = await supabase.from("custom_options").select("id, category, value, created_by, created_at").eq("category", category).order("value", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addCustomOption(category: string, value: string) {
  const { data, error } = await supabase.from("custom_options").insert({ category, value: value.trim().toLowerCase() }).select("id, category, value, created_by, created_at").maybeSingle();
  if (error && error.code !== "23505") throw error;
  return data;
}

export async function fetchPantry(): Promise<PantryItem[]> {
  const { data, error } = await supabase.from("pantry_items").select("*").order("logged_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PantryItem[];
}

export async function addPantryItem(name: string): Promise<PantryItem> {
  const { data, error } = await supabase.from("pantry_items").insert({ name: name.trim() }).select().single();
  if (error) throw error;
  return data as PantryItem;
}

export async function deletePantryItem(id: string) {
  const { error } = await supabase.from("pantry_items").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchLatestSession(): Promise<FlexSession | null> {
  const { data, error } = await supabase.from("flex_sessions").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data as FlexSession | null;
}

export async function saveSession(session: Omit<FlexSession, "id" | "user_id" | "created_at">) {
  const { error } = await supabase.from("flex_sessions").insert(session);
  if (error) throw error;
}

export async function saveRecipe(recipe: Recipe) {
  const { error } = await supabase.from("saved_recipes").insert({ title: recipe.title, description: recipe.description, time_minutes: recipe.time_minutes, servings: recipe.servings, ingredients: recipe.ingredients, steps: recipe.steps, tags: recipe.tags });
  if (error) throw error;
}

export async function fetchSavedRecipes() {
  const { data, error } = await supabase.from("saved_recipes").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface GenerateResponse {
  recipe: Recipe;
  pantry_flags: PantryFlag[];
}

export async function generateRecipe(payload: { profile: Profile; pantry: PantryItem[]; flex: { stock_level: string; cook_capacity: string; meal_type: string; comfort_score: number } }): Promise<GenerateResponse> {
  if (DEMO_MODE) return demoGenerate(payload.pantry, payload.flex);
  return callEdgeFunction<GenerateResponse>("generate-recipe", payload);
}

export async function adjustRecipe(payload: { profile: Profile; pantry: PantryItem[]; flex: { stock_level: string; cook_capacity: string; meal_type: string; comfort_score: number }; adjustment: string; previousRecipe: Recipe }): Promise<GenerateResponse> {
  if (DEMO_MODE) {
    return {
      recipe: { ...payload.previousRecipe, description: `${payload.previousRecipe.description} Updated for: ${payload.adjustment}.` },
      pantry_flags: [],
    };
  }
  return callEdgeFunction<GenerateResponse>("generate-recipe", { ...payload, action: "adjust" });
}

function demoGenerate(pantry: PantryItem[], flex: { meal_type: string; cook_capacity: string }): GenerateResponse {
  const names = pantry.map((p) => p.name).join(", ") || "rice, vegetables and basic pantry staples";
  return {
    recipe: {
      title: flex.meal_type === "breakfast" ? "Comforting Vegetable Rice Bowl" : "Quick Spiced Chicken & Vegetable Rice",
      description: `A ${flex.cook_capacity} ${flex.meal_type} built around what you already have: ${names}.`,
      time_minutes: flex.cook_capacity === "quick" ? 15 : 25,
      servings: 3,
      ingredients: ["1 cup rice", "200 g chicken or paneer", "1 cup mixed vegetables", "1 tsp cooking oil", "1/2 tsp chilli powder", "Salt to taste"],
      steps: ["Prepare the rice and set aside.", "Cook the protein with oil and spices.", "Add vegetables and cook until tender.", "Combine with rice, adjust seasoning, and serve warm."],
      tags: ["Pantry-first", "Quick", "Family-friendly"],
    },
    pantry_flags: pantry.slice(0, 2).map((p) => ({ name: p.name, logged_at: p.logged_at, use_soon: false, days_left: null, shelf_life_days: null })),
  };
}

async function callEdgeFunction<T>(name: string, body: unknown): Promise<T> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` }, body: JSON.stringify(body) });
  const text = await res.text();
  let json: unknown;
  try { json = JSON.parse(text); } catch { throw new Error(`Server returned a non-JSON response (status ${res.status}).`); }
  if (!res.ok) {
    const message = json && typeof json === "object" && "error" in json && typeof (json as { error: unknown }).error === "string" ? (json as { error: string }).error : `Request failed (${res.status}).`;
    throw new Error(message);
  }
  return json as T;
}
