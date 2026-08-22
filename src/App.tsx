import { AuthProvider, useAuth } from "./lib/auth";
import { AuthScreen } from "./components/AuthScreen";
import { Onboarding } from "./components/Onboarding";
import { FlexEngine } from "./components/FlexEngine";
import { Logo } from "./components/Logo";
import { Loader2 } from "lucide-react";

function Shell() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Logo className="h-12 w-12 animate-pulse" />
        <div className="flex items-center gap-2 muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading FlexiMeal…
        </div>
      </div>
    );
  }

  if (!user) return <AuthScreen />;
  if (!profile || !profile.onboarded) return <Onboarding onDone={() => {}} />;
  return <FlexEngine profile={profile} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
