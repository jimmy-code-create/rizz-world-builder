import { ExternalLink, Film, Play } from "lucide-react";
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
    const source = new URL(parsed.value.sourceUrl).hostname.replace(/^www\./, "");
    const platformName = parsed.value.platform === "instagram" ? "Instagram" : "RedNote";
    const poster =
      parsed.value.platform === "instagram"
        ? "bg-[radial-gradient(ellipse_at_50%_25%,rgba(255,71,156,0.36),transparent_42%),radial-gradient(ellipse_at_75%_80%,rgba(124,58,237,0.3),transparent_44%),linear-gradient(145deg,#211022,#090711_72%)]"
        : "bg-[radial-gradient(ellipse_at_48%_25%,rgba(255,91,113,0.27),transparent_44%),radial-gradient(ellipse_at_75%_80%,rgba(255,190,90,0.17),transparent_44%),linear-gradient(145deg,#21131a,#090711_72%)]";

    return (
      <div
        className={`relative isolate grid place-items-center overflow-hidden bg-[#090711] p-6 text-center text-white ${className}`}
        role="group"
        aria-label={`${platformName} video link`}
      >
        <div aria-hidden="true" className={`absolute inset-0 -z-10 ${poster}`} />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(7,5,12,0.08),rgba(7,5,12,0.76))]" />
        <div className="flex max-w-sm flex-col items-center gap-1.5 p-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white/85 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--rizz-pink)]" />
            {source}
          </span>
          <span className="relative grid h-14 w-14 place-items-center rounded-[1.25rem] border border-white/20 bg-white/[0.09] shadow-[0_18px_56px_-22px_rgba(0,0,0,0.95)] backdrop-blur-sm">
            <Film className="h-6 w-6 text-white/80" strokeWidth={1.6} />
            <span className="absolute -bottom-2 -right-2 grid h-9 w-9 place-items-center rounded-full bg-gradient-primary text-white shadow-lg">
              <Play className="ml-0.5 h-4 w-4 fill-current" />
            </span>
          </span>
          <div className="space-y-1">
            <h2 className="font-display text-base font-bold tracking-tight">Watch on {platformName}</h2>
            <p className="line-clamp-2 text-[11px] leading-snug text-white/65">{REDNOTE_UNAVAILABLE}</p>
          </div>
          <a
            href={parsed.value.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-gradient-primary px-4 text-xs font-semibold text-white shadow-[0_10px_28px_-14px_var(--rizz-glow)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#090711]"
          >
            <Play className="h-4 w-4 fill-current" />
            Open original
            <ExternalLink className="h-4 w-4" />
          </a>
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