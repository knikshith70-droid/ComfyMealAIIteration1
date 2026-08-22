import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../lib/auth";
import {
  addPantryItem, adjustRecipe, deletePantryItem, fetchLatestSession, fetchPantry,
  generateRecipe, saveSession,
} from "../lib/api";
import type { FlexSession, PantryItem, Profile } from "../lib/supabase";
import { Logo, Wordmark } from "./Logo";
import { RecipeCard } from "./RecipeCard";
import {
  AlertCircle, Clock, CookingPot, Flame, Loader2, Plus, Refrigerator, Sparkles, Trash2,
  Utensils, Zap, History, Leaf,
} from "lucide-react";

type StockLevel = "empty" | "average" | "full";
type CookCapacity = "quick" | "standard" | "proper";
type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "meal_prep";

interface FlexState {
  stock_level: StockLevel;
  cook_capacity: CookCapacity;
  meal_type: MealType;
  comfort_score: number;
}

const DEFAULT_FLEX: FlexState = {
  stock_level: "average",
  cook_capacity: "standard",
  meal_type: "dinner",
  comfort_score: 50,
};

export function FlexEngine({ profile }: { profile: Profile }) {
  const { user } = useAuth();
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [pantryDraft, setPantryDraft] = useState("");
  const [flex, setFlex] = useState<FlexState>(DEFAULT_FLEX);
  const [lastSession, setLastSession] = useState<FlexSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [recipe, setRecipe] = useState<RecipeCardProps["recipe"] | null>(null);
  const [pantryFlags, setPantryFlags] = useState<RecipeCardProps["pantryFlags"]>([]);
  const [adjusting, setAdjusting] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [items, last] = await Promise.all([fetchPantry(), fetchLatestSession()]);
        if (!mounted) return;
        setPantry(items);
        setLastSession(last);
        if (last) {
          setFlex({
            stock_level: last.stock_level as StockLevel,
            cook_capacity: last.cook_capacity as CookCapacity,
            meal_type: last.meal_type as MealType,
            comfort_score: last.comfort_score,
          });
        }
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "Failed to load your session.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const useSoonNames = useMemo(() => new Set(pantryFlags.filter((p) => p.use_soon).map((p) => p.name)), [pantryFlags]);

  const addPantry = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = pantryDraft.trim();
    if (!v) return;
    try {
      const item = await addPantryItem(v);
      setPantry((prev) => [item, ...prev]);
      setPantryDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add pantry item.");
    }
  };

  const removePantry = async (id: string) => {
    try {
      await deletePantryItem(id);
      setPantry((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove pantry item.");
    }
  };

  const sameAsYesterday = () => {
    if (!lastSession) return;
    setFlex({
      stock_level: lastSession.stock_level as StockLevel,
      cook_capacity: lastSession.cook_capacity as CookCapacity,
      meal_type: lastSession.meal_type as MealType,
      comfort_score: lastSession.comfort_score,
    });
  };

  const generate = async () => {
    setGenerating(true);
    setError(null);
    setRecipe(null);
    setPantryFlags([]);
    try {
      const res = await generateRecipe({
        profile,
        pantry,
        flex: { ...flex, comfort_score: flex.comfort_score },
      });
      setRecipe(res.recipe);
      setPantryFlags(res.pantry_flags);
      await saveSession({
        stock_level: flex.stock_level,
        cook_capacity: flex.cook_capacity,
        meal_type: flex.meal_type,
        comfort_score: flex.comfort_score,
        pantry_snapshot: pantry.map((p) => p.name),
      });
      const last = await fetchLatestSession();
      setLastSession(last);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recipe generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const adjust = async (label: string, instruction: string) => {
    if (!recipe) return;
    setAdjusting(label);
    setError(null);
    try {
      const res = await adjustRecipe({
        profile,
        pantry,
        flex,
        adjustment: instruction,
        previousRecipe: recipe,
      });
      setRecipe(res.recipe);
      setPantryFlags(res.pantry_flags);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Adjustment failed.");
    } finally {
      setAdjusting(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-sage-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-5 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-10 bg-cream-50/85 backdrop-blur-md border-b border-cream-200/60">
        <div className="flex items-center gap-2.5">
          <Logo className="h-8 w-8" />
          <Wordmark className="text-lg" />
        </div>
        <div className="text-sm muted hidden sm:block">
          Hi, {user?.email?.split("@")[0] ?? "chef"} 👋
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-8 py-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <h1 className="font-serif text-3xl sm:text-4xl text-charcoal-900 text-balance">Today's Flex Engine</h1>
            <p className="muted mt-2 text-balance">Tell us what's in your kitchen and how you're feeling — we'll do the rest.</p>
          </div>

          {lastSession && (
            <button
              type="button"
              onClick={sameAsYesterday}
              className="mb-5 inline-flex items-center gap-2 rounded-full bg-sage-100 text-sage-800 px-4 py-2 text-sm font-medium hover:bg-sage-200 transition active:scale-[0.98] animate-fade-in"
            >
              <History className="h-4 w-4" /> Same as yesterday?
            </button>
          )}

          <div className="grid lg:grid-cols-2 gap-5">
            {/* Pantry */}
            <section className="card p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-1">
                <Refrigerator className="h-5 w-5 text-sage-700" />
                <h2 className="font-serif text-xl">Pantry items</h2>
              </div>
              <p className="muted text-sm mb-4">Add what you've got. We'll flag use-soon items automatically.</p>

              <form onSubmit={addPantry} className="flex gap-2 mb-4">
                <input
                  value={pantryDraft}
                  onChange={(e) => setPantryDraft(e.target.value)}
                  placeholder="e.g. chicken, spinach, rice…"
                  className="input"
                />
                <button type="submit" disabled={!pantryDraft.trim()} className="btn-primary shrink-0">
                  <Plus className="h-4 w-4" /> Add
                </button>
              </form>

              {pantry.length === 0 ? (
                <p className="muted text-sm italic">Your pantry is empty. Add a few ingredients to get a tailored recipe.</p>
              ) : (
                <ul className="space-y-2 max-h-64 overflow-y-auto no-scrollbar pr-1">
                  {pantry.map((item) => {
                    const flag = pantryFlags.find((p) => p.name === item.name);
                    const useSoon = flag?.use_soon;
                    return (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-cream-100/70 border border-cream-200/70 px-3.5 py-2.5 animate-fade-in"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-charcoal-900 capitalize truncate">{item.name}</div>
                          <div className="text-xs muted">
                            added {timeAgo(item.logged_at)}
                            {flag?.shelf_life_days != null && (
                              <span className="ml-2">· shelf life {flag.shelf_life_days}d</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {useSoon && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-clay-700 bg-clay-50 border border-clay-200 rounded-full px-2.5 py-1">
                              <Flame className="h-3 w-3" /> Use soon
                              {flag?.days_left != null && flag.days_left >= 0 && ` · ${flag.days_left}d`}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => removePantry(item.id)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-full text-charcoal-700/50 hover:text-clay-700 hover:bg-clay-50 transition"
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Context controls */}
            <section className="card p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <CookingPot className="h-5 w-5 text-sage-700" />
                <h2 className="font-serif text-xl">Today's context</h2>
              </div>

              <div className="space-y-5">
                <Field label="Kitchen stock level">
                  <Segmented
                    options={[
                      { value: "empty", label: "Empty", icon: <Refrigerator className="h-4 w-4" /> },
                      { value: "average", label: "Average", icon: <Leaf className="h-4 w-4" /> },
                      { value: "full", label: "Fully stocked", icon: <Utensils className="h-4 w-4" /> },
                    ]}
                    value={flex.stock_level}
                    onChange={(v) => setFlex({ ...flex, stock_level: v as StockLevel })}
                  />
                </Field>

                <Field label="Cook capacity">
                  <Segmented
                    options={[
                      { value: "quick", label: "Quick & Easy", icon: <Zap className="h-4 w-4" /> },
                      { value: "standard", label: "Standard", icon: <Clock className="h-4 w-4" /> },
                      { value: "proper", label: "Cook properly", icon: <CookingPot className="h-4 w-4" /> },
                    ]}
                    value={flex.cook_capacity}
                    onChange={(v) => setFlex({ ...flex, cook_capacity: v as CookCapacity })}
                  />
                </Field>

                <Field label="Meal type">
                  <Segmented
                    options={[
                      { value: "breakfast", label: "Breakfast", icon: <Utensils className="h-4 w-4" /> },
                      { value: "lunch", label: "Lunch", icon: <Utensils className="h-4 w-4" /> },
                      { value: "dinner", label: "Dinner", icon: <Utensils className="h-4 w-4" /> },
                      { value: "snack", label: "Snack", icon: <Utensils className="h-4 w-4" /> },
                      { value: "meal_prep", label: "Meal prep", icon: <Utensils className="h-4 w-4" /> },
                    ]}
                    value={flex.meal_type}
                    onChange={(v) => setFlex({ ...flex, meal_type: v as MealType })}
                  />
                </Field>

                <Field label={`Comfort ↔ Adventurous · ${flex.comfort_score}`}>
                  <div className="pt-1">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={flex.comfort_score}
                      onChange={(e) => setFlex({ ...flex, comfort_score: Number(e.target.value) })}
                      className="w-full accent-sage-600"
                    />
                    <div className="flex justify-between text-xs muted mt-1">
                      <span>Comfort food</span>
                      <span>Balanced</span>
                      <span>Adventurous</span>
                    </div>
                  </div>
                </Field>
              </div>
            </section>
          </div>

          {error && (
            <div className="mt-5 flex items-start gap-2 text-sm text-clay-700 bg-clay-50 border border-clay-200 rounded-xl px-3.5 py-3">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={generate}
              disabled={generating}
              className="btn-clay text-base px-7 py-3.5"
            >
              {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              {generating ? "Cooking up ideas…" : "Generate my recipe"}
            </button>
          </div>

          {recipe && (
            <div className="mt-8">
              <RecipeCard
                recipe={recipe}
                pantryFlags={pantryFlags}
                useSoonNames={useSoonNames}
                adjusting={adjusting}
                onAdjust={adjust}
                profile={profile}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      {children}
    </div>
  );
}

function Segmented({
  options, value, onChange,
}: {
  options: { value: string; label: string; icon?: React.ReactNode }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`chip ${on ? "chip-on" : "chip-off"}`}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// Imported here to keep the type shared with RecipeCard
import type { RecipeCardProps } from "./RecipeCard";
