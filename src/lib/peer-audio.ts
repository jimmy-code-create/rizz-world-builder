import { useEffect, useState } from "react";

/**
 * Per-person voice control.
 *
 * Discord-style: every other person in a call gets their own volume (0–100) and
 * their own local mute. Local means it changes only what you hear — it never
 * changes what they send. Stored on the device next to the other sound settings,
 * and announced on an event so a call picks a change up mid-sentence.
 */
export const PEER_AUDIO_KEY = "rizz:peer-audio";
export const PEER_AUDIO_EVENT = "rizz:peer-audio-changed";

export type PeerAudioState = {
  /** user id -> 0..100 loudness. Missing means "leave it at 100". */
  volumes: Record<string, number>;
  /** user ids whose audio is silenced for this device. */
  muted: string[];
};

export const DEFAULT_PEER_AUDIO: PeerAudioState = { volumes: {}, muted: [] };

let cachedPeerAudio: PeerAudioState | null = null;
let savePeerStorageTimeout: any = null;

export function loadPeerAudio(): PeerAudioState {
  if (cachedPeerAudio) return cachedPeerAudio;
  if (typeof localStorage === "undefined") {
    cachedPeerAudio = DEFAULT_PEER_AUDIO;
    return cachedPeerAudio;
  }
  try {
    const raw = localStorage.getItem(PEER_AUDIO_KEY);
    if (!raw) {
      cachedPeerAudio = DEFAULT_PEER_AUDIO;
      return cachedPeerAudio;
    }
    const parsed = JSON.parse(raw) as Partial<PeerAudioState>;
    cachedPeerAudio = {
      volumes: parsed.volumes && typeof parsed.volumes === "object" ? parsed.volumes : {},
      muted: Array.isArray(parsed.muted) ? parsed.muted : [],
    };
  } catch {
    cachedPeerAudio = DEFAULT_PEER_AUDIO;
  }
  return cachedPeerAudio;
}

export function savePeerAudio(next: PeerAudioState): PeerAudioState {
  const clean: PeerAudioState = {
    volumes: Object.fromEntries(
      Object.entries(next.volumes)
        .map(([id, value]) => [id, Math.max(0, Math.min(100, Math.round(value)))])
        .filter(([, value]) => value !== 100),
    ),
    muted: [...new Set(next.muted)],
  };
  cachedPeerAudio = clean;

  if (typeof localStorage !== "undefined") {
    if (savePeerStorageTimeout) clearTimeout(savePeerStorageTimeout);
    savePeerStorageTimeout = setTimeout(() => {
      try {
        localStorage.setItem(PEER_AUDIO_KEY, JSON.stringify(clean));
      } catch {}
    }, 150);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PEER_AUDIO_EVENT, { detail: clean }));
  }
  return clean;
}

export function setPeerVolume(userId: string, volume: number): PeerAudioState {
  const current = loadPeerAudio();
  return savePeerAudio({
    ...current,
    volumes: { ...current.volumes, [userId]: volume },
  });
}

export function togglePeerMute(userId: string): PeerAudioState {
  const current = loadPeerAudio();
  const muted = current.muted.includes(userId)
    ? current.muted.filter((id) => id !== userId)
    : [...current.muted, userId];
  return savePeerAudio({ ...current, muted });
}

/** React hook tracking local peer volume and mute states live. */
export function usePeerAudio(): PeerAudioState {
  const [state, setState] = useState<PeerAudioState>(loadPeerAudio);
  useEffect(() => {
    const refresh = () => {
      cachedPeerAudio = null;
      setState(loadPeerAudio());
    };
    window.addEventListener(PEER_AUDIO_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(PEER_AUDIO_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return state;
}

/** The 0..1 multiplier call audio should apply for one person. */
export function peerGain(state: PeerAudioState, userId: string | null | undefined): number {
  if (!userId) return 1;
  if (state.muted.includes(userId)) return 0;
  const volume = state.volumes[userId];
  return typeof volume === "number" ? volume / 100 : 1;
}

export function peerVolumeOf(state: PeerAudioState, userId: string | null | undefined): number {
  if (!userId) return 100;
  const volume = state.volumes[userId];
  return typeof volume === "number" ? volume : 100;
}
