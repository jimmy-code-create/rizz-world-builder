import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AuthCard } from "@/components/AuthCard";
import { CustomEmoji } from "@/components/CustomEmoji";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getPostAuthPath } from "@/lib/onboarding";
import { TUTORIAL_INTERESTS } from "@/lib/emoji.js";
import { toast } from "sonner";

export const Route = createFileRoute("/tutorial")({
  component: TutorialPage,
  head: () => ({ meta: [{ title: "Your interests · RIZZ" }] }),
});

function TutorialPage() {
  const { user, profile, loading, profileError, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hasEntered = useRef(false);
  const markedThisVisit = useRef(false);

  useEffect(() => {
    if (loading || profileError) return;
    if (!user) {
      nav({ to: "/" });
      return;
    }
    if (!profile) {
      nav({ to: "/claim" });
      return;
    }
    if (!profile.username) {
      nav({ to: "/claim" });
      return;
    }
    if (profile.tutorial_seen && !hasEntered.current) {
      nav({ to: "/feed" });
      return;
    }
    if (!profile.tutorial_seen && !hasEntered.current) {
      hasEntered.current = true;
      setSelected(profile.interests ?? []);
      if (!markedThisVisit.current) {
        markedThisVisit.current = true;
        void supabase
          .from("profiles")
          .update({ tutorial_seen: true })
          .eq("id", user.id)
          .then(({ error: updateError }) => {
            if (updateError) setError(updateError.message);
            else void refreshProfile();
          });
      }
    }
  }, [loading, profileError, user, profile, nav, refreshProfile]);

  const finish = async (interests: string[]) => {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ tutorial_seen: true, interests })
        .eq("id", user.id);
      if (updateError) throw updateError;
      await refreshProfile();
      toast.success("You're all set.");
      nav({ to: "/feed" });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Couldn't save your interests.");
    } finally {
      setBusy(false);
    }
  };

  const toggleInterest = (interest: string) => {
    setSelected((current) =>
      current.includes(interest)
        ? current.filter((item) => item !== interest)
        : [...current, interest],
    );
  };

  if (loading || !user) {
    return <div className="min-h-dvh flex items-center justify-center"><div className="h-12 w-12 rounded-full bg-gradient-primary animate-pulse-glow" /></div>;
  }

  if (profileError || !profile) {
    return (
      <AuthCard title="Find your people" subtitle={profileError ?? "We couldn't load your account yet."}>
        <Button className="w-full" variant="outline" onClick={() => void refreshProfile()}>Retry</Button>
      </AuthCard>
    );
  }

  if (!profile.username) {
    return <div className="min-h-dvh flex items-center justify-center"><div className="h-12 w-12 rounded-full bg-gradient-primary animate-pulse-glow" /></div>;
  }

  if (profile.tutorial_seen && !hasEntered.current) {
    return <div className="min-h-dvh flex items-center justify-center"><div className="h-12 w-12 rounded-full bg-gradient-primary animate-pulse-glow" /></div>;
  }

  return (
    <AuthCard title="Find your people" subtitle="Pick the things you’re into. We’ll suggest rooms and people that fit.">
      <div className="mb-4 flex justify-end">
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void finish(profile.interests ?? [])}>
          Skip
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {TUTORIAL_INTERESTS.map(({ id, emoji }) => {
          const isSelected = selected.includes(id);
          return (
            <Button
              key={id}
              type="button"
              variant={isSelected ? "default" : "outline"}
              aria-pressed={isSelected}
              disabled={busy}
              onClick={() => toggleInterest(id)}
              className={`h-11 justify-start gap-2 ${isSelected ? "bg-gradient-primary border-0" : "glass border-white/10"}`}
            >
              <CustomEmoji name={emoji} className="h-5 w-5" />
              <span>{id}</span>
            </Button>
          );
        })}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      <Button
        type="button"
        disabled={busy}
        onClick={() => void finish(selected)}
        className="mt-5 w-full h-11 bg-gradient-primary border-0 shadow-glow hover:opacity-90"
      >
        {busy ? "Saving…" : "Continue"}
      </Button>
    </AuthCard>
  );
}
