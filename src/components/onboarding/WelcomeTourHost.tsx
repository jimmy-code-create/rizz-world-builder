import { useCallback, useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { setTourPending } from "@/lib/onboarding";
import { WelcomeTourOverlay } from "./WelcomeTourOverlay";

/**
 * Mounts the welcome tour over the live feed instead of a page of its own.
 *
 * First run only: a member whose `tutorial_seen` is still false lands on the
 * feed and the coach marks start by themselves. Completing the tour writes
 * `tutorial_seen`, and from then on nothing reopens it — there is no replay
 * row in Settings or the account menu. A refresh before completion keeps the
 * pending flag so the tour resumes rather than vanishing.
 */
export function WelcomeTourHost() {
  const { user, profile } = useAuth();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const [open, setOpen] = useState(false);
  // Profile refresh lands a tick after the overlay closes; this keeps the
  // first-run effect from reopening the tour in that gap.
  const finished = useRef(false);

  // First run: the gate sends new members to /feed, so start as soon as the
  // feed shell is on screen.
  useEffect(() => {
    if (finished.current) return;
    if (!user || !profile?.username) return;
    if (profile.tutorial_seen) return;
    if (path !== "/feed") return;
    setTourPending(user.id, true);
    setOpen(true);
  }, [user, profile?.username, profile?.tutorial_seen, path]);

  const finish = useCallback(() => {
    finished.current = true;
    setOpen(false);
    if (user) setTourPending(user.id, false);
  }, [user]);

  if (!open || !user || !profile) return null;

  return (
    <WelcomeTourOverlay
      displayName={profile.display_name || profile.username || "you"}
      onDone={finish}
    />
  );
}
