import { useCallback, useEffect, useRef, useState } from "react";

import type { RizzCoachEmotion, RizzCoachState } from "./RizzCoachView";

type SessionTurn = { role: "user" | "model"; text: string };
type SpeechAlternative = { transcript: string };
type SpeechResult = { isFinal: boolean; 0: SpeechAlternative };
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
};
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type CoachReply = { emotion: RizzCoachEmotion; text: string };
type SpeechPreset = { pitch: number; rate: number };

const speechPresets: Record<RizzCoachEmotion, SpeechPreset> = {
  playful: { pitch: 1.3, rate: 1.1 },
  warm: { pitch: 1.1, rate: 0.95 },
  excited: { pitch: 1.4, rate: 1.2 },
  teasing: { pitch: 1.2, rate: 1.0 },
  calm: { pitch: 0.9, rate: 0.9 },
  surprised: { pitch: 1.5, rate: 1.15 },
};

function getRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  const browserWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
}

function countSentences(text: string): number {
  return (text.match(/[^.!?]+(?:[.!?]+|$)/g) ?? []).filter((part) => part.trim()).length;
}

async function postCoachRequest<T>(payload: unknown): Promise<T> {
  const response = await fetch("/api/rizz-coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || !result) {
    throw new Error(
      result && "error" in result ? result.error : "The coach couldn't connect right now.",
    );
  }
  return result;
}

export function useRizzCoach() {
  const [state, setState] = useState<RizzCoachState>("idle");
  const [emotion, setEmotion] = useState<RizzCoachEmotion>("warm");
  const [heardCaption, setHeardCaption] = useState("");
  const [replyCaption, setReplyCaption] = useState("");
  const [statusMessage, setStatusMessage] = useState<string>();
  const [micLevel, setMicLevel] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const activeRef = useRef(false);
  const pausedRef = useRef(false);
  const pendingTranscriptRef = useRef("");
  const sessionContextRef = useRef<SessionTurn[]>([]);
  const replyRef = useRef<(transcript: string) => Promise<void>>(async () => {});
  const debounceRef = useRef<number | undefined>(undefined);
  const heardTimerRef = useRef<number | undefined>(undefined);
  const replyTimerRef = useRef<number | undefined>(undefined);
  const outputTokenRef = useRef(0);
  const audioRef = useRef<{ audio: HTMLAudioElement; url: string } | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

  const clearAudio = useCallback(() => {
    const current = audioRef.current;
    if (!current) return;
    current.audio.pause();
    current.audio.removeAttribute("src");
    URL.revokeObjectURL(current.url);
    audioRef.current = null;
  }, []);

  const stopMicrophoneVisualizer = useCallback(() => {
    if (animationFrameRef.current !== undefined) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    setMicLevel(0);
  }, []);

  const startMicrophoneVisualizer = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!activeRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      micStreamRef.current = stream;
      audioContextRef.current = context;

      const sampleLevel = () => {
        analyser.getByteTimeDomainData(samples);
        let energy = 0;
        for (const sample of samples) {
          const normalized = (sample - 128) / 128;
          energy += normalized * normalized;
        }
        if (!pausedRef.current && activeRef.current) {
          setMicLevel(Math.min(1, Math.sqrt(energy / samples.length) * 5.5));
        }
        animationFrameRef.current = requestAnimationFrame(sampleLevel);
      };
      animationFrameRef.current = requestAnimationFrame(sampleLevel);
    } catch {
      // SpeechRecognition still works if the optional ripple visualizer is unavailable.
    }
  }, []);

  const startRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || !activeRef.current || pausedRef.current) return;
    try {
      recognition.start();
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "InvalidStateError")) {
        setStatusMessage("I couldn't start the mic. Check its permission and tap to try again.");
      }
    }
  }, []);

  const resumeListening = useCallback(() => {
    if (!activeRef.current) return;
    pausedRef.current = false;
    setState("listening");
    setStatusMessage(undefined);
    startRecognition();
  }, [startRecognition]);

  const speakWithBrowser = useCallback(
    (text: string, replyEmotion: RizzCoachEmotion, token: number) => {
      if (!("speechSynthesis" in window)) {
        resumeListening();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      const preset = speechPresets[replyEmotion];
      utterance.pitch = preset.pitch;
      utterance.rate = preset.rate;
      utterance.lang = "en-US";
      utterance.onend = () => {
        if (token === outputTokenRef.current) resumeListening();
      };
      utterance.onerror = () => {
        if (token === outputTokenRef.current) resumeListening();
      };
      setState("speaking");
      window.speechSynthesis.speak(utterance);
    },
    [resumeListening],
  );

  const playReply = useCallback(
    async (reply: CoachReply) => {
      const token = ++outputTokenRef.current;
      setEmotion(reply.emotion);
      setReplyCaption(reply.text);
      if (replyTimerRef.current !== undefined) window.clearTimeout(replyTimerRef.current);
      replyTimerRef.current = window.setTimeout(() => setReplyCaption(""), 8_000);

      if (countSentences(reply.text) > 2) {
        speakWithBrowser(reply.text, reply.emotion, token);
        return;
      }

      try {
        const result = await postCoachRequest<{ audio: string; mimeType: string }>({
          mode: "speech",
          text: reply.text,
          emotion: reply.emotion,
        });
        if (token !== outputTokenRef.current || !activeRef.current) return;

        const binary = atob(result.audio);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        const url = URL.createObjectURL(
          new Blob([bytes], { type: result.mimeType || "audio/wav" }),
        );
        const audio = new Audio(url);
        audioRef.current = { audio, url };
        audio.onended = () => {
          if (token !== outputTokenRef.current) return;
          clearAudio();
          resumeListening();
        };
        audio.onerror = () => {
          if (token !== outputTokenRef.current) return;
          clearAudio();
          speakWithBrowser(reply.text, reply.emotion, token);
        };
        await audio.play();
        if (token === outputTokenRef.current) setState("speaking");
      } catch {
        if (token === outputTokenRef.current) {
          clearAudio();
          speakWithBrowser(reply.text, reply.emotion, token);
        }
      }
    },
    [clearAudio, resumeListening, speakWithBrowser],
  );

  const processTranscript = useCallback(
    async (transcript: string) => {
      setHeardCaption(transcript);
      if (heardTimerRef.current !== undefined) window.clearTimeout(heardTimerRef.current);
      heardTimerRef.current = window.setTimeout(() => setHeardCaption(""), 8_000);
      setReplyCaption("");
      setStatusMessage(undefined);
      setState("thinking");
      pausedRef.current = true;
      setMicLevel(0);
      try {
        recognitionRef.current?.stop();
      } catch {
        // Recognition may already have ended.
      }

      try {
        const reply = await postCoachRequest<CoachReply>({
          mode: "reply",
          message: transcript,
          context: sessionContextRef.current.slice(-6),
        });
        if (!activeRef.current) return;
        sessionContextRef.current.push(
          { role: "user", text: transcript },
          { role: "model", text: reply.text },
        );
        sessionContextRef.current = sessionContextRef.current.slice(-8);
        await playReply(reply);
      } catch (error) {
        if (!activeRef.current) return;
        const message =
          error instanceof Error ? error.message : "The coach couldn't connect right now.";
        setStatusMessage(message);
        setState("idle");
        pausedRef.current = true;
        activeRef.current = false;
        stopMicrophoneVisualizer();
      }
    },
    [playReply, stopMicrophoneVisualizer],
  );

  replyRef.current = processTranscript;

  useEffect(() => {
    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      setStatusMessage("Voice input works best in a browser with speech recognition.");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) {
          pendingTranscriptRef.current += `${result[0].transcript} `;
        } else {
          interim += result[0].transcript;
        }
      }

      const visibleTranscript = `${pendingTranscriptRef.current} ${interim}`.trim();
      if (visibleTranscript) setHeardCaption(visibleTranscript);

      if (pendingTranscriptRef.current.trim()) {
        if (debounceRef.current !== undefined) window.clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(() => {
          const finalTranscript = pendingTranscriptRef.current.trim();
          pendingTranscriptRef.current = "";
          if (!finalTranscript || !activeRef.current) return;
          void replyRef.current(finalTranscript);
        }, 900);
      }
    };
    recognition.onend = () => {
      if (activeRef.current && !pausedRef.current) startRecognition();
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        activeRef.current = false;
        pausedRef.current = true;
        setState("idle");
        setStatusMessage("Allow mic access, then tap the glow to try again.");
        stopMicrophoneVisualizer();
      } else {
        setStatusMessage("I lost the mic for a moment. Checking again…");
      }
    };
    recognitionRef.current = recognition;

    return () => {
      activeRef.current = false;
      pausedRef.current = true;
      if (debounceRef.current !== undefined) window.clearTimeout(debounceRef.current);
      if (heardTimerRef.current !== undefined) window.clearTimeout(heardTimerRef.current);
      if (replyTimerRef.current !== undefined) window.clearTimeout(replyTimerRef.current);
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      try {
        recognition.abort();
      } catch {
        // The page is already closing.
      }
      window.speechSynthesis?.cancel();
      clearAudio();
      stopMicrophoneVisualizer();
    };
  }, [clearAudio, startRecognition, stopMicrophoneVisualizer]);

  const onOrbClick = useCallback(() => {
    if (state === "speaking") {
      outputTokenRef.current += 1;
      window.speechSynthesis?.cancel();
      clearAudio();
      resumeListening();
      return;
    }
    if (state !== "idle" || !recognitionRef.current) return;

    activeRef.current = true;
    pausedRef.current = false;
    pendingTranscriptRef.current = "";
    sessionContextRef.current = [];
    setHeardCaption("");
    setReplyCaption("");
    setStatusMessage(undefined);
    setEmotion("warm");
    setState("listening");
    startRecognition();
    void startMicrophoneVisualizer();
  }, [clearAudio, resumeListening, startMicrophoneVisualizer, startRecognition, state]);

  return { state, emotion, heardCaption, replyCaption, statusMessage, micLevel, onOrbClick };
}
