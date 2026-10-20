import { useEffect, useRef, useState } from "react";
import type lottie from "lottie-web";
import { cn } from "@/lib/utils";

/**
 * The Web Slinger profile effect.
 *
 * The scene is a Lottie file (`/effects/fx-web-slinger.json`) built by
 * `scripts/build-web-slinger-effect.mjs`. It is the same file Discord's
 * profile effects use, so the effect in the app and the effect on Discord are
 * one asset, not two.
 *
 * The art is original: a masked web-slinger in the red-and-blue spider
 * aesthetic, drawn from scratch as bezier paths. No Marvel, Sony or Disney
 * assets are used, referenced or required.
 *
 * The scene is composed around an avatar disc, so it is placed twice:
 *
 *   avatar  a square behind the avatar, the way Discord draws a profile
 *           effect, with the lenses peeking out at the upper left
 *   banner  the same square anchored to the left of the profile banner, so
 *           the hero looms behind the avatar that overlaps the banner
 */

export const WEB_SLINGER_ASSET = "/effects/fx-web-slinger.json";

/** Where the lenses sit inside the 512x512 scene, as a fraction. */
const EYE_X = 0.13;
const EYE_Y = 0.13;

/** lottie-web's own animation item, narrowed to what is used here. */
type PlayerAnimation = ReturnType<typeof lottie.loadAnimation>;

type Props = {
  /** How the scene is placed: behind an avatar, or at the left of a banner. */
  variant?: "avatar" | "banner";
  /** The avatar's size in pixels — the scene is sized from it. */
  avatarSize?: number;
  className?: string;
};

/** The size of the element the effect is placed inside. */
function useParentSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const node = ref.current?.parentElement;
    if (!node) return;
    const measure = () => setSize({ width: node.clientWidth, height: node.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

export function WebSlingerEffect({ variant = "avatar", avatarSize = 96, className }: Props) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<PlayerAnimation | null>(null);
  const started = useRef(false);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [visible, setVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const parent = useParentSize(hostRef);

  // Nothing animates until the effect is actually near the viewport.
  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { rootMargin: "120px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || started.current) return;
    started.current = true;
    let cancelled = false;
    let animation: PlayerAnimation | undefined;

    const load = async () => {
      try {
        setState("loading");
        const response = await fetch(WEB_SLINGER_ASSET);
        if (!response.ok) throw new Error("The effect could not be loaded");
        const animationData = await response.json();
        const lottieModule = await import("lottie-web");
        if (cancelled || !hostRef.current) return;
        const lottie = lottieModule.default;
        const loaded = lottie.loadAnimation({
          container: hostRef.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData,
        });
        animation = loaded;
        animationRef.current = loaded;
        loaded.addEventListener("DOMLoaded", () => {
          if (cancelled) return;
          setState("ready");
          // With reduced motion the effect holds the hero moment instead of
          // looping.
          if (reduceMotion) loaded.goToAndStop(140, true);
        });
        loaded.addEventListener("data_failed", () => {
          if (!cancelled) setState("failed");
        });
      } catch {
        if (!cancelled) setState("failed");
      }
    };

    void load();
    return () => {
      cancelled = true;
      animation?.destroy();
    };
    // The animation is loaded once; the reduced-motion preference is handled
    // separately so toggling it never tears the animation down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (state !== "ready" || !animationRef.current) return;
    if (reduceMotion) animationRef.current.goToAndStop(140, true);
    else animationRef.current.play();
  }, [reduceMotion, state]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduceMotion(event.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);

  // ---- placement -------------------------------------------------------
  // The scene is a square. Its size comes from the surface it sits on, and
  // it is positioned so the lenses land just above the avatar.
  const size = variant === "avatar" ? avatarSize * 1.9 : Math.max(parent.height * 2.6, 320);

  let left = 0;
  let top = 0;
  if (variant === "avatar") {
    // The avatar's centre is the middle of the decoration's own box; the
    // lenses are a little above and to the left of it.
    left = -avatarSize * 0.5 + size * EYE_X;
    top = -avatarSize * 0.66 + size * EYE_Y;
  } else {
    // The banner's avatar sits at the bottom left; the lenses go above it.
    left = -size * EYE_X + Math.min(parent.width * 0.08, 64);
    top = parent.height - size * EYE_Y - Math.min(parent.height * 0.22, 44);
  }

  return (
    <span
      ref={hostRef}
      aria-hidden
      data-state={state}
      className={cn("pointer-events-none absolute block", className)}
      style={{
        width: size,
        height: size,
        left,
        top,
        opacity: state === "failed" ? 0 : 1,
        transition: "opacity 500ms ease",
      }}
    />
  );
}
