/**
 * The official YouTube IFrame Player API, loaded once per page.
 *
 * YouTube playback in this app is deliberately limited to the embedded player:
 * we never download, rip or extract audio. This module is the thin wrapper —
 * load the API, build a player, and expose play/pause/seek/volume/duration the
 * same way an `<audio>` element does, so the unified player can treat YouTube
 * and a plain audio file identically.
 *
 * Errors surface as our own reason strings (see `music-sources.ts`), which is
 * how "video unavailable", "embedding blocked" and "region-locked" get friendly
 * copy and a skip instead of a silent black rectangle.
 */

import { youtubeErrorReason } from "@/lib/music-sources";

export type YouTubePlayerState = "unstarted" | "ended" | "playing" | "paused" | "buffering" | "cued";

export type YouTubePlayerHandle = {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  /** 0–2. The IFrame API caps at 100, so this multiplies by 50 on the way in. */
  setVolume: (multiplier: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
};

type NativePlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
  getPlayerState: () => number;
};

type YTNamespace = {
  Player: new (
    element: HTMLElement | string,
    options: Record<string, unknown>,
  ) => NativePlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number; CUED: number };
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const SCRIPT_ID = "youtube-iframe-api";
let apiPromise: Promise<YTNamespace> | null = null;

/** Resolves with the `YT` namespace, loading the script on first use. */
export function loadYouTubeIframeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("The YouTube player needs a browser"));
  }
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const done = () => {
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("The YouTube player did not finish loading"));
    };
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      done();
    };

    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => {
        apiPromise = null;
        reject(new Error("The YouTube player could not be loaded"));
      };
      document.head.appendChild(script);
    }
    // The API may already have spun up between the two checks above.
    if (window.YT?.Player) done();
    // Never leave a caller hanging if the callback never fires (offline, blocked).
    window.setTimeout(() => {
      if (window.YT?.Player) return;
      // Let a later attempt try again rather than caching the failure forever.
      apiPromise = null;
      reject(new Error("The YouTube player timed out"));
    }, 12_000);
  });

  return apiPromise;
}

export type CreateYouTubePlayerOptions = {
  mount: HTMLElement;
  videoId?: string;
  playlistId?: string;
  /** Start muted; the caller unmutes once it knows the user's volume. */
  muted?: boolean;
  volume?: number;
  onReady?: () => void;
  onStateChange?: (state: YouTubePlayerState) => void;
  /** A reason string from `music-sources.ts`, plus the raw IFrame code. */
  onError?: (reason: string, code: number) => void;
};

function stateName(code: number, states: YTNamespace["PlayerState"]): YouTubePlayerState {
  if (code === states.PLAYING) return "playing";
  if (code === states.PAUSED) return "paused";
  if (code === states.ENDED) return "ended";
  if (code === states.BUFFERING) return "buffering";
  if (code === states.CUED) return "cued";
  return "unstarted";
}

/**
 * Builds a player inside `mount`. The returned handle is a plain object, so
 * React components can hold it in a ref without reconciling YouTube's DOM.
 */
export async function createYouTubePlayer(
  options: CreateYouTubePlayerOptions,
): Promise<YouTubePlayerHandle> {
  const YT = await loadYouTubeIframeApi();
  const { mount } = options;

  const playerVars: Record<string, string | number> = {
    controls: 0,
    disablekb: 1,
    modestbranding: 1,
    rel: 0,
    playsinline: 1,
    iv_load_policy: 3,
    fs: 0,
  };
  if (options.playlistId) playerVars.list = options.playlistId;
  // A playlist with no video needs listType; a video with a `list` param does not.
  if (!options.videoId && options.playlistId) playerVars.listType = "playlist";
  if (typeof window !== "undefined" && window.location?.origin) {
    playerVars.origin = window.location.origin;
  }

  const volume = Math.round(Math.min(2, Math.max(0, options.volume ?? 1)) * 50);

  return new Promise<YouTubePlayerHandle>((resolve) => {
    const player = new YT.Player(mount, {
      width: "100%",
      height: "100%",
      videoId: options.videoId,
      playerVars,
      events: {
        onReady: () => {
          try {
            player.setVolume(volume);
            if (options.muted) player.mute();
          } catch {
            // Volume before the first play is best-effort.
          }
          options.onReady?.();
          resolve({
            play: () => player.playVideo(),
            pause: () => player.pauseVideo(),
            seekTo: (seconds) => player.seekTo(Math.max(0, seconds), true),
            setVolume: (multiplier) => {
              const value = Math.round(Math.min(2, Math.max(0, multiplier)) * 50);
              try {
                player.setVolume(Math.min(100, value));
                // The API cannot amplify above 100, so only mute/unmute is left.
                if (value === 0) player.mute();
                else player.unMute();
              } catch {
                // Player torn down mid-update.
              }
            },
            getCurrentTime: () => {
              try {
                return player.getCurrentTime() ?? 0;
              } catch {
                return 0;
              }
            },
            getDuration: () => {
              try {
                return player.getDuration() ?? 0;
              } catch {
                return 0;
              }
            },
            destroy: () => {
              try {
                player.destroy();
              } catch {
                // Already gone.
              }
            },
          });
        },
        onStateChange: (event: { data: number }) => {
          options.onStateChange?.(stateName(event.data, YT.PlayerState));
        },
        onError: (event: { data: number }) => {
          options.onError?.(youtubeErrorReason(event.data), event.data);
        },
      },
    });
  });
}
