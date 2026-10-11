/**
 * Soft UI sounds for Rizz (listening start / stop).
 * Replaces the harsh system recognizer beep with short, quiet sine blips.
 * Volume is deliberately low; a localStorage flag can mute entirely.
 */

const MUTED_KEY = "rizz:rizz-sounds-muted";

export function areRizzSoundsMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setRizzSoundsMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (muted) localStorage.setItem(MUTED_KEY, "1");
    else localStorage.removeItem(MUTED_KEY);
  } catch {
    // Storage unavailable — sound toggle just won't persist.
  }
}

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function blip(fromHz: number, toHz: number, durationMs: number, volume = 0.06): void {
  const ac = audioContext();
  if (!ac) return;
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(fromHz, now);
  osc.frequency.exponentialRampToValueAtTime(toHz, now + durationMs / 1000);
  // Soft attack/decay envelope — no clicks.
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + durationMs / 1000 + 0.03);
}

/** Gentle rising chime — listening started. */
export function playListeningStartSound(): void {
  if (areRizzSoundsMuted()) return;
  blip(523, 659, 160);
}

/** Gentle falling chime — listening stopped. */
export function playListeningStopSound(): void {
  if (areRizzSoundsMuted()) return;
  blip(523, 392, 180);
}
