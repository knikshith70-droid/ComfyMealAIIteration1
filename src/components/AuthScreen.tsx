import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Logo, Wordmark } from "./Logo";
import { Leaf, Mail, Lock, Apple, Chrome, Loader2, AlertCircle } from "lucide-react";

type Mode = "signin" | "signup";

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<null | "email" | "google" | "apple">(null);
  const [error, setError] = useState<string | null>(null);

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter your email and a password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading("email");
    setError(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user && !data.session) {
          setError("Check your inbox to confirm your email — but note: email confirmation is OFF in this demo, so try signing in.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
    } finally {
      setLoading(null);
    }
  };

  const socialDemo = async (provider: "google" | "apple") => {
    setLoading(provider);
    setError(null);
    // Simulated social sign-in: use a fixed demo email with a random suffix so it
    // creates a fresh account the first time and signs in thereafter.
    const demoEmail =
      provider === "google"
        ? `fleximeal.google.demo+${hashEmail("google")}@gmail.com`
        : `fleximeal.apple.demo+${hashEmail("apple")}@icloud.com`;
    const demoPassword = "FlexiMealDemo2024!";
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });
      if (signInError) {
        // account doesn't exist yet — create it
        const { error: signUpError } = await supabase.auth.signUp({
          email: demoEmail,
          password: demoPassword,
        });
        if (signUpError) throw signUpError;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-5 flex items-center gap-2.5">
        <Logo />
        <Wordmark />
      </header>

      <main className="flex-1 flex items-center justify-center px-5 pb-16">
        <div className="w-full max-w-md animate-fade-up">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-sage-100 text-sage-700 mb-4">
              <Leaf className="h-7 w-7" />
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl text-charcoal-900 text-balance">
              {mode === "signup" ? "Plan meals that flex with you." : "Welcome back."}
            </h1>
            <p className="muted mt-3 text-balance">
              {mode === "signup"
                ? "Tell us your pantry, mood, and goals — get a recipe that actually fits today."
                : "Sign in to pick up where you left off."}
            </p>
          </div>

          <div className="card p-6 sm:p-7">
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button
                type="button"
                onClick={() => socialDemo("google")}
                disabled={loading !== null}
                className="btn-secondary"
              >
                {loading === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Chrome className="h-4 w-4" />}
                Google
              </button>
              <button
                type="button"
                onClick={() => socialDemo("apple")}
                disabled={loading !== null}
                className="btn-secondary"
              >
                {loading === "apple" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Apple className="h-4 w-4" />}
                Apple
              </button>
            </div>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center"><div className="w-full h-px bg-cream-300" /></div>
              <div className="relative flex justify-center"><span className="bg-cream-50 px-3 text-xs uppercase tracking-wider muted">or with email</span></div>
            </div>

            <form onSubmit={submitEmail} className="space-y-4">
              <div>
                <label className="label" htmlFor="email">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal-700/40" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="input pl-10"
                  />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="password">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal-700/40" />
                  <input
                    id="password"
                    type="password"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input pl-10"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 text-sm text-clay-700 bg-clay-50 border border-clay-200 rounded-xl px-3.5 py-3 animate-fade-in">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading !== null} className="btn-primary w-full">
                {loading === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {mode === "signup" ? "Create account" : "Sign in"}
              </button>
            </form>

            <p className="text-center text-sm muted mt-5">
              {mode === "signup" ? "Already have an account?" : "New to FlexiMeal?"}{" "}
              <button
                type="button"
                onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(null); }}
                className="font-medium text-sage-700 hover:text-sage-800 underline-offset-2 hover:underline"
              >
                {mode === "signup" ? "Sign in" : "Create one"}
              </button>
            </p>
          </div>

          <p className="text-center text-xs muted mt-5">
            Google &amp; Apple buttons use a shared demo account — no real OAuth needed.
          </p>
        </div>
      </main>
    </div>
  );
}

function hashEmail(provider: string) {
  // stable per-provider suffix so the same demo account is reused across sessions
  let h = 0;
  const s = `fleximeal-${provider}-demo`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36).slice(0, 6);
}
