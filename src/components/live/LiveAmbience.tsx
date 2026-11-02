import { useEffect, useRef } from "react";
import type { LiveSoundBed } from "@/lib/live-studio";

const BEDS: Record<
  Exclude<LiveSoundBed, "off">,
  { notes: number[]; wave: OscillatorType; cutoff: number; volume: number; lfo: number }
> = {
  // Frequencies are notes, not files: the bed is synthesized on every device,
  // so a live room never waits on an audio download and the app ships no music.
  night: {
    notes: [110, 164.81, 220, 277.18],
    wave: "sine",
    cutoff: 720,
    volume: 0.035,
    lfo: 0.05,
  },
  soft: {
    notes: [130.81, 196, 261.63, 329.63],
    wave: "triangle",
    cutoff: 900,
    volume: 0.028,
    lfo: 0.07,
  },
  hype: {
    notes: [146.83, 220, 293.66, 369.99, 440],
    wave: "sawtooth",
    cutoff: 1200,
    volume: 0.018,
    lfo: 0.12,
  },
};

/**
 * A quiet sound bed for the live room. Every client gets the same notes, so
 * the audience hears the host's pick without a server-side audio stream. The
 * first pointer interaction resumes the context (Safari/Chrome autoplay rule),
 * and the dock's speaker button mutes it locally.
 */
export function LiveAmbience({ bed, muted }: { bed: LiveSoundBed; muted: boolean }) {
  const masterRef = useRef<GainNode | null>(null);
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (bed === "off" || typeof window === "undefined") return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    const recipe = BEDS[bed];
    const context = new Ctor();
    const master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    masterRef.current = master;
    contextRef.current = context;

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = recipe.cutoff;
    filter.Q.value = 0.4;
    filter.connect(master);

    const nodes: Array<{ osc: OscillatorNode; lfo: OscillatorNode }> = [];
    recipe.notes.forEach((frequency, index) => {
      const osc = context.createOscillator();
      osc.type = recipe.wave;
      osc.frequency.value = frequency;
      osc.detune.value = index % 2 === 0 ? -4 : 4;

      const voice = context.createGain();
      voice.gain.value = recipe.volume / Math.max(1, recipe.notes.length * 0.7);

      // A slow breathing LFO makes a static chord feel like a room, not a test
      // tone. Its depth is tiny, so it never turns into a wobble.
      const lfo = context.createOscillator();
      lfo.frequency.value = recipe.lfo * (index + 1);
      const lfoDepth = context.createGain();
      lfoDepth.gain.value = recipe.volume * 0.35;
      lfo.connect(lfoDepth);
      lfoDepth.connect(voice.gain);

      osc.connect(voice);
      voice.connect(filter);
      osc.start();
      lfo.start();
      nodes.push({ osc, lfo });
    });

    const target = muted ? 0 : 1;
    master.gain.setTargetAtTime(target, context.currentTime, 0.8);
    const resume = () => {
      if (context.state === "suspended") void context.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", resume, { once: true });
    window.addEventListener("keydown", resume, { once: true });

    return () => {
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
      nodes.forEach(({ osc, lfo }) => {
        try {
          osc.stop();
          lfo.stop();
        } catch {
          // Already stopped by a fast setting change.
        }
      });
      masterRef.current = null;
      contextRef.current = null;
      void context.close().catch(() => {});
    };
    // The mute state is applied in its own effect so toggling it does not
    // rebuild the synth and click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bed]);

  useEffect(() => {
    const master = masterRef.current;
    const context = contextRef.current;
    if (!master || !context) return;
    master.gain.setTargetAtTime(muted ? 0 : 1, context.currentTime, 0.35);
  }, [muted]);

  return null;
}
