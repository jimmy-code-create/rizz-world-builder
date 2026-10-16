import { useCallback, useEffect, useRef, useState } from "react";
import {
  CHATSTORY_TTS_ENDPOINT,
  CHATSTORY_TTS_TIMEOUT_MS,
  chatStoryTTSCacheKey,
  type ChatStorySpeechPayload,
  type ChatStoryTTSLanguage,
} from "@/lib/chatstory-tts";

type SpeechSynthesisWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

const MAX_CACHED_LINES = 60;

/**
 * Optional server narration for Hindi / Hinglish chat-story lines.
 *
 * - POSTs to the same-origin `/api/chatstory-speech` (no secret in the
 *   browser; the server token stays server-side). Responses are base64 audio.
 * - 15 s timeout per line, in-memory cache per (language, voice, speed,
 *   text) so a replayed line keeps the same voice without refetching.
 * - Any failure (503 not-configured, 429, timeout, decode error) resolves
 *   `false` so the caller falls back to Kokoro / device speech. Errors are
 *   generic on purpose: they must never contain tokens or upstream URLs.
 */
export function useChatStoryTTS() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const cacheRef = useRef(new Map<string, ArrayBuffer>());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      try {
        sourceRef.current?.stop();
      } catch {
        // Already stopped; nothing to do.
      }
      sourceRef.current = null;
      void audioContextRef.current?.close().catch(() => undefined);
      audioContextRef.current = null;
    };
  }, []);

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
      // Device-speech fallback works without Web Audio.
    }
  }, [getAudioContext]);

  const playBuffer = useCallback(
    async (bytes: ArrayBuffer, volume = 1) => {
      const context = getAudioContext();
      if (context.state === "suspended") await context.resume();
      const decoded = await context.decodeAudioData(bytes.slice(0));
      const source = context.createBufferSource();
      const gain = context.createGain();
      gain.gain.value = Math.min(1, Math.max(0.05, volume));
      source.buffer = decoded;
      source.connect(gain);
      gain.connect(context.destination);
      sourceRef.current = source;
      await new Promise<void>((resolve, reject) => {
        source.onended = () => {
          if (sourceRef.current === source) sourceRef.current = null;
          resolve();
        };
        try {
          source.start();
        } catch (startError) {
          if (sourceRef.current === source) sourceRef.current = null;
          reject(startError);
        }
      });
    },
    [getAudioContext],
  );

  const base64ToBuffer = useCallback((base64: string): ArrayBuffer | null => {
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return bytes.buffer;
    } catch {
      return null;
    }
  }, []);

  const speakViaServer = useCallback(
    async (
      payload: ChatStorySpeechPayload & { language: ChatStoryTTSLanguage },
      options: { volume?: number } = {},
    ): Promise<boolean> => {
      const key = chatStoryTTSCacheKey(payload);
      const cached = cacheRef.current.get(key);
      if (cached) {
        try {
          setError(null);
          await playBuffer(cached, options.volume ?? 1);
          return true;
        } catch {
          cacheRef.current.delete(key);
        }
      }

      if (mountedRef.current) {
        setIsLoading(true);
        setError(null);
      }
      try {
        const response = await fetch(CHATSTORY_TTS_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(CHATSTORY_TTS_TIMEOUT_MS),
        });
        if (!response.ok) {
          if (mountedRef.current) {
            setIsLoading(false);
            if (response.status !== 503 && response.status !== 429) {
              setError("The Hindi HD voice isn't available right now.");
            }
          }
          return false;
        }
        const data: unknown = await response.json().catch(() => null);
        const audio = (data as { audio?: unknown } | null)?.audio;
        if (typeof audio !== "string" || audio.length < 16) return false;
        const buffer = base64ToBuffer(audio);
        if (!buffer) return false;
        if (cacheRef.current.size >= MAX_CACHED_LINES) {
          const oldest = cacheRef.current.keys().next().value as string | undefined;
          if (oldest) cacheRef.current.delete(oldest);
        }
        cacheRef.current.set(key, buffer.slice(0));
        await playBuffer(buffer, options.volume ?? 1);
        return true;
      } catch {
        if (mountedRef.current) setError("The Hindi HD voice isn't available right now.");
        return false;
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    },
    [base64ToBuffer, playBuffer],
  );

  const stop = useCallback(() => {
    try {
      sourceRef.current?.stop();
    } catch {
      // Already stopped.
    }
    sourceRef.current = null;
  }, []);

  return { speakViaServer, stop, unlockAudio, isLoading, error };
}
