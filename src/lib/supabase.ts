import { createClient, type User } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Frontend-only demo mode: when Supabase credentials are unavailable, the UI
// runs entirely against in-memory mock data. Production behavior is unchanged.
const DEMO_MODE = !url || !anonKey;

const demoUser = {
  id: "demo-user-001",
  email: "demo@comfymeal.ai",
  app_metadata: {},
  user_metadata: { name: "Demo Chef" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
} as User;

const demoProfile: Profile = {
  id: demoUser.id,
  allergies: [],
  lifestyle: [],
  cuisines: [],
  adults: 1,
  children: 0,
  goals: [],
  onboarded: false,
};

let demoPantry: PantryItem[] = [
  { id: "p1", user_id: demoUser.id, name: "rice", logged_at: new Date().toISOString() },
  { id: "p2", user_id: demoUser.id, name: "chicken", logged_at: new Date().toISOString() },
  { id: "p3", user_id: demoUser.id, name: "spinach", logged_at: new Date().toISOString() },
];
let demoSessions: FlexSession[] = [];
let demoSavedRecipes: SavedRecipe[] = [];

function demoResult(data: unknown, error: unknown = null) {
  return Promise.resolve({ data, error });
}

function demoQuery(table: string) {
  let rows: any[] = table === "profiles" ? [demoProfile] : table === "pantry_items" ? demoPantry : table === "flex_sessions" ? demoSessions : table === "saved_recipes" ? demoSavedRecipes : [];
  let filtered = [...rows];

  const chain: any = {
    select: () => chain,
    order: (_column: string, _opts?: unknown) => chain,
    eq: (column: string, value: unknown) => {
      filtered = filtered.filter((r) => r[column] === value);
      if (table === "pantry_items" && column === "id") {
        demoPantry = demoPantry.filter((r) => r.id !== value);
      }
      return chain;
    },
    limit: (n: number) => {
      filtered = filtered.slice(0, n);
      return chain;
    },
    maybeSingle: () => demoResult(filtered[0] ?? null),
    single: () => demoResult(filtered[0] ?? null),
    insert: (value: any) => {
      const values = Array.isArray(value) ? value : [value];
      const created = values.map((v) => ({
        id: v.id ?? crypto.randomUUID(),
        user_id: v.user_id ?? demoUser.id,
        logged_at: v.logged_at ?? new Date().toISOString(),
        created_at: v.created_at ?? new Date().toISOString(),
        ...v,
      }));
      if (table === "pantry_items") demoPantry = [...created, ...demoPantry];
      if (table === "flex_sessions") demoSessions = [...created, ...demoSessions];
      if (table === "saved_recipes") demoSavedRecipes = [...created, ...demoSavedRecipes];
      filtered = created;
      return chain;
    },
    upsert: (value: any) => {
      if (table === "profiles") Object.assign(demoProfile, value);
      filtered = [demoProfile];
      return chain;
    },
    delete: () => chain,
  };

  return chain;
}

const mockSupabase: any = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: { user: demoUser } }, error: null }),
    onAuthStateChange: (callback: (event: string, session: any) => void) => {
      queueMicrotask(() => callback("SIGNED_IN", { user: demoUser }));
      return { data: { subscription: { unsubscribe: () => undefined } } };
    },
    signOut: () => Promise.resolve({ error: null }),
  },
  from: (table: string) => demoQuery(table),
};

export const supabase = DEMO_MODE
  ? mockSupabase
  : createClient(url!, anonKey!, {
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
