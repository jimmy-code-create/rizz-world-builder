/**
 * Voice cleanup AudioWorklet for calls.
 *
 * The brief asked for RNNoise compiled to WASM. There is no network access in
 * this workspace to fetch that binary (and no npm registry), so this worklet
 * implements the same *shape* of processing without the voice model: a
 * per-block RMS noise gate with smooth attack/release plus a one-pole high-pass
 * to strip low rumble. It is deliberately conservative — quiet speech stays
 * audible instead of being gated away, and the gain never drops to silence.
 *
 * Registered as "rizz-voice-cleanup". See src/lib/audio-denoise.ts for the
 * fallback chain used when AudioWorklet is unavailable.
 */
class RizzVoiceCleanup extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    // Gate threshold in RMS. Defaults sit just above typical room noise so a
    // normal speaking voice stays open.
    this.threshold = typeof opts.threshold === "number" ? opts.threshold : 0.012;
    // Gain floor: never fully mute, that is what causes "walkie-talkie" pumping.
    this.floorGain = typeof opts.floorGain === "number" ? opts.floorGain : 0.35;
    this.gain = 1;
    this.attack = 0.25; // opening is fast so words are not clipped
    this.release = 0.035; // closing is slow so tail consonants survive
    this.previousInput = 0;
    this.previousOutput = 0;
    this.highPassCoefficient = 0.93; // ~90 Hz at 48 kHz sample rate
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;

    const channelCount = Math.min(input.length, output.length);
    for (let channel = 0; channel < channelCount; channel += 1) {
      const source = input[channel];
      const target = output[channel];
      if (!source || !target) continue;

      let sum = 0;
      for (let i = 0; i < source.length; i += 1) sum += source[i] * source[i];
      const rms = Math.sqrt(sum / source.length);
      const targetGain = rms >= this.threshold ? 1 : this.floorGain;
      const smoothing = targetGain > this.gain ? this.attack : this.release;

      for (let i = 0; i < source.length; i += 1) {
        this.gain += (targetGain - this.gain) * smoothing;
        // One-pole high-pass: removes desk thumps and air-conditioning rumble.
        const filtered = this.highPassCoefficient * (this.previousOutput + source[i] - this.previousInput);
        this.previousInput = source[i];
        this.previousOutput = filtered;
        target[i] = filtered * this.gain;
      }
    }

    return true;
  }
}

registerProcessor("rizz-voice-cleanup", RizzVoiceCleanup);
