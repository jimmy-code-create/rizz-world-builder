/**
 * Web Audio sound effects for luxury gift drops.
 *
 * Synthesised (no audio files, no new deps) so every flex plays instantly
 * without a network request. Each sound is short and loud enough to cut
 * through a voice room, but gated by the same "Notification sounds" and
 * master volume switches as every other app sound.
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
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationMs / 1000);
  osc.connect(gain).connect(ac.destination);
  osc.start(startAt);
  osc.stop(startAt + durationMs / 1000 + 0.03);
}

/** Rising V8 engine growl — supercars and the Bugatti. */
function playEngineRev(): void {
  const ac = audioContext();
  if (!ac) return;
  const now = ac.currentTime;
  tone({ frequency: 150, startAt: now, durationMs: 400, volume: 0.12 });
  tone({ frequency: 320, startAt: now + 0.12, durationMs: 260, volume: 0.1 });
  tone({ frequency: 200, startAt: now + 0.38, durationMs: 220, volume: 0.08 });
}

/** High-pitch burnout tire squeal — the Cybertruck. */
function playTireScreech(): void {
  const ac = audioContext();
  if (!ac) return;
  const now = ac.currentTime;
  tone({ frequency: 900, startAt: now, durationMs: 350, volume: 0.09, type: "square" });
  tone({ frequency: 1400, startAt: now + 0.08, durationMs: 340, volume: 0.08, type: "square" });
  tone({ frequency: 1100, startAt: now + 0.16, durationMs: 330, volume: 0.07, type: "square" });
}

/** Low jet rumble with turbine whine — the Gulfstream. */
function playJetEngine(): void {
  const ac = audioContext();
  if (!ac) return;
  const now = ac.currentTime;
  tone({ frequency: 60, startAt: now, durationMs: 500, volume: 0.14 });
  tone({ frequency: 110, startAt: now + 0.05, durationMs: 450, volume: 0.12 });
  tone({ frequency: 2200, startAt: now + 0.1, durationMs: 400, volume: 0.06 });
}

/** Crisp champagne cork pop — the yacht. */
function playChampagnePop(): void {
  const ac = audioContext();
  if (!ac) return;
  const now = ac.currentTime;
  tone({ frequency: 400, startAt: now, durationMs: 90, volume: 0.15 });
  tone({ frequency: 700, startAt: now + 0.04, durationMs: 110, volume: 0.12 });
  tone({ frequency: 300, startAt: now + 0.08, durationMs: 140, volume: 0.08 });
}

/** Diamond sparkle chime — the iced out chain. */
function playDiamondTing(): void {
  const ac = audioContext();
  if (!ac) return;
  const now = ac.currentTime;
  tone({ frequency: 1400, startAt: now, durationMs: 180, volume: 0.1 });
  tone({ frequency: 2200, startAt: now + 0.05, durationMs: 200, volume: 0.08 });
  tone({ frequency: 3200, startAt: now + 0.1, durationMs: 220, volume: 0.06 });
}

/**
 * Play the sound effect for a gift. Respects the same "Notification sounds"
 * and master volume switches as every other app sound.
 */
export function playGiftSound(sound: GiftSound): void {
  if (loadPrefs().sounds === false) return;
  if (loadSoundSettings().muted) return;
  if (isSelfDoNotDisturb()) return;
  const level = loadSoundSettings().notifications;
  if (level <= 0) return;

  switch (sound) {
    case "engine-rev":
      playEngineRev();
      break;
    case "tire-screech":
      playTireScreech();
      break;
    case "jet-engine":
      playJetEngine();
      break;
    case "champagne-pop":
      playChampagnePop();
      break;
    case "diamond-ting":
      playDiamondTing();
      break;
  }
}
