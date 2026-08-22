import { useState } from "react";
import { useAuth } from "../lib/auth";
import { upsertProfile } from "../lib/api";
import type { Profile } from "../lib/supabase";
import { ChipSelector } from "./ChipSelector";
import { Logo, Wordmark } from "./Logo";
import {
  AlertCircle, ChevronLeft, ChevronRight, Loader2, Minus, Plus, Salad, Globe, Users, Target,
} from "lucide-react";

const TOTAL = 5;

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { user, profile, ensureProfileRow } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base: Profile = profile ?? {
    id: user?.id ?? "",
    allergies: [],
    lifestyle: [],
    cuisines: [],
    adults: 1,
    children: 0,
    goals: [],
    onboarded: false,
  };

  const [draft, setDraft] = useState<Profile>(base);

  const next = () => setStep((s) => Math.min(TOTAL - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const finish = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!user) throw new Error("Not signed in.");
      const row = await ensureProfileRow(user.id);
      await upsertProfile({ ...draft, id: row.id, onboarded: true });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Logo className="h-8 w-8" />
          <Wordmark className="text-lg" />
        </div>
        <div className="text-sm muted">Step {step + 1} of {TOTAL}</div>
      </header>

      <div className="px-6">
        <div className="max-w-2xl mx-auto">
          <div className="h-1.5 w-full rounded-full bg-cream-200 overflow-hidden">
            <div
              className="h-full bg-sage-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${((step + 1) / TOTAL) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <main className="flex-1 flex items-start sm:items-center justify-center px-5 py-8">
        <div className="w-full max-w-2xl">
          <div key={step} className="animate-fade-up">
            {step === 0 && (
              <Step
                icon={<AlertCircle className="h-6 w-6" />}
                title="Any food allergies or exclusions?"
                subtitle="We'll never include these in your recipes. Pick all that apply."
              >
                <ChipSelector
                  category="allergy"
                  selected={draft.allergies}
                  onChange={(allergies) => setDraft({ ...draft, allergies })}
                  color="clay"
                  placeholder="e.g. corn"
                />
              </Step>
            )}

            {step === 1 && (
              <Step
                icon={<Salad className="h-6 w-6" />}
                title="What's your dietary lifestyle?"
                subtitle="This shapes every recipe we suggest."
              >
                <ChipSelector
                  category="lifestyle"
                  selected={draft.lifestyle}
                  onChange={(lifestyle) => setDraft({ ...draft, lifestyle })}
                />
              </Step>
            )}

            {step === 2 && (
              <Step
                icon={<Globe className="h-6 w-6" />}
                title="Which cuisines do you love?"
                subtitle="We'll lean toward these when we can. Pick as many as you like."
              >
                <ChipSelector
                  category="cuisine"
                  selected={draft.cuisines}
                  onChange={(cuisines) => setDraft({ ...draft, cuisines })}
                />
              </Step>
            )}

            {step === 3 && (
              <Step
                icon={<Users className="h-6 w-6" />}
                title="How big is your household?"
                subtitle="We'll scale recipe servings to match."
              >
                <div className="grid sm:grid-cols-2 gap-4">
                  <Counter
                    label="Adults"
                    value={draft.adults}
                    onChange={(adults) => setDraft({ ...draft, adults: Math.max(0, adults) })}
                    min={0}
                  />
                  <Counter
                    label="Children"
                    value={draft.children}
                    onChange={(children) => setDraft({ ...draft, children: Math.max(0, children) })}
                    min={0}
                  />
                </div>
                <p className="muted text-sm mt-4">
                  Total servings target: <span className="font-medium text-charcoal-900">{Math.max(1, draft.adults + Math.round(draft.children * 0.6))}</span>
                </p>
              </Step>
            )}

            {step === 4 && (
              <Step
                icon={<Target className="h-6 w-6" />}
                title="What matters most in meal planning?"
                subtitle="Pick all the goals you care about — we'll optimize for them."
              >
                <ChipSelector
                  category="goal"
                  selected={draft.goals}
                  onChange={(goals) => setDraft({ ...draft, goals })}
                />
              </Step>
            )}
          </div>

          {error && (
            <div className="mt-5 flex items-start gap-2 text-sm text-clay-700 bg-clay-50 border border-clay-200 rounded-xl px-3.5 py-3">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between mt-8">
            <button
              type="button"
              onClick={back}
              disabled={step === 0 || saving}
              className="btn-ghost"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            {step < TOTAL - 1 ? (
              <button type="button" onClick={next} className="btn-primary">
                Continue <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" onClick={finish} disabled={saving} className="btn-primary">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Start cooking
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Step({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-sage-100 text-sage-700 mb-4">
        {icon}
      </div>
      <h2 className="section-title text-balance">{title}</h2>
      <p className="muted mt-2 mb-6 text-balance">{subtitle}</p>
      <div>{children}</div>
    </div>
  );
}

function Counter({ label, value, onChange, min = 0 }: { label: string; value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <div className="card p-4 flex items-center justify-between">
      <div>
        <div className="text-sm muted">{label}</div>
        <div className="font-serif text-2xl text-charcoal-900">{value}</div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
          className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-cream-100 hover:bg-cream-200 text-charcoal-700 disabled:opacity-40 active:scale-95 transition"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-sage-600 hover:bg-sage-700 text-cream-50 active:scale-95 transition"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
