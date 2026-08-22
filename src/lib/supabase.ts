import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn("Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
}

export const supabase = createClient(url ?? "", anonKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type OptionCategory = "allergy" | "lifestyle" | "cuisine" | "goal";

export interface CustomOption {
  id: string;
  category: OptionCategory;
  value: string;
  created_by: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  allergies: string[];
  lifestyle: string[];
  cuisines: string[];
  adults: number;
  children: number;
  goals: string[];
  onboarded: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PantryItem {
  id: string;
  user_id: string;
  name: string;
  logged_at: string;
  created_at?: string;
}

export interface FlexSession {
  id: string;
  user_id: string;
  stock_level: string;
  cook_capacity: string;
  meal_type: string;
  comfort_score: number;
  pantry_snapshot: string[];
  created_at: string;
}

export interface Recipe {
  title: string;
  description: string;
  time_minutes: number;
  servings: number;
  ingredients: string[];
  steps: string[];
  tags: string[];
}

export interface SavedRecipe extends Recipe {
  id: string;
  user_id: string;
  created_at: string;
}

export interface PantryFlag {
  name: string;
  logged_at: string;
  use_soon: boolean;
  days_left: number | null;
  shelf_life_days: number | null;
}
