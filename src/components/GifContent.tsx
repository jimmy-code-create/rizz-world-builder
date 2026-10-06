import { Fragment } from "react";
import { renderGifSegments } from "@/lib/gif-content";

export function GifContent({ children, className }: { children: string; className?: string }) {
  const parts = renderGifSegments(children);
  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.isSticker && part.value.endsWith(".webm")) {
          return (
            <video
              key={`sticker-${index}`}
              src={part.value}
              poster={part.value.replace(/\.webm$/i, ".png")}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              aria-label="Animated sticker"
              className="my-2 inline-block max-h-40 max-w-full rounded-xl object-contain align-middle"
            />
          );
        }
        if (part.isGif || part.isSticker) {
          return (
            <img
              key={`media-${index}`}
              src={part.value}
              alt={part.isSticker ? "Sticker" : "GIF"}
              loading="lazy"
              decoding="async"
              className={`my-2 inline-block max-w-full rounded-xl object-contain align-middle ${
                part.isSticker ? "max-h-40" : "max-h-64"
              }`}
            />
          );
        }
        return part.value ? <Fragment key={`text-${index}`}>{part.value}</Fragment> : null;
      })}
    </span>
  );
}
