import { useEffect, useRef, useState } from "react";
import { CUSTOM_EMOJI, type CustomEmojiName } from "@/lib/emoji.js";

export function CustomEmoji({
  name,
  className = "h-5 w-5",
}: {
  name: CustomEmojiName;
  className?: string;
}) {
  const asset = CUSTOM_EMOJI[name];
  const source = `/emoji/${asset.file}`;
  const extension = asset.file.split(".").pop()?.toLowerCase();
  const containerRef = useRef<HTMLSpanElement>(null);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if ((extension !== "tgs" && extension !== "webm") || !containerRef.current) return;
    const node = containerRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [extension]);

  useEffect(() => {
    if (extension !== "tgs" || !visible || failed || !containerRef.current) return;
    let cancelled = false;
    let animation: { destroy: () => void } | undefined;

    const load = async () => {
      try {
        const response = await fetch(source);
        if (!response.ok) throw new Error("Emoji animation could not be loaded");
        let bytes = await response.arrayBuffer();
        const header = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 2));
        if (header[0] === 0x1f && header[1] === 0x8b) {
          if (!("DecompressionStream" in window)) throw new Error("This browser cannot open TGS animations");
          const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
          bytes = await new Response(stream).arrayBuffer();
        }
        const animationData = JSON.parse(new TextDecoder().decode(bytes));
        const lottieModule = await import("lottie-web");
        if (cancelled || !containerRef.current) return;
        const lottie = lottieModule.default;
        const loadedAnimation = lottie.loadAnimation({
          container: containerRef.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData,
        });
        animation = loadedAnimation;
        loadedAnimation.addEventListener("data_failed", () => setFailed(true));
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    void load();
    return () => {
      cancelled = true;
      animation?.destroy();
    };
  }, [extension, failed, source, visible]);

  if (failed) {
    return <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center ${className}`}>{asset.fallback}</span>;
  }

  if (extension === "webp" || extension === "png") {
    return (
      <img
        src={source}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={`inline-block shrink-0 object-contain ${className}`}
      />
    );
  }

  if (extension === "webm") {
    return (
      <span ref={containerRef} aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center ${className}`}>
        {visible ? (
          <video
            src={source}
            autoPlay
            loop
            muted
            playsInline
            preload="none"
            onError={() => setFailed(true)}
            className="h-full w-full object-contain"
          />
        ) : asset.fallback}
      </span>
    );
  }

  return <span aria-hidden="true" ref={containerRef} className={`inline-flex shrink-0 items-center justify-center ${className}`}>{!visible ? asset.fallback : null}</span>;
}
