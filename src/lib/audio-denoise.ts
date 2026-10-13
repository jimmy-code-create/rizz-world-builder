/**
 * Voice cleanup for calls.
 *
 * Preferred path: an AudioWorklet (`/audio/denoise-worklet.js`) that gates
 * background noise and high-passes rumble. The brief specified RNNoise compiled
 * to WASM; this workspace has no network access to fetch that binary, so the
 * worklet implements a conservative gate + filter instead. It is honest about
 * being lighter than a real speech model: quiet speech stays audible, the gain
 * never drops to silence, and if anything fails we fall back to a Web Audio
 * filter chain, then to the raw microphone track.
 *
 * The processed track replaces the microphone on the live sender, so toggling
 * "Enhanced noise cancellation" never restarts the call.
 */
export type VoiceProcessor = {
  /** Track to publish on the call (processed when possible, raw otherwise). */
  track: MediaStreamTrack;
  /** Turns the extra cleanup on/off; resolves to the mode actually in effect. */
  setEnhanced: (enabled: boolean) => Promise<"worklet" | "filters" | "off">;
  /** True once the worklet path is live, so the UI can label it honestly. */
  usesWorklet: () => boolean;
  dispose: () => void;
};

const WORKLET_URL = "/audio/denoise-worklet.js";

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Builds the always-on chain: rumble filter, presence boost, gentle limiter. */
function buildFilterChain(context: AudioContext, source: MediaStreamAudioSourceNode, destination: MediaStreamAudioDestinationNode) {
  const highPass = context.createBiquadFilter();
  highPass.type = "highpass";
  highPass.frequency.value = 90;
  highPass.Q.value = 0.7;

  const lowPass = context.createBiquadFilter();
  lowPass.type = "lowpass";
  lowPass.frequency.value = 7600;

  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -28;
  compressor.knee.value = 12;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;

  source.connect(highPass);
  highPass.connect(lowPass);
  lowPass.connect(compressor);
  return { input: highPass, output: compressor, nodes: [highPass, lowPass, compressor] as AudioNode[] };
}

export async function createVoiceProcessor(micStream: MediaStream): Promise<VoiceProcessor> {
  const originalTrack = micStream.getAudioTracks()[0];
  if (!originalTrack) throw new Error("No microphone track to process.");

  const AudioContextCtor = getAudioContextConstructor();
  if (!AudioContextCtor || typeof MediaStreamAudioDestinationNode === "undefined") {
    // Nothing to do — publish the microphone exactly as captured.
    return {
      track: originalTrack,
      setEnhanced: async () => "off",
      usesWorklet: () => false,
      dispose: () => {},
    };
  }

  const context = new AudioContextCtor();
  const source = context.createMediaStreamSource(micStream);
  const destination = context.createMediaStreamDestination();
  const chain = buildFilterChain(context, source, destination);

  // Try the worklet gate on top of the filter chain; a failure here is normal on
  // older Safari and simply means "filters only".
  let gateNode: AudioWorkletNode | null = null;
  try {
    await context.audioWorklet.addModule(WORKLET_URL);
    gateNode = new AudioWorkletNode(context, "rizz-voice-cleanup");
    chain.input.disconnect();
    chain.input.connect(gateNode);
    gateNode.connect(chain.output);
    gateNode.port.onmessageerror = () => console.debug("Voice cleanup worklet message error");
  } catch (error) {
    console.debug("Voice cleanup worklet unavailable; using filter chain only", error);
    gateNode = null;
  }

  chain.output.connect(destination);

  // A muted/disabled input would silence the call, so always publish live audio.
  const processedTrack = destination.stream.getAudioTracks()[0];
  if (!processedTrack) {
    void context.close().catch(() => {});
    return {
      track: originalTrack,
      setEnhanced: async () => "off",
      usesWorklet: () => false,
      dispose: () => {},
    };
  }

  let enhanced = false;
  let disposed = false;

  const applyGate = () => {
    // Bypass while "enhanced" is off: unity gain through the worklet would still
    // cost a little latency, so the gate is simply not in the signal path.
    if (!gateNode) return;
    chain.input.disconnect();
    if (enhanced) {
      chain.input.connect(gateNode);
      gateNode.connect(chain.output);
    } else {
      chain.input.connect(chain.output);
    }
  };

  if (context.state === "suspended") {
    await context.resume().catch(() => {});
  }

  return {
    track: processedTrack,
    setEnhanced: async (next: boolean) => {
      if (disposed) return "off";
      enhanced = next;
      applyGate();
      if (context.state === "suspended") await context.resume().catch(() => {});
      if (!enhanced) return "filters";
      return gateNode ? "worklet" : "filters";
    },
    usesWorklet: () => Boolean(gateNode),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      try {
        gateNode?.disconnect();
        chain.nodes.forEach((node) => node.disconnect());
        source.disconnect();
        destination.disconnect();
      } catch (error) {
        console.debug("Voice cleanup teardown skipped a node", error);
      }
      void context.close().catch(() => {});
      processedTrack.stop();
    },
  };
}
