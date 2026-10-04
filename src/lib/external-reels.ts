export type ExternalReelPlatform = "instagram" | "youtube" | "rednote";

export type ExternalReelLink = {
  platform: ExternalReelPlatform;
  sourceUrl: string;
  embedUrl: string | null;
  videoId: string | null;
};

export type ExternalReelLinkResult =
  | { ok: true; value: ExternalReelLink }
  | { ok: false; error: string };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const INSTAGRAM_CODE = /^[A-Za-z0-9_-]{1,64}$/;
const REDNOTE_UNAVAILABLE =
  "This video stays on its original site. RIZZ does not download or rehost it.";

function normalizedUrl(value: string): URL {
  const candidate = value.trim();
  if (!candidate) throw new Error("Paste a supported video link.");
  const withProtocol = /^[a-z][a-z\d+.-]*:/i.test(candidate)
    ? candidate
    : `https://${candidate}`;
  const url = new URL(withProtocol);

  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new Error("Use a standard public video link.");
  }
  url.protocol = "https:";
  url.hash = "";
  return url;
}

export function parseExternalReelLink(value: string): ExternalReelLinkResult {
  try {
    const url = normalizedUrl(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const parts = url.pathname.split("/").filter(Boolean);

    if (["youtube.com", "m.youtube.com", "youtu.be"].includes(host)) {
      const videoId =
        host === "youtu.be"
          ? parts[0]
          : url.searchParams.get("v") ??
            (["shorts", "embed", "live"].includes(parts[0] ?? "") ? parts[1] : undefined);
      if (!videoId || !YOUTUBE_ID.test(videoId)) {
        throw new Error("That YouTube link does not contain a valid video.");
      }
      return {
        ok: true,
        value: {
          platform: "youtube",
          sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
          embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&controls=1&rel=0`,
          videoId,
        },
      };
    }

    if (["instagram.com", "m.instagram.com", "instagr.am"].includes(host)) {
      const kind = parts[0]?.toLowerCase();
      const shortcode = parts[1];
      if (!["reel", "reels", "p", "tv"].includes(kind ?? "") || !INSTAGRAM_CODE.test(shortcode ?? "")) {
        throw new Error("This video link isn't supported here.");
      }
      return {
        ok: true,
        value: {
          platform: "instagram",
          sourceUrl: `https://www.instagram.com/${kind}/${shortcode}/`,
          embedUrl: null,
          videoId: shortcode,
        },
      };
    }

    if (["rednote.com", "xiaohongshu.com", "xhslink.com"].includes(host)) {
      if (!parts.length) throw new Error("Paste a direct RedNote video link.");
      return {
        ok: true,
        value: { platform: "rednote", sourceUrl: url.toString(), embedUrl: null, videoId: null },
      };
    }

    throw new Error("Only supported video links can be shared here.");
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "That video link is not valid.",
    };
  }
}

export { REDNOTE_UNAVAILABLE };