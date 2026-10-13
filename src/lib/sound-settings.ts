import { useEffect, useState } from "react";

/**
 * Voice & Sound settings.
 *
 * One persisted record for everything audible in the app: the MUSIC BOT, TTS /
 * voice call audio, notification sounds and the microphone. It is stored the
 * same way the other preferences are (localStorage + a change event) so the UI
 * updates live and playback never needs a restart, and it is applied to the
 * media elements in `audio-gain.ts` so a slider move takes effect mid-song.
 *
 * `realmOverrides` holds a per-realm (per-server) bot volume: the key is the
 * realm id and the value is a multiplier applied on top of the music slider, so
 * one loud realm can be turned down without changing your global volume.
 */
export const SOUND_SETTINGS_KEY = "rizz:sound";

/** Fired on every change so live players can re-apply volume instantly. */
export const SOUND_SETTINGS_EVENT = "rizz:sound-changed";

export type SoundSettings = {
  /** 0–2, i.e. 0–200%. Multiplies every other channel. */
  master: number;
  /** 0–2. MUSIC BOT songs and previews. */
  music: number;
  /** 0–2. Voice call audio and TTS. */
  voice: number;
  /** 0–2. Notification and alert sounds. */
  notifications: number;
  /** Global mute: silences music, voice and notifications at once. */
  muted: boolean;
  /** 0–1. How loud you have to talk before the speaking ring lights up. */
  micSensitivity: number;
  noiseSuppression: boolean;
  /** Preferred devices, by `MediaDeviceInfo.deviceId`. Null = system default. */
  inputDeviceId: string | null;
  outputDeviceId: string | null;
  /** realm id -> bot volume multiplier (0–2). */
  realmOverrides: Record<string, number>;
};

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  master: 1,
  music: 0.8,
  voice: 1,
  notifications: 0.8,
  muted: false,
  micSensitivity: 0.5,
  noiseSuppression: true,
  inputDeviceId: null,
  outputDeviceId: null,
  realmOverrides: {},
};

export type SoundChannel = "music" | "voice" | "notifications";

const clamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;

function normalize(raw: Partial<SoundSettings> | null | undefined): SoundSettings {
  const merged = { ...DEFAULT_SOUND_SETTINGS, ...(raw ?? {}) };
  const overrides: Record<string, number> = {};
  for (const [realmId, value] of Object.entries(merged.realmOverrides ?? {})) {
    if (typeof value === "number" && Number.isFinite(value)) overrides[realmId] = clamp(value, 0, 2);
  }
  return {
    master: clamp(merged.master, 0, 2),
    music: clamp(merged.music, 0, 2),
    voice: clamp(merged.voice, 0, 2),
    notifications: clamp(merged.notifications, 0, 2),
    muted: merged.muted === true,
    micSensitivity: clamp(merged.micSensitivity, 0, 1),
    noiseSuppression: merged.noiseSuppression !== false,
    inputDeviceId: typeof merged.inputDeviceId === "string" ? merged.inputDeviceId : null,
    outputDeviceId: typeof merged.outputDeviceId === "string" ? merged.outputDeviceId : null,
    realmOverrides: overrides,
  };
}

export function loadSoundSettings(): SoundSettings {
  if (typeof localStorage === "undefined") return DEFAULT_SOUND_SETTINGS;
  try {
    return normalize(JSON.parse(localStorage.getItem(SOUND_SETTINGS_KEY) || "{}") as Partial<SoundSettings>);
  } catch {
    return DEFAULT_SOUND_SETTINGS;
  }
}

export function saveSoundSettings(next: SoundSettings) {
  const normalized = normalize(next);
  if (typeof localStorage !== "undefined") localStorage.setItem(SOUND_SETTINGS_KEY, JSON.stringify(normalized));
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SOUND_SETTINGS_EVENT));
  return normalized;
}

/**
 * The final 0–2 multiplier for one channel. Music also takes the realm override
 * into account and is muted globally when `muted` is on.
 */
export function channelVolume(
  settings: SoundSettings,
  channel: SoundChannel,
  realmId?: string | null,
): number {
  if (settings.muted) return 0;
  const realmMultiplier = channel === "music" && realmId ? settings.realmOverrides[realmId] ?? 1 : 1;
  return clamp(settings.master * settings[channel] * realmMultiplier, 0, 2);
}

/** `1.5` -> `"150%"`. Used by every slider's readout. */
export function formatVolume(multiplier: number): string {
  return `${Math.round(multiplier * 100)}%`;
}

/** Live settings + a setter, kept in sync across tabs and components. */
export function useSoundSettings(): [SoundSettings, (patch: Partial<SoundSettings>) => SoundSettings] {
  const [settings, setSettings] = useState<SoundSettings>(() => loadSoundSettings());

  useEffect(() => {
    const sync = () => setSettings(loadSoundSettings());
    window.addEventListener(SOUND_SETTINGS_EVENT, sync);
    window.addEventListener("storage", sync);
    sync();
    return () => {
      window.removeEventListener(SOUND_SETTINGS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = (patch: Partial<SoundSettings>) => {
    const next = saveSoundSettings({ ...loadSoundSettings(), ...patch });
    setSettings(next);
    return next;
  };

  return [settings, update];
}
