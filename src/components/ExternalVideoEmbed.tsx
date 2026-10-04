import { Film } from "lucide-react";
import { parseExternalReelLink, REDNOTE_UNAVAILABLE } from "@/lib/external-reels";

export function ExternalVideoEmbed({
  sourceUrl,
  className = "",
}: {
  sourceUrl: string;
  className?: string;
}) {
  const parsed = parseExternalReelLink(sourceUrl);
  if (!parsed.ok) return null;

  if (parsed.value.platform !== "youtube") {
    return (
      <div
        className={`grid place-items-center overflow-hidden bg-[radial-gradient(ellipse_at_50%_35%,rgba(255,255,255,0.08),transparent_52%),linear-gradient(160deg,#19151f,#070609)] p-6 text-center text-white ${className}`}
        role="img"
        aria-label="Video hosted on its original site"
      >
        <div className="flex max-w-xs flex-col items-center gap-3">
          <span className="grid h-14 w-14 place-items-center rounded-full border border-white/15 bg-white/[0.08] shadow-[0_12px_40px_-18px_rgba(0,0,0,0.9)]">
            <Film className="h-6 w-6 text-white/80" />
          </span>
          <span className="text-sm font-semibold">Video hosted on its original site</span>
          <span className="text-xs leading-relaxed text-white/60">{REDNOTE_UNAVAILABLE}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden bg-black ${className}`}>
      <iframe
        className="h-full w-full border-0"
        src={parsed.value.embedUrl ?? undefined}
        title="YouTube video player"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}