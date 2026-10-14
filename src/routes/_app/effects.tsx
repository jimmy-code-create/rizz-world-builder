import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, Check, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/effects")({
  head: () => ({ meta: [{ title: "Effects · RIZZ" }] }),
  component: EffectsComingSoonPage,
});

function EffectsComingSoonPage() {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const storageKey = `rizz_effects_notify_${user?.id || "guest"}`;
  const [notified, setNotified] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === "true") setNotified(true);
    } catch {}
  }, [storageKey]);

  const toggleNotify = () => {
    const next = !notified;
    setNotified(next);
    try {
      localStorage.setItem(storageKey, String(next));
    } catch {}
  };

  const profileUsername = profile?.username;

  return (
    <div className="mx-auto max-w-xl px-4 py-6 md:py-12">
      {/* Header with back button */}
      <div className="mb-8 flex items-center gap-3">
        <IconButton
          aria-label="Back"
          size="lg"
          variant="ghost"
          onClick={() => nav({ to: profileUsername ? `/u/${profileUsername}` : "/feed" })}
        >
          <ArrowLeft className="h-5 w-5" />
        </IconButton>
        <span className="text-sm font-medium text-muted-foreground">Profile</span>
      </div>

      {/* Main calm card */}
      <div className="flex flex-col items-center rounded-2xl border border-[var(--brand-line,rgba(244,241,231,0.13))] bg-[var(--brand-ink-2,#131315)] p-8 text-center sm:p-12">
        {/* 96px Cat mark in lime */}
        <div className="mb-6 flex h-24 w-24 items-center justify-center">
          <img
            src="/brand/rizz-cat-logo.svg"
            alt="RIZZ"
            width={96}
            height={96}
            className="h-24 w-24 object-contain"
          />
        </div>

        {/* Title & Coming soon pill */}
        <div className="mb-3 flex items-center justify-center gap-2.5">
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--brand-paper,#f4f1e7)] sm:text-3xl">
            Effects
          </h1>
          <span className="rounded-full border border-[var(--brand-signal,#c8ff3d)] px-2.5 py-0.5 text-xs font-semibold text-[var(--brand-signal,#c8ff3d)]">
            Coming soon
          </span>
        </div>

        {/* One line description */}
        <p className="max-w-md text-sm text-[var(--brand-paper-dim,#a9a69c)] leading-relaxed">
          Avatar decorations, nameplates and profile banners are on the way.
        </p>

        {/* Primary Action: Notify me */}
        <div className="mt-8 flex flex-col items-center gap-3 w-full max-w-xs">
          <Button
            type="button"
            onClick={toggleNotify}
            className={
              notified
                ? "w-full border border-[var(--brand-signal,#c8ff3d)]/60 bg-[var(--brand-signal,#c8ff3d)]/15 text-[var(--brand-signal,#c8ff3d)] font-semibold hover:bg-[var(--brand-signal,#c8ff3d)]/25"
                : "w-full bg-[var(--brand-signal,#c8ff3d)] text-[var(--brand-signal-ink,#0a0a0b)] font-bold hover:brightness-105 active:scale-95"
            }
          >
            {notified ? (
              <>
                <Check className="mr-2 h-4 w-4" /> You're on the list
              </>
            ) : (
              <>
                <Bell className="mr-2 h-4 w-4" /> Notify me
              </>
            )}
          </Button>

          {notified && (
            <span className="text-xs text-[var(--brand-signal,#c8ff3d)] font-medium animate-fade-in" role="status">
              We'll notify you as soon as cosmetics launch.
            </span>
          )}
        </div>

        {/* Back to profile link */}
        <div className="mt-8">
          <Link
            to={profileUsername ? "/u/$username" : "/feed"}
            params={profileUsername ? { username: profileUsername } : undefined}
            className="text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            Back to profile
          </Link>
        </div>
      </div>
    </div>
  );
}
