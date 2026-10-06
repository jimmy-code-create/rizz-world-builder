import { ExternalLink, Film, Play } from "lucide-react";
import { parseExternalReelLink, REDNOTE_UNAVAILABLE } from "@/lib/external-reels";

export function ExternalVideoEmbed({
  sourceUrl,
  className = "",
  caption,
  creator,
  minimalControls = false,
}: {
  sourceUrl: string;
  className?: string;
  caption?: string | null;
  creator?: string | null;
  minimalControls?: boolean;
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
        className={`relative isolate flex items-center justify-center overflow-hidden bg-[#08070d] px-4 py-6 text-white ${className}`}
        role="group"
        aria-label={`${platformName} video link`}
      >
        <div aria-hidden="true" className={`absolute inset-0 -z-10 ${poster}`} />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_50%,rgba(10,8,16,0.14),rgba(5,4,9,0.78)_78%)]" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/45 to-transparent" />
        <div className="relative w-full max-w-sm overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#100d18]/75 p-4 shadow-[0_24px_80px_-30px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-primary font-display text-sm font-bold text-white shadow-glow">R</span>
              <div className="min-w-0">
                <p className="font-display text-sm font-bold leading-tight">RIZZ</p>
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/45">Linked reel</p>
              </div>
            </div>
            <span className="inline-flex max-w-[48%] shrink-0 items-center gap-1.5 truncate rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-[10px] font-semibold text-white/75">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--rizz-pink)] shadow-glow" />
              <span className="truncate">{platformName} · {source}</span>
            </span>
          </div>

          <div className="relative mt-4 grid min-h-40 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-black/25 px-4 py-5 text-center">
            <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(236,72,153,0.16),transparent_55%),linear-gradient(135deg,rgba(255,255,255,0.035),transparent_55%)]" />
            <div className="relative flex flex-col items-center">
              <span className="relative grid h-14 w-14 place-items-center rounded-2xl border border-white/15 bg-white/[0.07] shadow-lg">
                <Film className="h-6 w-6 text-white/75" strokeWidth={1.6} />
                <span className="absolute -bottom-2 -right-2 grid h-9 w-9 place-items-center rounded-full bg-gradient-primary text-white shadow-glow">
                  <Play className="ml-0.5 h-4 w-4 fill-current" />
                </span>
              </span>
              <p className="mt-4 text-xs font-semibold text-white/85">
                {creator ? `Shared by @${creator}` : `Shared from ${platformName}`}
              </p>
              <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-white/55">
                {caption?.trim() ? <span className="line-clamp-3">{caption.trim()}</span> : `Continue to ${platformName} to watch the original video.`}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <a
              href={parsed.value.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-gradient-primary px-4 text-sm font-semibold text-white shadow-[0_10px_28px_-14px_var(--rizz-glow)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#090711]"
            >
              <Play className="h-4 w-4 fill-current" />
              Continue on {platformName}
              <ExternalLink className="h-4 w-4" />
            </a>
            <p className="text-center text-[10px] leading-relaxed text-white/45">{REDNOTE_UNAVAILABLE}</p>
          </div>
        </div>
      </div>
    );
  }

  const youtubeEmbedUrl = new URL(parsed.value.embedUrl!);
  if (minimalControls) youtubeEmbedUrl.searchParams.set("controls", "0");

  return (
    <div className={`overflow-hidden bg-black ${className}`}>
      <iframe
        className="h-full w-full border-0"
        src={youtubeEmbedUrl.toString()}
        title="YouTube video player"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}