import { KokoroTTS } from "kokoro-js";
import { env } from "@huggingface/transformers";

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
type VoiceId = "af_bella";
type WorkerRequest =
  | { action: "speak"; requestId: number; text: string; voice: VoiceId };
type WorkerResponse =
  | { status: "progress"; progress: number }
  | { status: "loading"; backend: "webgpu" | "wasm" }
  | { status: "ready"; backend: "webgpu" | "wasm" }
  | { status: "audio"; requestId: number; audio: Float32Array; samplingRate: number }
  | { status: "error"; requestId?: number; message: string };

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

async function loadKokoro(requestId: number): Promise<KokoroTTS> {
  if (synthesizer) return synthesizer;
  if (loadPromise) return loadPromise;

  env.allowLocalModels = false;
  env.useBrowserCache = true;

  const progress_callback = (info: { status: string; progress?: number }) => {
    if ((info.status === "progress" || info.status === "progress_total") && typeof info.progress === "number") {
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
  if (request.action !== "speak") return;

  try {
    const model = await loadKokoro(request.requestId);
    const output = await model.generate(request.text, { voice: request.voice });
    const audio = new Float32Array(output.audio);
    post(
      {
        status: "audio",
        requestId: request.requestId,
        audio,
        samplingRate: output.sampling_rate,
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

