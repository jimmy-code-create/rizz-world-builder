/**
 * Source-agnostic music.
 *
 * MUSIC BOT used to know exactly one provider: the iTunes Search API. A pasted
 * link was queued as-is — the chat card read "https://youtu.be/…" with no title,
 * no artwork and no audio — and a typed song name was always searched on Apple
 * Music. This module is the single place that decides what a link IS, so the
 * server resolver, the queue card and the players all agree.
 *
 * Deliberately dependency-free and isomorphic: the same `detectMusicSource` runs
 * in the `/api/bot/command` handler and in the browser.
 */

export type MusicSourceKind = "apple" | "youtube" | "audio";

export type DetectedMusicSource = {
  kind: MusicSourceKind;
  /** The canonical URL to store on the queue row. */
  url: string;
  /** YouTube video id (single video or the first video of a playlist link). */
  videoId?: string;
  /** YouTube playlist id, when the link carries one. */
  playlistId?: string;
  /** `https://www.youtube.com/embed/<id>` — the only playback route YouTube allows. */
  embedUrl?: string;
  /** Apple Music track id, when the link is an Apple song link. */
  appleTrackId?: string;
};

/** Audio extensions we treat as a directly playable file. */
const AUDIO_EXTENSIONS = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|weba|webm)(\?|#|$)/i;

function parse(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
}

/** True when the string looks like something we should treat as a link. */
export function looksLikeMusicLink(raw: string): boolean {
  return /^https?:\/\//i.test(raw.trim());
}

/**
 * Classifies a link (or a `src`) into one of the three providers.
 *
 * Returns null for anything we cannot play, which the caller turns into a
 * friendly "that link isn't supported" instead of an empty queue entry.
 */
export function detectMusicSource(raw: string | null | undefined): DetectedMusicSource | null {
  if (!raw) return null;
  const url = parse(raw);
  if (!url) return null;
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();

  // ---- YouTube (official IFrame embed only; audio is never extracted) ----
  if (host === "youtu.be") {
    const videoId = url.pathname.replace(/^\/+/, "").split("/")[0] || undefined;
    if (!videoId) return null;
    return {
      kind: "youtube",
      videoId,
      playlistId: url.searchParams.get("list") ?? undefined,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: embedUrlFor(videoId, url.searchParams.get("list")),
    };
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    const playlistId = url.searchParams.get("list") ?? undefined;
    // /shorts/<id> and /live/<id> are ordinary videos for playback purposes.
    const pathVideo = /^\/(?:shorts|live|embed|v)\/([A-Za-z0-9_-]{6,})/.exec(url.pathname)?.[1];
    const videoId = url.searchParams.get("v") ?? pathVideo ?? undefined;
    if (!videoId && !playlistId) return null;
    return {
      kind: "youtube",
      videoId: videoId ?? undefined,
      playlistId,
      url: videoId
        ? `https://www.youtube.com/watch?v=${videoId}`
        : `https://www.youtube.com/playlist?list=${playlistId}`,
      embedUrl: videoId ? embedUrlFor(videoId, playlistId) : embedUrlFor(null, playlistId),
    };
  }

  // ---- Apple Music ----
  if (host === "music.apple.com" || host === "itunes.apple.com" || host === "geo.music.apple.com") {
    // .../album/<album>/<albumId>?i=<trackId>  or  .../song/<slug>/<trackId>
    const trackFromQuery = url.searchParams.get("i");
    const songId = /\/song\/[^/]+\/(\d+)/.exec(url.pathname)?.[1];
    const appleTrackId = trackFromQuery ?? songId ?? undefined;
    // A plain album link is still playable as an embed; keep it.
    return {
      kind: "apple",
      url: url.toString(),
      appleTrackId: appleTrackId && /^\d+$/.test(appleTrackId) ? appleTrackId : undefined,
    };
  }
  if (host === "apple.co") {
    return { kind: "apple", url: url.toString() };
  }

  // ---- A plain audio file ----
  if (AUDIO_EXTENSIONS.test(url.pathname) || url.protocol === "blob:" || url.protocol === "data:") {
    return { kind: "audio", url: url.toString() };
  }

  return null;
}

function embedUrlFor(videoId: string | null, playlistId: string | null | undefined): string {
  const params = new URLSearchParams({ rel: "0", enablejsapi: "1", playsinline: "1" });
  if (playlistId) params.set("list", playlistId);
  const id = videoId ? `/embed/${videoId}` : "/embed/videoseries";
  return `https://www.youtube.com${id}?${params.toString()}`;
}

/** How a detected source is played, which decides which player the UI mounts. */
export type MusicPlayback = "element" | "iframe";

export type MusicProvider = {
  id: MusicSourceKind;
  label: string;
  /** Short label for chips and cards. */
  shortLabel: string;
  playback: MusicPlayback;
  /** Why this provider is the way it is, shown in the queue card tooltip. */
  note: string;
};

/**
 * The provider registry. Everything downstream — the queue card, the players,
 * the settings copy — reads this instead of hard-coding "Apple Music".
 */
export const MUSIC_PROVIDERS: Record<MusicSourceKind, MusicProvider> = {
  apple: {
    id: "apple",
    label: "Apple Music",
    shortLabel: "Apple",
    playback: "element",
    note: "Apple Music shares 30-second preview clips.",
  },
  youtube: {
    id: "youtube",
    label: "YouTube",
    shortLabel: "YouTube",
    playback: "iframe",
    note: "Played through YouTube's official embedded player. Audio is never downloaded or extracted.",
  },
  audio: {
    id: "audio",
    label: "Audio link",
    shortLabel: "Audio",
    playback: "element",
    note: "A direct audio file played by the browser.",
  },
};

/** The provider for a string, falling back to Apple for plain search results. */
export function providerFor(value: string | null | undefined): MusicProvider {
  const detected = detectMusicSource(value);
  return MUSIC_PROVIDERS[detected?.kind ?? "apple"];
}

/**
 * Friendly copy for every way a source can fail. `retryable` tells the player
 * whether skipping to the next track is the right move.
 */
export type MusicIssue = {
  title: string;
  detail: string;
  retryable: boolean;
};

export function musicIssue(reason: string, provider?: MusicSourceKind): MusicIssue {
  switch (reason) {
    case "video_unavailable":
      return {
        title: "That video is unavailable",
        detail: "The owner removed it or it is private. Skipping to the next track.",
        retryable: false,
      };
    case "embedding_blocked":
      return {
        title: "This track can't be embedded",
        detail: `${provider === "youtube" ? "YouTube" : "The host"} doesn't allow it to play here. Skipping to the next track.`,
        retryable: false,
      };
    case "region_locked":
      return {
        title: "Blocked in your region",
        detail: "This track isn't available where you are. Skipping to the next track.",
        retryable: false,
      };
    case "not_audio":
      return {
        title: "That link isn't audio",
        detail: "Paste a song link or a direct audio file (.mp3, .m4a, .ogg, .wav).",
        retryable: false,
      };
    case "unsupported_link":
      return {
        title: "That link isn't supported",
        detail: "Try YouTube, Apple Music, or a direct audio file.",
        retryable: false,
      };
    case "autoplay_blocked":
      return {
        title: "Tap to start the music",
        detail: "Your browser blocks sound until you interact with the page.",
        retryable: true,
      };
    case "network":
      return {
        title: "Couldn't reach the player",
        detail: "Check your connection — the queue keeps the track so it can retry.",
        retryable: true,
      };
    default:
      return {
        title: "That track wouldn't play",
        detail: "Skipping to the next song in the queue.",
        retryable: false,
      };
  }
}

/**
 * Maps a YouTube IFrame `onError` code onto our reason strings.
 * 2 invalid parameter · 5 HTML5 player failure · 100 removed/private
 * 101 & 150 embedding disabled by the owner.
 */
export function youtubeErrorReason(code: number): string {
  if (code === 100) return "video_unavailable";
  if (code === 101 || code === 150) return "embedding_blocked";
  if (code === 2 || code === 5) return "not_audio";
  return "unknown";
}
