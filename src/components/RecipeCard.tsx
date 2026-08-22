import { useState } from "react";
import type { PantryFlag, Profile, Recipe } from "../lib/supabase";
import { saveRecipe } from "../lib/api";
import {
  Bookmark, Check, Clock, Flame, Leaf, Loader2, Microwave, Soup, Utensils, Wind, AlertCircle,
} from "lucide-react";

export interface RecipeCardProps {
  recipe: Recipe;
  pantryFlags: PantryFlag[];
  useSoonNames: Set<string>;
  adjusting: string | null;
  onAdjust: (label: string, instruction: string) => void;
  profile: Profile;
}

const ADJUSTMENTS = [
  { label: "Make it vegetarian", instruction: "Make this recipe fully vegetarian (no meat, poultry, or fish). Keep the flavor profile and overall structure similar.", icon: <Leaf className="h-4 w-4" /> },
  { label: "Make it milder", instruction: "Make this recipe noticeably milder — reduce chili/heat and strong spices while keeping the dish recognizable.", icon: <Leaf className="h-4 w-4" /> },
  { label: "Make it spicier", instruction: "Make this recipe noticeably spicier — add heat via chili, hot sauce, or spices, while keeping the dish recognizable.", icon: <Flame className="h-4 w-4" /> },
  { label: "Turn into a soup", instruction: "Reimagine this dish as a soup — keep the core flavors but adapt it into a comforting bowl with broth.", icon: <Soup className="h-4 w-4" /> },
  { label: "Turn into a salad", instruction: "Reimagine this dish as a salad — keep the core flavors but make it a fresh, leaf- or grain-based salad.", icon: <Leaf className="h-4 w-4" /> },
  { label: "Air-fryer version", instruction: "Adapt this recipe for an air-fryer where it makes sense — adjust technique, time, and temperature accordingly.", icon: <Wind className="h-4 w-4" /> },
  { label: "Stovetop shortcut", instruction: "Give me a faster stovetop-only version of this recipe — fewer steps, less time, same core flavors.", icon: <Microwave className="h-4 w-4" /> },
];

export function RecipeCard({ recipe, pantryFlags, useSoonNames, adjusting, onAdjust, profile }: RecipeCardProps) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await saveRecipe(recipe);
      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save recipe.");
    } finally {
      setSaving(false);
    }
  };

  const useSoonList = pantryFlags.filter((p) => p.use_soon);

  return (
    <div className="card p-6 sm:p-8 animate-pop">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="min-w-0">
          <h2 className="font-serif text-2xl sm:text-3xl text-charcoal-900 text-balance">{recipe.title}</h2>
          {recipe.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {recipe.tags.slice(0, 6).map((tag, i) => (
                <span key={i} className="inline-flex items-center rounded-full bg-sage-100 text-sage-800 text-xs font-medium px-2.5 py-1">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || saved}
          className="btn-secondary shrink-0"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4 text-sage-700" /> : <Bookmark className="h-4 w-4" />}
          {saved ? "Saved" : "Save"}
        </button>
      </div>

      <p className="text-charcoal-700 mt-3 leading-relaxed">{recipe.description}</p>

      <div className="flex flex-wrap gap-4 mt-4 text-sm">
        <span className="inline-flex items-center gap-1.5 text-charcoal-700">
          <Clock className="h-4 w-4 text-sage-600" /> {recipe.time_minutes} min
        </span>
        <span className="inline-flex items-center gap-1.5 text-charcoal-700">
          <Utensils className="h-4 w-4 text-sage-600" /> Serves {recipe.servings}
        </span>
        <span className="inline-flex items-center gap-1.5 text-charcoal-700">
          <Leaf className="h-4 w-4 text-sage-600" /> {profile.lifestyle.length ? profile.lifestyle.join(", ") : "flexible"}
        </span>
      </div>

      {useSoonList.length > 0 && (
        <div className="mt-4 rounded-xl bg-clay-50 border border-clay-200 px-4 py-3 animate-fade-in">
          <div className="flex items-center gap-2 text-clay-700 text-sm font-medium mb-1">
            <Flame className="h-4 w-4" /> Use-soon items in this recipe
          </div>
          <p className="text-sm text-clay-700/90">
            {useSoonList.map((p) => p.name).join(", ")} — we prioritized these because they're near spoilage.
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <div>
          <h3 className="font-serif text-lg mb-3">Ingredients</h3>
          <ul className="space-y-2">
            {recipe.ingredients.map((ing, i) => {
              const isUseSoon = Array.from(useSoonNames).some((n) => ing.toLowerCase().includes(n.toLowerCase()));
              return (
                <li key={i} className="flex items-start gap-2.5 text-sm text-charcoal-700">
                  <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${isUseSoon ? "bg-clay-500" : "bg-sage-400"}`} />
                  <span className={isUseSoon ? "text-charcoal-900 font-medium" : ""}>{ing}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <h3 className="font-serif text-lg mb-3">Steps</h3>
          <ol className="space-y-3">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-charcoal-700">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-sage-100 text-sage-700 text-xs font-semibold shrink-0">
                  {i + 1}
                </span>
                <span className="leading-relaxed pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {saveError && (
        <div className="mt-4 flex items-start gap-2 text-sm text-clay-700 bg-clay-50 border border-clay-200 rounded-xl px-3.5 py-3">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      <div className="mt-7 pt-6 border-t border-cream-200">
        <h3 className="font-serif text-lg mb-1">One-tap micro-adjustments</h3>
        <p className="muted text-sm mb-4">Tweak the recipe without starting over.</p>
        <div className="flex flex-wrap gap-2">
          {ADJUSTMENTS.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => onAdjust(a.label, a.instruction)}
              disabled={adjusting !== null}
              className="chip chip-off"
            >
              {adjusting === a.label ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : a.icon}
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
