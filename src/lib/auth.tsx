import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { fetchProfile, upsertProfile } from "./api";
import type { Profile } from "./supabase";

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  ensureProfileRow: (userId: string) => Promise<Profile>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (u: User) => {
    try {
      const p = await fetchProfile(u.id);
      setProfile(p);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to load profile", e);
      setProfile(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const s = data.session;
      setUser(s?.user ?? null);
      if (s?.user) {
        loadProfile(s.user).finally(() => mounted && setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      (async () => {
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
          await loadProfile(u);
        } else {
          setProfile(null);
        }
      })();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user);
  };

  const ensureProfileRow = async (userId: string): Promise<Profile> => {
    const existing = await fetchProfile(userId);
    if (existing) {
      setProfile(existing);
      return existing;
    }
    const created = await upsertProfile({
      id: userId,
      allergies: [],
      lifestyle: [],
      cuisines: [],
      adults: 1,
      children: 0,
      goals: [],
      onboarded: false,
    });
    setProfile(created);
    return created;
  };

  const value = useMemo<AuthState>(
    () => ({ user, profile, loading, signOut, refreshProfile, ensureProfileRow }),
    [user, profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
