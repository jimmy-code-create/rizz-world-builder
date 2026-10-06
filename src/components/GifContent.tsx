import { Fragment } from "react";
import { renderGifSegments } from "@/lib/gif-content";

export function GifContent({ children, className }: { children: string; className?: string }) {
  const parts = renderGifSegments(children);
  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.isGif) {
          return (
            <img
              key={`gif-${index}`}
              src={part.value}
              alt="GIF"
              loading="lazy"
              decoding="async"
              className="my-2 max-h-64 max-w-full rounded-xl object-contain"
            />
          );
        }
        return part.value ? <Fragment key={`text-${index}`}>{part.value}</Fragment> : null;
      })}
    </span>
  );
}
