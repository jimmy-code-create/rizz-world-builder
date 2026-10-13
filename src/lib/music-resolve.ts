import {
  detectMusicSource,
  looksLikeMusicLink,
  type MusicSourceKind,
} from "@/lib/music-sources";

/**
 * Turning what someone typed into a queue row.
 *
 * One entry point — `resolveMusicQuery` — so `/play` behaves the same whichever
 * provider answers, and every failure comes back as copy the chat can show
 * instead of a thrown error. Runs on the server only (the browser never calls
 * the iTunes or oEmbed APIs directly), but it is plain `fetch` and has no
 * server-only imports, so it can also be reused by a script.
 *
 * `ResolvedMusicTrack` is exactly the jsonb `public.music_add` reads.
 */
export type ResolvedMusicTrack = {
  title: string;
  artist: string | null;
  url: string | null;
  artwork: string | null;
  /** A URL the browser can play directly. Null means "use the provider's player". */
  preview: string | null;
  duration: number | null;
};

export type ResolveMusicResult =
  | { ok: true; kind: MusicSourceKind; track: ResolvedMusicTrack }
  | { ok: false; reason: string; error: string };

const SEARCH_TIMEOUT_MS = 5_000;
const OEMBED_TIMEOUT_MS = 5_000;

function fail(reason: string, error: string): ResolveMusicResult {
  return { ok: false, reason, error };
}

/** Apple Music search — the original provider, unchanged. */
export async function resolveAppleSearch(query: string): Promise<ResolveMusicResult> {
  try {
    const params = new URLSearchParams({ term: query, media: "music", entity: "song", limit: "1" });
    const response = await fetch(`https://itunes.apple.com/search?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });
    if (!response.ok) return fail("network", "Apple Music didn't answer. Try again in a moment.");

    const payload = (await response.json()) as { results?: Record<string, unknown>[] };
    const hit = payload.results?.[0];
    if (!hit || typeof hit.trackName !== "string" || !hit.trackName.trim()) {
      return fail("not_found", `No song found for "${query.slice(0, 60)}"`);
    }

    return {
      ok: true,
      kind: "apple",
      track: {
        title: hit.trackName.trim(),
        artist: typeof hit.artistName === "string" ? hit.artistName : null,
        url: typeof hit.trackViewUrl === "string" ? hit.trackViewUrl : null,
        artwork: typeof hit.artworkUrl100 === "string" ? hit.artworkUrl100 : null,
        preview: typeof hit.previewUrl === "string" ? hit.previewUrl : null,
        duration: typeof hit.trackTimeMillis === "number" ? Math.round(hit.trackTimeMillis) : null,
      },
    };
  } catch (error) {
    console.error("[music-resolve] Apple search failed", error);
    return fail("network", "Apple Music didn't answer. Try again in a moment.");
  }
}

/**
 * YouTube metadata through the public oEmbed endpoint: no API key, and it tells
 * us whether the video exists and allows embedding. Playback itself always goes
 * through the official IFrame player — nothing is downloaded or extracted.
 */
export async function resolveYouTubeLink(url: string): Promise<ResolveMusicResult> {
  const params = new URLSearchParams({ url, format: "json" });
  try {
    const response = await fetch(`https://www.youtube.com/oembed?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(OEMBED_TIMEOUT_MS),
    });

    if (response.status === 401 || response.status === 403) {
      return fail("embedding_blocked", "That video's owner doesn't allow it to play outside YouTube.");
    }
    // 404 for a removed video; 400 when the id is malformed or the URL is not a
    // playable video at all. Both mean "there is nothing here to play".
    if (response.status === 404 || response.status === 400) {
      return fail("video_unavailable", "That video doesn't exist any more.");
    }
    if (!response.ok) {
      return fail("network", "YouTube didn't answer. Try again in a moment.");
    }

    const payload = (await response.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    const title = (payload.title ?? "").trim();
    if (!title) return fail("video_unavailable", "That video has no title to show.");

    return {
      ok: true,
      kind: "youtube",
      track: {
        title,
        artist: payload.author_name?.trim() || null,
        url,
        // `hqdefault` always exists, unlike the maxres variant.
        artwork: payload.thumbnail_url || youTubeThumbnail(url),
        // No direct audio: the IFrame player owns playback for YouTube.
        preview: null,
        duration: null,
      },
    };
  } catch (error) {
    console.error("[music-resolve] YouTube oEmbed failed", error);
    return fail("network", "YouTube didn't answer. Try again in a moment.");
  }
}

function youTubeThumbnail(url: string): string | null {
  const detected = detectMusicSource(url);
  return detected?.videoId ? `https://i.ytimg.com/vi/${detected.videoId}/hqdefault.jpg` : null;
}

/** A direct audio file: check it really is audio before queueing it. */
export async function resolveDirectAudio(url: string): Promise<ResolveMusicResult> {
  let contentType = "";
  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });
    if (response.ok) contentType = response.headers.get("content-type") ?? "";
  } catch (error) {
    // A missing HEAD (many hosts reject it) is not fatal: let the audio element
    // try the file itself.
    console.debug("[music-resolve] HEAD failed for a direct audio link", error);
  }

  if (contentType && !/^audio\/|^application\/(ogg|octet-stream)|^video\/(mp4|webm)/i.test(contentType)) {
    return fail("not_audio", "That link isn't an audio file, so the bot can't play it.");
  }

  const name = decodeURIComponent(url.split("/").pop()?.split(/[?#]/)[0] ?? "");
  const title = name.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim() || "Audio link";

  return {
    ok: true,
    kind: "audio",
    track: {
      title,
      artist: null,
      url,
      artwork: null,
      // Direct audio IS the playable URL.
      preview: url,
      // A byte length without a bitrate cannot give a duration, and no browser
      // API exposes one for a remote file, so the audio element reports it.
      duration: null,
    },
  };
}

/**
 * The one entry point `/play` uses.
 *
 * A link is routed by `detectMusicSource`; anything else is a search. Adding a
 * provider means adding a case here and a `MusicProvider` entry — nothing else
 * in the app needs to know it exists.
 */
export async function resolveMusicQuery(query: string): Promise<ResolveMusicResult> {
  const trimmed = query.trim();
  if (!trimmed) return fail("empty", "Name a song first, like /play golden hour");

  if (!looksLikeMusicLink(trimmed)) {
    // A typed song name is a search, and searching stays on Apple Music.
    return resolveAppleSearch(trimmed);
  }

  const detected = detectMusicSource(trimmed);
  if (!detected) {
    return fail(
      "unsupported_link",
      "That link isn't supported yet. Try YouTube, Apple Music, or a direct audio file.",
    );
  }

  switch (detected.kind) {
    case "youtube":
      return resolveYouTubeLink(detected.url);
    case "audio":
      return resolveDirectAudio(detected.url);
    case "apple":
      // An Apple link is queued with the link's own identity; the browser can
      // play the Apple-hosted preview once the page provides one.
      return resolveAppleLink(detected.url, detected.appleTrackId);
    default:
      return fail("unsupported_link", "That link isn't supported yet.");
  }
}

/**
 * Apple links resolve through the same public search endpoint, using the track
 * id (or the link's own slug) as the query, so an Apple link keeps its artwork
 * and matches an Apple search result exactly.
 */
async function resolveAppleLink(url: string, trackId?: string): Promise<ResolveMusicResult> {
  const slug = decodeURIComponent(url.split("?")[0].split("/").pop() ?? "");
  const query = trackId ? `id${trackId}` : slug.replace(/[-_]+/g, " ").trim();
  if (!query) {
    return {
      ok: true,
      kind: "apple",
      track: { title: "Apple Music link", artist: null, url, artwork: null, preview: null, duration: null },
    };
  }
  const searched = await resolveAppleSearch(query);
  if (!searched.ok) {
    // Search misses are not fatal for a link: queue it under its own URL and
    // let the Apple embed play it.
    return {
      ok: true,
      kind: "apple",
      track: { title: slug || "Apple Music link", artist: null, url, artwork: null, preview: null, duration: null },
    };
  }
  return { ...searched, kind: "apple", track: { ...searched.track, url } };
}
