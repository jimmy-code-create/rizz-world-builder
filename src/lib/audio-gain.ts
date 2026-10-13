/**
 * Volume above 100% for a media element.
 *
 * `HTMLMediaElement.volume` stops at 1, so a 0–200% slider needs a GainNode.
 * Routing an element through Web Audio has one sharp edge: `createMediaElementSource`
 * can only be called once per element, and a cross-origin source that does not
 * send CORS headers comes out silent. Both are handled here:
 *
 *  - the controller is created once per element and reused;
 *  - the caller passes the `crossOrigin` value used on the element, and we only
 *    build the graph when it is set (the element already opted into CORS);
 *  - if anything throws, or the graph would silence the element, we return null
 *    or mark the controller as boost-limited so the caller falls back to
 *    `element.volume` at 100% instead of losing sound entirely.
 */
export type GainController = {
  /** 0–2. Values above 1 are applied as gain; below 1 on the element. */
  setVolume: (value: number) => void;
  /**
   * True when only 0–100% will actually be heard (no Web Audio graph), so the
   * UI can tell the user instead of silently ignoring the top half of a slider.
   */
  boostLimited: boolean;
  dispose: () => void;
};

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext ??
    null
  );
}

/** Elements we already routed; one MediaElementSource per element, forever. */
const controllers = new WeakMap<HTMLMediaElement, GainController>();

export function createGainController(
  element: HTMLMediaElement,
  crossOrigin?: string,
): GainController | null {
  const existing = controllers.get(element);
  if (existing) return existing;

  // Without a CORS-enabled source the graph would mute the element, so keep the
  // plain path and report the limitation.
  if (!crossOrigin) return null;

  const Ctor = audioContextCtor();
  if (!Ctor) return null;

  try {
    const context = new Ctor();
    if (context.state === "suspended") void context.resume().catch(() => {});
    const source = context.createMediaElementSource(element);
    const gain = context.createGain();
    source.connect(gain);
    gain.connect(context.destination);

    const controller: GainController = {
      boostLimited: false,
      setVolume(value) {
        const safe = Number.isFinite(value) ? Math.min(2, Math.max(0, value)) : 0;
        try {
          if (safe > 1) {
            element.volume = 1;
            gain.gain.value = safe;
          } else {
            element.volume = safe;
            gain.gain.value = 1;
          }
        } catch {
          element.volume = Math.min(1, safe);
        }
      },
      dispose() {
        try {
          source.disconnect();
          gain.disconnect();
        } catch {
          // already disconnected
        }
        if (context.state !== "closed") void context.close().catch(() => {});
        controllers.delete(element);
      },
    };
    controllers.set(element, controller);
    return controller;
  } catch (error) {
    // Creating a second source for the same element throws; so does a context
    // limit. Either way the plain volume path still works.
    console.debug("Volume boost is unavailable for this element", error);
    return null;
  }
}

/**
 * Applies a 0–2 volume to any media element, preferring the Web Audio path.
 * Returns whether the top half of the range could be applied.
 */
export function setMediaVolume(
  element: HTMLMediaElement | null | undefined,
  volume: number,
  crossOrigin?: string,
): boolean {
  if (!element) return false;
  const controller = createGainController(element, crossOrigin);
  if (controller) {
    controller.setVolume(volume);
    return !controller.boostLimited;
  }
  element.volume = Math.min(1, Math.max(0, volume));
  return volume <= 1;
}
