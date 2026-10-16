import { KokoroTTS, type GenerateOptions } from "kokoro-js";
import { env } from "@huggingface/transformers";

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
type KokoroVoice = NonNullable<GenerateOptions["voice"]>;
type WorkerRequest =
  | { action: "load" }
  | { action: "speak"; requestId: number; text: string; voice: KokoroVoice; speed?: number };
type WorkerResponse =
  | { status: "progress"; progress: number }
  | { status: "loading"; backend: "webgpu" | "wasm" }
  | { status: "ready"; backend: "webgpu" | "wasm" }
  | { status: "audio"; requestId: number; audio: Float32Array; samplingRate: number }
  | { status: "error"; requestId?: number; message: string };

/**
 * Kokoro tokenizes with truncation on, so anything past ~500 phoneme tokens is
 * silently dropped. Long story messages must be spoken in sentence-sized
 * chunks that are generated separately and stitched back together.
 */
const MAX_CHUNK_CHARS = 220;
const CHUNK_GAP_MS = 110;

const worker = self as unknown as {
  postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  addEventListener(type: "messageerror", listener: EventListener): void;
};
let synthesizer: KokoroTTS | null = null;
let loadPromise: Promise<KokoroTTS> | null = null;

function post(message: WorkerResponse, transfer?: Transferable[]) {
  worker.postMessage(message, transfer ?? []);
}

/**
 * Splits text into speech-sized chunks: whole sentences first, then word
 * wrapping for any single sentence longer than the budget.
 */
function splitForSpeech(raw: string): string[] {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return [];
  if (text.length <= MAX_CHUNK_CHARS) return [text];

  const sentences = text.match(/[^.!?…]+[.!?…]+["')\]]*\s*|[^.!?…]+$/g) ?? [text];
  const chunks: string[] = [];
  let current = "";

  const pushWord = (word: string) => {
    if (word.length > MAX_CHUNK_CHARS) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      chunks.push(word);
      return;
    }
    if (current && current.length + 1 + word.length > MAX_CHUNK_CHARS) {
      chunks.push(current);
      current = word;
      return;
    }
    current = current ? `${current} ${word}` : word;
  };

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    if (trimmed.length > MAX_CHUNK_CHARS) {
      for (const word of trimmed.split(" ")) pushWord(word);
      continue;
    }
    if (current && current.length + 1 + trimmed.length > MAX_CHUNK_CHARS) {
      chunks.push(current);
      current = trimmed;
      continue;
    }
    current = current ? `${current} ${trimmed}` : trimmed;
  }
  if (current) chunks.push(current);
  return chunks;
}

async function loadKokoro(requestId: number): Promise<KokoroTTS> {
  if (synthesizer) return synthesizer;
  if (loadPromise) return loadPromise;

  env.allowLocalModels = false;
  env.useBrowserCache = true;

  const progress_callback = (info: { status: string; progress?: number }) => {
    if (
      (info.status === "progress" || info.status === "progress_total") &&
      typeof info.progress === "number"
    ) {
      post({ status: "progress", progress: Math.max(0, Math.min(100, info.progress)) });
    }
  };

  loadPromise = (async () => {
    const supportsWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;
    const backends: Array<"webgpu" | "wasm"> = supportsWebGPU ? ["webgpu", "wasm"] : ["wasm"];
    let lastError: unknown;

    for (const backend of backends) {
      post({ status: "loading", backend });
      try {
        // Kokoro-JS provides the Kokoro-specific frontend on top of Transformers.js.
        // The current generic Transformers.js pipeline registry does not register this model architecture.
        const loaded = await KokoroTTS.from_pretrained(MODEL_ID, {
          device: backend,
          dtype: backend === "webgpu" ? "fp32" : "q8",
          progress_callback,
        });
        post({ status: "ready", backend });
        return loaded;
      } catch (error) {
        lastError = error;
        console.warn(`Kokoro failed to initialize on ${backend}`, error);
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Kokoro could not initialize.");
  })();

  try {
    synthesizer = await loadPromise;
    return synthesizer;
  } catch (error) {
    loadPromise = null;
    post({
      status: "error",
      requestId,
      message: error instanceof Error ? error.message : "Kokoro could not initialize.",
    });
    throw error;
  }
}

worker.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  if (request.action === "load") {
    try {
      await loadKokoro(0);
    } catch {
      // loadKokoro already posted the error; the caller falls back to device voices.
    }
    return;
  }
  if (request.action !== "speak") return;

  try {
    const model = await loadKokoro(request.requestId);
    const speed = Math.min(2, Math.max(0.5, request.speed ?? 1));

    const chunks = splitForSpeech(request.text);
    if (chunks.length === 0) throw new Error("Nothing to speak.");

    let audio: Float32Array | null = null;
    let samplingRate = 24000;
    let gapSamples = 0;

    for (const chunk of chunks) {
      const output = await model.generate(chunk, { voice: request.voice, speed });
      const part = new Float32Array(output.audio);
      samplingRate = output.sampling_rate;
      if (gapSamples === 0) gapSamples = Math.round((CHUNK_GAP_MS / 1000) * samplingRate);
      if (!audio) {
        audio = part;
        continue;
      }
      // Stitch chunks with a small breath so the seams sound human.
      const previous: Float32Array = audio;
      const merged = new Float32Array(previous.length + gapSamples + part.length);
      merged.set(previous, 0);
      merged.set(part, previous.length + gapSamples);
      audio = merged;
    }

    if (!audio) throw new Error("Kokoro did not return audio.");
    post(
      {
        status: "audio",
        requestId: request.requestId,
        audio,
        samplingRate,
      },
      [audio.buffer as ArrayBuffer],
    );
  } catch (error) {
    post({
      status: "error",
      requestId: request.requestId,
      message: error instanceof Error ? error.message : "Kokoro speech generation failed.",
    });
  }
};

worker.addEventListener("messageerror", () => {
  post({ status: "error", message: "The speech worker could not read its request." });
});
