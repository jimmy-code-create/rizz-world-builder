/**
 * Web Audio sound effects for gift drops.
 *
 * Synthesised (no audio files, no new deps) so the rocket launches instantly
 * without a network request. Gated by the same "Notification sounds" and master
 * volume switches as every other app sound.
 */

import { loadPrefs } from "@/lib/prefs";
import { loadSoundSettings } from "@/lib/sound-settings";
import { isSelfDoNotDisturb } from "@/lib/presence";
import type { GiftSound } from "@/lib/gift-catalog";

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** One-shot sine tone with attack/decay envelope. */
function tone({
  frequency,
  startAt,
  durationMs,
  volume = 0.1,
  type = "sine",
}: {
  frequency: number;
  startAt: number;
  durationMs: number;
  volume?: number;
  type?: OscillatorType;
}): void {
  const ac = audioContext();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationMs / 1000);
  osc.connect(gain).connect(ac.destination);
  osc.start(startAt);
  osc.stop(startAt + durationMs / 1000 + 0.04);
}

/** Rising oscillator — the engine spooling up. */
function sweep({
  from,
  to,
  startAt,
  durationMs,
  volume,
  type = "sawtooth",
}: {
  from: number;
  to: number;
  startAt: number;
  durationMs: number;
  volume: number;
  type?: OscillatorType;
}): void {
  const ac = audioContext();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, startAt);
  osc.frequency.exponentialRampToValueAtTime(to, startAt + durationMs / 1000);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationMs / 1000);
  osc.connect(gain).connect(ac.destination);
  osc.start(startAt);
  osc.stop(startAt + durationMs / 1000 + 0.04);
}

/** Filtered noise burst — exhaust and air rushing past the camera. */
function whoosh({
  startAt,
  durationMs,
  volume,
  cutoff,
}: {
  startAt: number;
  durationMs: number;
  volume: number;
  cutoff: number;
}): void {
  const ac = audioContext();
  if (!ac) return;
  const length = Math.max(1, Math.floor(ac.sampleRate * (durationMs / 1000)));
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }
  const source = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const gain = ac.createGain();
  source.buffer = buffer;
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(cutoff, startAt);
  filter.frequency.exponentialRampToValueAtTime(Math.max(180, cutoff * 0.3), startAt + durationMs / 1000);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.06);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationMs / 1000);
  source.connect(filter).connect(gain).connect(ac.destination);
  source.start(startAt);
  source.stop(startAt + durationMs / 1000);
}

/**
 * Rocket launch: a sub-bass ignition, a rising engine sweep, a rush of air,
 * then three bright chimes as the smoke clears.
 */
function playRocketLaunch(): void {
  const ac = audioContext();
  if (!ac) return;
  const now = ac.currentTime;

  tone({ frequency: 46, startAt: now, durationMs: 1250, volume: 0.16, type: "sine" });
  tone({ frequency: 68, startAt: now + 0.03, durationMs: 1050, volume: 0.1, type: "triangle" });
  sweep({
    from: 92,
    to: 560,
    startAt: now + 0.05,
    durationMs: 1050,
    volume: 0.07,
    type: "sawtooth",
  });
  whoosh({ startAt: now + 0.08, durationMs: 1050, volume: 0.12, cutoff: 1800 });

  tone({ frequency: 1046, startAt: now + 1.06, durationMs: 220, volume: 0.07, type: "triangle" });
  tone({ frequency: 1568, startAt: now + 1.12, durationMs: 240, volume: 0.06, type: "triangle" });
  tone({ frequency: 2093, startAt: now + 1.18, durationMs: 280, volume: 0.045, type: "sine" });
}

/**
 * Play the sound effect for a gift. Respects the same "Notification sounds"
 * and master volume switches as every other app sound.
 */
export function playGiftSound(_sound: GiftSound): void {
  if (loadPrefs().sounds === false) return;
  if (loadSoundSettings().muted) return;
  if (isSelfDoNotDisturb()) return;
  const level = loadSoundSettings().notifications;
  if (level <= 0) return;

  playRocketLaunch();
}
