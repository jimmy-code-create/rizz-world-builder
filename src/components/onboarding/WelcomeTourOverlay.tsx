import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { Rizzy, type RizzyPose } from "@/components/rizzy/Rizzy";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getPendingInvitePath, setTourPending } from "@/lib/onboarding";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import "./welcome-tour.css";

type Target = string | string[];

type Step = {
  id: string;
  /** CSS selectors for the real control this step highlights. */
  target?: Target;
  title: string;
  body: string;
  pose: RizzyPose;
  /** A real action the member can try; the tour stays where it is. */
  tryAction?: { label: string; run: () => void; doneLabel: string };
};

/**
 * The welcome tour, rebuilt as a floating coach-mark layer.
 *
 * Instead of a slide deck in a full-page card, Rizzy appears as a transparent
 * character over the live app, a soft spotlight finds the real control, and the
 * speech bubble explains it. Two steps include a **Try it** action that clicks
 * the actual UI (composer, and a post's like button), so the tour verifies the
 * feature works instead of only describing it.
 *
 * The overlay itself is pointer-transparent; only the bubble is interactive,
 * so the highlighted control can be used normally while the tour is open.
 */
export function WelcomeTourOverlay({
  displayName,
  replay = false,
  onDone,
}: {
  displayName: string;
  replay?: boolean;
  onDone: () => void | Promise<void>;
}) {
  const { user, refreshProfile } = useAuth();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tried, setTried] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const firstName = displayName.trim().split(/\s+/)[0] || "you";

  const steps = useMemo<Step[]>(
    () => [
      {
        id: "welcome",
        title: `Hi ${firstName} — I'm Rizzy.`,
        body: "Welcome to RIZZ. I'm going to float around, point at the bits worth knowing, and let you try a couple right now.",
        pose: "wave",
      },
      {
        id: "composer",
        target: ["#feed-composer", "[data-tour='composer']"],
        title: "Start with a post",
        body: "Text, photos, polls and GIFs all start here. Tap Try it and the real composer under this bubble takes the cursor — type a line, then keep going.",
        pose: "point",
        tryAction: {
          label: "Try the composer",
          run: () => {
            const input = document.querySelector<HTMLTextAreaElement>(
              "#feed-composer textarea, [data-tour='composer'] textarea",
            );
            input?.focus({ preventScroll: true });
          },
          doneLabel: "Cursor is in — type",
        },
      },
      {
        id: "stories",
        target: "[data-tour='stories']",
        title: "Stories last 24 hours",
        body: "Tap a ring to watch. Add your own from Your story — the good ones disappear before you can overthink them.",
        pose: "present",
      },
      {
        id: "react",
        target: "[data-tour='post']",
        title: "Posts are conversations",
        body: "Tap the heart to like, or long-press a message to react, reply or pin. Go on — the button under this bubble is the real one.",
        pose: "paw",
        tryAction: {
          label: "Try the heart",
          run: () => {
            const like = document.querySelector<HTMLButtonElement>("[data-tour='post-like']");
            like?.click();
          },
          doneLabel: "Reacted — nice",
        },
      },
      {
        id: "realms",
        target: ["[data-tour='nav-realms']", "[data-tour='mobile-more']"],
        title: "Realms are your rooms",
        body: "Channels, voice rooms and game nights live in Realms. Join the ones that match your energy and they stay in your sidebar.",
        pose: "point",
      },
      {
        id: "paws",
        target: ["[data-tour='nav-drops']", "[data-tour='mobile-more']"],
        title: "Paws are live",
        body: "Earned in bounties. Claim bounties, finish quests and spend Paws on cosmetics — Puppy Love is the one waiting in Effects.",
        pose: "present",
      },
      {
        id: "account",
        target: "[data-tour='account']",
        title: "This corner is yours",
        body: "Open this for your status, profile and badges. Equipped looks ride along here and on every profile card — Bloodweb around your avatar, Puppy Love by Biscuit on the banner and Dark Moon framing the whole card.",
        pose: "present",
      },
      {
        id: "done",
        title: "That's the tour.",
        body: "You're set. Go post something, find your people, and make this place yours. Replay these coach marks any time from Settings → Welcome tour.",
        pose: "celebrate",
      },
    ],
    [firstName],
  );

  const step = steps[index]!;
  const isLast = index === steps.length - 1;

  /** Measure the highlighted control, now and after any layout settles. */
  const measure = useCallback(() => {
    const selectors = step.target
      ? Array.isArray(step.target)
        ? step.target
        : [step.target]
      : [];
    let element: HTMLElement | null = null;
    for (const selector of selectors) {
      element = document.querySelector<HTMLElement>(selector);
      if (element) break;
    }
    if (!element) {
      setRect(null);
      return;
    }
    const box = element.getBoundingClientRect();
    if (box.width < 2 || box.height < 2) {
      setRect(null);
      return;
    }
    setRect(box);
  }, [step.target]);

  useEffect(() => {
    setTried(false);
    const element = (() => {
      const selectors = step.target
        ? Array.isArray(step.target)
          ? step.target
          : [step.target]
        : [];
      for (const selector of selectors) {
        const found = document.querySelector<HTMLElement>(selector);
        if (found) return found;
      }
      return null;
    })();
    element?.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });

    measure();
    // Feed content can arrive after the shell is ready; keep looking for the
    // real control for a few seconds instead of spotlighting nothing.
    const timers = [120, 320, 620, 1000, 1600, 2400].map((delay) =>
      window.setTimeout(measure, delay),
    );
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure, step.target]);

  const finish = async (skipped: boolean) => {
    if (!user || finishing) return;
    setFinishing(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ tutorial_seen: true })
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      setTourPending(user.id, false);
      if (!replay) {
        const pendingInvite = getPendingInvitePath();
        if (pendingInvite) {
          window.location.replace(pendingInvite);
          return;
        }
      }
      toast.success(
        replay
          ? "Tour closed."
          : skipped
            ? "Tour closed — replay it any time from Settings."
            : "You're all set.",
      );
      await onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't finish the tour");
    } finally {
      setFinishing(false);
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        void finish(true);
      } else if (event.key === "ArrowRight") {
        if (isLast) void finish(false);
        else setIndex((value) => Math.min(steps.length - 1, value + 1));
      } else if (event.key === "ArrowLeft") {
        setIndex((value) => Math.max(0, value - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish, isLast, steps.length]);

  // Bubble placement: under the control when there is room, above it otherwise,
  // and centred for the two scenes without a target.
  const layout = useMemo(() => {
    if (typeof window === "undefined") {
      return { left: 16, top: 16, width: 340, above: false, center: true };
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(360, vw - 24);
    if (!rect) {
      return { left: (vw - width) / 2, top: vh * 0.52, width, above: false, center: true };
    }
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), vw - width - 12);
    // Roughly the bubble's height; used only to keep it on screen.
    const estimate = 250;
    const roomBelow = vh - rect.bottom - 18;
    const roomAbove = rect.top - 18;
    const above = roomBelow < estimate && roomAbove > roomBelow;
    if (above) {
      // The bubble is anchored by its bottom edge (translateY(-100%)), so keep
      // that edge far enough down for the bubble itself to start on screen.
      return {
        left,
        top: Math.max(rect.top - 14, estimate + 14),
        width,
        above: true,
        center: false,
      };
    }
    return {
      left,
      top: Math.min(rect.bottom + 18, vh - estimate - 18),
      width,
      above: false,
      center: false,
    };
  }, [rect]);

  return (
    <div className="wt-root" role="region" aria-label="Welcome tour" data-replaying={replay || undefined}>
      {/* Spotlight: a transparent window onto the real control. */}
      {rect ? (
        <div
          aria-hidden="true"
          className="wt-spot"
          style={{
            left: rect.left - 8,
            top: rect.top - 8,
            width: rect.width + 16,
            height: rect.height + 16,
          }}
        />
      ) : (
        <div aria-hidden="true" className="wt-dim" />
      )}

      <div className="wt-topbar">
        <span className="wt-progress" aria-hidden="true">
          {steps.map((item, i) => (
            <span
              key={item.id}
              className={cn(
                "wt-dot",
                i < index && "wt-dot--done",
                i === index && "wt-dot--current",
              )}
            />
          ))}
        </span>
        <span className="wt-count" aria-hidden="true">
          {String(index + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
        </span>
        <button
          type="button"
          className="wt-skip"
          onClick={() => void finish(true)}
          disabled={finishing}
        >
          Skip
        </button>
      </div>

      <div
        className={cn("wt-bubble", layout.above && "wt-bubble--above", layout.center && "wt-bubble--center")}
        style={{
          left: layout.left,
          top: layout.top,
          width: layout.width,
          transform: layout.above ? "translateY(-100%)" : undefined,
        }}
      >
        <div className="wt-cat" aria-hidden="true" data-pose={step.pose}>
          <Rizzy pose={step.pose} />
        </div>

        <div className="wt-body">
          <p className="wt-kicker">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Rizzy's welcome tour
          </p>
          <h2 className="wt-title">{step.title}</h2>
          <p className="wt-text">{step.body}</p>

          <div className="wt-actions">
            <button
              type="button"
              className="wt-btn wt-btn--ghost"
              onClick={() => setIndex((value) => Math.max(0, value - 1))}
              disabled={index === 0 || finishing}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </button>

            {step.tryAction && !isLast && (
              <button
                type="button"
                className={cn("wt-btn wt-btn--try", tried && "wt-btn--tried")}
                onClick={() => {
                  step.tryAction?.run();
                  setTried(true);
                }}
              >
                {tried ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    {step.tryAction.doneLabel}
                  </>
                ) : (
                  step.tryAction.label
                )}
              </button>
            )}

            <button
              type="button"
              className="wt-btn wt-btn--next"
              onClick={() => {
                if (isLast) void finish(false);
                else setIndex((value) => Math.min(steps.length - 1, value + 1));
              }}
              disabled={finishing}
            >
              {isLast ? "Finish" : "Next"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

      </div>

      <p className="sr-only" aria-live="polite">
        Step {index + 1} of {steps.length}: {step.title}
      </p>
    </div>
  );
}
