/**
 * GAME-ONLY CAPTURE
 *
 * The normal screen-share button can send the whole desktop, notifications and
 * every other window with it. A game stream should show the game and nothing
 * else, so this capture:
 *
 * 1. asks the browser for a tab/window, never a whole monitor
 *    (`displaySurface: "browser"`, `monitorTypeSurfaces: "exclude"`);
 * 2. prefers the current tab, where RIZZ and its game already live;
 * 3. crops the track to the mounted game surface with Region Capture where the
 *    browser supports it, so the RIZZ chrome and voice dock never appear.
 *
 * Browsers without Region Capture still get a game-tab/window stream. The user
 * is told to pick the game window in that case — there is no honest way to
 * crop a tab from JavaScript there.
 */

export const GAME_SURFACE_ATTRIBUTE = "data-rizz-game-surface";

type CropTrack = MediaStreamTrack & {
  cropTo?: (target: unknown) => Promise<void>;
};

type CropTargetConstructor = {
  fromElement?: (element: Element) => Promise<unknown>;
};

type GameDisplayOptions = DisplayMediaStreamOptions & {
  preferCurrentTab?: boolean;
  selfBrowserSurface?: "include" | "exclude";
  surfaceSwitching?: "include" | "exclude";
  monitorTypeSurfaces?: "include" | "exclude";
};

/**
 * The visible game with the largest area. Several game layers can exist during
 * a transition (side panel + overlay), so a hidden one must never win.
 */
export function findGameSurface(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const candidates = [...document.querySelectorAll<HTMLElement>(`[${GAME_SURFACE_ATTRIBUTE}]`)];
  let best: HTMLElement | null = null;
  let bestArea = 0;
  for (const element of candidates) {
    if (!element.getClientRects().length) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width < 32 || rect.height < 32) continue;
    const area = rect.width * rect.height;
    if (area > bestArea) {
      best = element;
      bestArea = area;
    }
  }
  return best;
}

/**
 * Capture the game surface. Throws when the browser cannot capture at all;
 * otherwise resolves with the stream and whether Region Capture cropped it.
 */
export async function captureGameOnlyStream(): Promise<{
  stream: MediaStream;
  cropped: boolean;
}> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("Game streaming isn't available in this browser.");
  }

  const options: GameDisplayOptions = {
    video: {
      displaySurface: "browser",
      frameRate: { ideal: 30, max: 60 },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
    preferCurrentTab: true,
    selfBrowserSurface: "include",
    surfaceSwitching: "exclude",
    monitorTypeSurfaces: "exclude",
  };

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia(options);
  } catch (error) {
    // Some browsers reject the newer tab-only hints outright. Fall back to a
    // plain capture instead of making game streaming unavailable there; the
    // picker still lets the user choose the game tab/window.
    const name = error instanceof DOMException ? error.name : "";
    if (name !== "TypeError" && name !== "OverconstrainedError" && name !== "NotSupportedError") {
      throw error;
    }
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
      preferCurrentTab: true,
    } as GameDisplayOptions);
  }

  const track = stream.getVideoTracks()[0] as CropTrack | undefined;
  if (!track) {
    stream.getTracks().forEach((item) => item.stop());
    throw new Error("That window did not share a video track.");
  }

  const surface = findGameSurface();
  const CropTarget = (window as unknown as { CropTarget?: CropTargetConstructor }).CropTarget;
  if (surface && CropTarget?.fromElement && track.cropTo) {
    try {
      const target = await CropTarget.fromElement(surface);
      await track.cropTo(target);
      return { stream, cropped: true };
    } catch (error) {
      // Region Capture is progressive: keeping the full tab/window stream is
      // better than failing the stream entirely.
      console.debug("[game-capture] region crop unavailable", error);
    }
  }

  return { stream, cropped: false };
}
