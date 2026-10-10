import { useCallback, useEffect, useRef, useState } from "react";

type WorkerReply =
  | { status: "progress"; progress: number }
  | { status: "loading"; backend: "webgpu" | "wasm" }
  | { status: "ready"; backend: "webgpu" | "wasm" }
  | { status: "audio"; requestId: number; audio: Float32Array; samplingRate: number }
  | { status: "error"; requestId?: number; message: string };

type PendingRequest = {
  requestId: number;
  resolve: (result: { audio: Float32Array; samplingRate: number }) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type SpeechSynthesisWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

const WORKER_TIMEOUT_MS = 180_000;

export function useKokoroTTS() {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentAudioData, setCurrentAudioData] = useState<Float32Array | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<PendingRequest | null>(null);
  const requestIdRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const clearPending = useCallback(() => {
    if (pendingRef.current) {
      clearTimeout(pendingRef.current.timeout);
      pendingRef.current = null;
    }
  }, []);

  const handleWorkerMessage = useCallback((event: MessageEvent<WorkerReply>) => {
    const message = event.data;
    if (message.status === "progress") {
      setIsLoading(true);
      setLoadingProgress(message.progress);
      return;
    }
    if (message.status === "loading") {
      setIsLoading(true);
      setLoadingProgress(0);
      return;
    }
    if (message.status === "ready") {
      setIsReady(true);
      setIsLoading(false);
      setLoadingProgress(100);
      return;
    }

    const pending = pendingRef.current;
    if (message.status === "audio" && pending?.requestId === message.requestId) {
      clearPending();
      pending.resolve({ audio: message.audio, samplingRate: message.samplingRate });
      return;
    }
    if (message.status === "error" && pending && (!message.requestId || pending.requestId === message.requestId)) {
      clearPending();
      setIsLoading(false);
      pending.reject(new Error(message.message));
    }
  }, [clearPending]);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(new URL("../workers/tts.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = handleWorkerMessage;
    worker.onerror = (event) => {
      setIsLoading(false);
      const pending = pendingRef.current;
      if (pending) {
        clearPending();
        pending.reject(new Error(event.message || "The speech worker stopped unexpectedly."));
      }
      worker.terminate();
      workerRef.current = null;
    };
    workerRef.current = worker;
    return worker;
  }, [clearPending, handleWorkerMessage]);

  const getAudioContext = useCallback(() => {
    if (audioContextRef.current) return audioContextRef.current;
    const audioWindow = window as SpeechSynthesisWindow;
    const AudioContextConstructor = window.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioContextConstructor) throw new Error("Web Audio is not available in this browser.");
    const context = new AudioContextConstructor();
    audioContextRef.current = context;
    return context;
  }, []);

  const unlockAudio = useCallback(() => {
    try {
      const context = getAudioContext();
      if (context.state === "suspended") void context.resume();
    } catch {
      // The built-in speech synthesis fallback can still work without Web Audio.
    }
  }, [getAudioContext]);

  const updateAudioLevel = useCallback((analyser: AnalyserNode) => {
    const samples = new Uint8Array(analyser.fftSize);
    const sample = () => {
      analyser.getByteTimeDomainData(samples);
      let energy = 0;
      for (const value of samples) {
        const normalized = (value - 128) / 128;
        energy += normalized * normalized;
      }
      setAudioLevel(Math.min(1, Math.sqrt(energy / samples.length) * 4));
      animationRef.current = requestAnimationFrame(sample);
    };
    sample();
  }, []);

  const playGeneratedAudio = useCallback(async (audio: Float32Array, samplingRate: number) => {
    const context = getAudioContext();
    if (context.state === "suspended") await context.resume();
    const buffer = context.createBuffer(1, audio.length, samplingRate);
    buffer.copyToChannel(new Float32Array(audio), 0);

    const source = context.createBufferSource();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    source.buffer = buffer;
    source.connect(analyser);
    analyser.connect(context.destination);
    sourceRef.current = source;
    updateAudioLevel(analyser);

    await new Promise<void>((resolve, reject) => {
      source.onended = () => {
        if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
        sourceRef.current = null;
        setAudioLevel(0);
        resolve();
      };
      try {
        source.start();
      } catch (playError) {
        sourceRef.current = null;
        if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
        setAudioLevel(0);
        reject(playError);
      }
    });
  }, [getAudioContext, updateAudioLevel]);

  const playBrowserVoice = useCallback((text: string) => new Promise<void>((resolve, reject) => {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      reject(new Error("Neither Kokoro nor browser speech synthesis is available."));
      return;
    }

    const synthesis = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    const selectVoice = () => {
      const voices = synthesis.getVoices();
      const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
      return englishVoices.find((voice) => /natural|enhanced|premium/i.test(voice.name))
        ?? englishVoices.find((voice) => /female|woman/i.test(voice.name))
        ?? englishVoices[0]
        ?? voices[0];
    };
    const voice = selectVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 0.96;
    utterance.pitch = 1.04;
    utterance.onend = () => resolve();
    utterance.onerror = (event) => reject(new Error(`Browser speech could not play (${event.error}).`));
    synthesis.cancel();
    synthesis.speak(utterance);
  }), []);

  const speak = useCallback(async (text: string, voice: "af_bella" = "af_bella") => {
    const trimmedText = text.trim();
    if (!trimmedText) return false;
    setError(null);
    setIsSpeaking(true);
    setIsLoading(false);
    setLoadingProgress(0);

    try {
      const worker = ensureWorker();
      const requestId = ++requestIdRef.current;
      const generated = await new Promise<{ audio: Float32Array; samplingRate: number }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (pendingRef.current?.requestId !== requestId) return;
          clearPending();
          worker.terminate();
          workerRef.current = null;
          reject(new Error("Kokoro took too long to respond."));
        }, WORKER_TIMEOUT_MS);
        pendingRef.current = { requestId, resolve, reject, timeout };
        setIsLoading(true);
        worker.postMessage({ action: "speak", requestId, text: trimmedText, voice });
      });
      setCurrentAudioData(generated.audio);
      setIsLoading(false);
      setIsReady(true);
      await playGeneratedAudio(generated.audio, generated.samplingRate);
    } catch (kokoroError) {
      setIsLoading(false);
      if (!mountedRef.current) return false;
      try {
        await playBrowserVoice(trimmedText);
        setIsReady(true);
      } catch (fallbackError) {
        const message = fallbackError instanceof Error
          ? fallbackError.message
          : kokoroError instanceof Error ? kokoroError.message : "Speech playback failed.";
        setError(message);
        return false;
      }
    } finally {
      if (mountedRef.current) {
        setIsSpeaking(false);
        setAudioLevel(0);
      }
    }
    return true;
  }, [clearPending, ensureWorker, playBrowserVoice, playGeneratedAudio]);

  const stopSpeaking = useCallback(() => {
    sourceRef.current?.stop();
    sourceRef.current = null;
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setAudioLevel(0);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearPending();
      workerRef.current?.terminate();
      workerRef.current = null;
      sourceRef.current?.stop();
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      void audioContextRef.current?.close();
    };
  }, [clearPending]);

  return {
    isReady,
    isLoading,
    loadingProgress,
    isSpeaking,
    currentAudioData,
    audioLevel,
    error,
    speak,
    stopSpeaking,
    unlockAudio,
  };
}
