import { useEffect, useRef, useState } from "react";
import type lottie from "lottie-web";
import { cn } from "@/lib/utils";

/**
 * The Web Slinger profile effect.
 *
 * The scenes are Lottie files built by the scripts in `scripts/effects/`.
 * This is a RIZZ effect played by lottie-web; it is not a Discord Shop
 * upload and does not use Discord's profile-effect pipeline.
 *
 * The art is original: a masked web-slinger in the red-and-blue spider
 * aesthetic, drawn from scratch as bezier paths. No Marvel, Sony or Disney
 * assets are used, referenced or required.
 *
 * There are two compositions, because the surfaces are different shapes:
 *
 *   avatar  a 512x512 close scene behind the avatar, with the masked head
 *           and one raised arm clear of the disc
 *   banner  a 1200x420 wide scene, filling the banner, where the whole swing,
 *           flip and landing are visible
 *
 * Both are built by the scripts in `scripts/effects/` and share the same
 * character rig, so the hero is the same character on both surfaces.
 */

export const WEB_SLINGER_ASSET = "/effects/fx-web-slinger.json";
export const WEB_SLINGER_BANNER_ASSET = "/effects/fx-web-slinger-banner.json";

/** lottie-web's own animation item, narrowed to what is used here. */
type PlayerAnimation = ReturnType<typeof lottie.loadAnimation>;

type Props = {
  /** How the scene is placed: behind an avatar, or filling a banner. */
  variant?: "avatar" | "banner";
  /** The avatar's size in pixels — the scene is sized from it. */
  avatarSize?: number;
  className?: string;
};

export function WebSlingerEffect({ variant = "avatar", avatarSize = 96, className }: Props) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<PlayerAnimation | null>(null);
  const started = useRef<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [visible, setVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

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

  const asset = variant === "banner" ? WEB_SLINGER_BANNER_ASSET : WEB_SLINGER_ASSET;

  useEffect(() => {
    if (!visible || started.current === asset) return;
    started.current = asset;
    let cancelled = false;
    let animation: PlayerAnimation | undefined;

    const load = async () => {
      try {
        setState("loading");
        const response = await fetch(asset);
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
          rendererSettings:
            variant === "banner" ? { preserveAspectRatio: "xMidYMid slice" } : undefined,
        });
        animation = loaded;
        animationRef.current = loaded;
        loaded.addEventListener("DOMLoaded", () => {
          if (cancelled) return;
          setState("ready");
          // With reduced motion the effect holds the hero moment instead of
          // looping.
          if (reduceMotion) loaded.goToAndStop(variant === "banner" ? 130 : 140, true);
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
    // The animation is loaded once per asset; the reduced-motion preference
    // is handled separately so toggling it never tears the animation down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, asset]);

  useEffect(() => {
    if (state !== "ready" || !animationRef.current) return;
    if (reduceMotion) animationRef.current.goToAndStop(variant === "banner" ? 130 : 140, true);
    else animationRef.current.play();
  }, [reduceMotion, state, variant]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduceMotion(event.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);

  // ---- placement -------------------------------------------------------
  // The avatar scene is a square sized from the avatar and aligned so the
  // scene's own disc sits exactly over the real avatar. The head, raised arm
  // and web line then land where the contact sheet puts them: above and to
  // the left, clear of the disc. The banner scene fills its parent and crops
  // like a background image.
  const size = avatarSize * 1.9;
  const isBanner = variant === "banner";
  const left = -avatarSize * 0.45;
  const top = -avatarSize * 0.45;

  return (
    <span
      ref={hostRef}
      aria-hidden
      data-state={state}
      data-variant={variant}
      className={cn(
        "pointer-events-none absolute block",
        isBanner && "inset-0 h-full w-full",
        className,
      )}
      style={{
        ...(isBanner
          ? { inset: 0, width: "100%", height: "100%" }
          : { width: size, height: size, left, top }),
        opacity: state === "failed" ? 0 : 1,
        transition: "opacity 500ms ease",
      }}
    />
  );
}
