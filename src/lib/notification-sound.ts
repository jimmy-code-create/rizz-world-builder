import { loadPrefs } from "@/lib/prefs";
import { areRizzSoundsMuted } from "@/lib/rizz-sounds";
import { isSelfDoNotDisturb } from "@/lib/presence";
import { channelVolume, loadSoundSettings } from "@/lib/sound-settings";

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    context ||= new Ctor();
    if (context.state === "suspended") void context.resume();
    return context;
  } catch {
    return null;
  }
}

function tone(frequency: number, startAt: number, durationMs: number, volume: number) {
  const ac = audioContext();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationMs / 1000);
  osc.connect(gain).connect(ac.destination);
  osc.start(startAt);
  osc.stop(startAt + durationMs / 1000 + 0.03);
}

/**
 * Soft two-note ping for a new message.
 *
 * Silenced by the "Notification sounds" preference, by the RIZZ sounds mute
 * switch, by Voice & Sound's mute, and by Do not disturb — which also covers
 * calls, since the call ringer asks the same question.
 *
 * `volumeMultiplier` overrides the saved level; the Voice & Sound screen's
 * "Test sound" button passes the value being previewed. Because the tones are
 * synthesised here (not streamed media), the full 0–200% range really does
 * change how loud they are.
 */
export function playNotificationPing(volumeMultiplier?: number) {
  if (loadPrefs().sounds === false) return;
  if (areRizzSoundsMuted()) return;
  if (isSelfDoNotDisturb()) return;
  const level = volumeMultiplier ?? channelVolume(loadSoundSettings(), "notifications");
  if (level <= 0) return;
  const ac = audioContext();
  if (!ac) return;
  const now = ac.currentTime;
  tone(880, now, 130, 0.05 * level);
  tone(1174, now + 0.11, 170, 0.045 * level);
}

/** True when sounds and calls should stay quiet right now. */
export function shouldStayQuiet() {
  return (
    loadPrefs().sounds === false ||
    loadSoundSettings().muted ||
    areRizzSoundsMuted() ||
    isSelfDoNotDisturb()
  );
}
