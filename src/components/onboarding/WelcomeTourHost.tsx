import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import {
  WELCOME_TOUR_EVENT,
  hasTourPending,
  setTourPending,
} from "@/lib/onboarding";
import { WelcomeTourOverlay } from "./WelcomeTourOverlay";

/**
 * Mounts the welcome tour over the live feed instead of a page of its own.
 *
 * The first run starts by itself once the shell can render the feed; replay
 * starts from Settings or the account menu through a window event. The tour
 * never has its own route, so every spotlight lands on the real control the
 * member will use tomorrow.
 */
export function WelcomeTourHost() {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const [open, setOpen] = useState(false);
  const [replay, setReplay] = useState(false);
  // Profile refresh lands a tick after the overlay closes; this keeps the
  // first-run effect from reopening the tour in that gap.
  const finished = useRef(false);

  // First run: the gate sends new members to /feed, so start as soon as the
  // feed shell is on screen.
  useEffect(() => {
    if (finished.current) return;
    if (!user || !profile?.username) return;
    if (path !== "/feed") return;
    // A refresh during a replay keeps the pending flag: resume it. A finished
    // first run clears the flag and writes tutorial_seen.
    const resumingReplay = profile.tutorial_seen && hasTourPending(user.id);
    if (profile.tutorial_seen && !resumingReplay) return;
    setTourPending(user.id, true);
    setReplay(resumingReplay);
    setOpen(true);
  }, [user, profile?.username, profile?.tutorial_seen, path]);

  // Replay from Settings / account menu. The event can fire while the host is
  // already mounted, so it just re-opens at scene one.
  useEffect(() => {
    const onReplay = () => {
      if (!user) return;
      setTourPending(user.id, true);
      setReplay(true);
      setOpen(true);
      // The coach marks point at feed controls; a replay requested elsewhere
      // should bring the feed under them rather than float over another page.
      if (path !== "/feed") nav({ to: "/feed" });
    };
    window.addEventListener(WELCOME_TOUR_EVENT, onReplay);
    return () => window.removeEventListener(WELCOME_TOUR_EVENT, onReplay);
  }, [user, path, nav]);

  const finish = useCallback(() => {
    finished.current = true;
    setOpen(false);
    setReplay(false);
    if (user) setTourPending(user.id, false);
  }, [user]);

  if (!open || !user || !profile) return null;

  return (
    <WelcomeTourOverlay
      displayName={profile.display_name || profile.username || "you"}
      replay={replay}
      onDone={finish}
    />
  );
}
