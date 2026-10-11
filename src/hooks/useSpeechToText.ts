import { useCallback, useEffect, useRef, useState } from "react";

type SpeechAlternative = { transcript: string };
type SpeechResult = { isFinal: boolean; length: number; [index: number]: SpeechAlternative };
type SpeechResultList = { length: number; [index: number]: SpeechResult };
type SpeechRecognitionResultEvent = { resultIndex: number; results: SpeechResultList };
type SpeechRecognitionErrorEvent = { error: string };

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
};

type UseSpeechToTextOptions = {
  /** Keep the session alive across browser auto-ends. */
  continuousConversation?: boolean;
  /** End-of-speech silence window before a phrase is finalized (ms). */
  endOfSpeechMs?: number;
  /** Auto-stop the session after this much total silence (ms, default 5 min). */
  maxSilenceMs?: number;
  /** Called when a full user utterance is complete (after the silence window). */
  onUtterance?: (text: string) => void;
};

/**
 * Continuous speech recognition:
 * - One start() keeps listening for minutes; the browser's silent auto-ends are
 *   restarted instantly (no audible gap).
 * - A phrase is only finalized after `endOfSpeechMs` (default 1.8s) of silence,
 *   so the user is never cut off mid-sentence.
 * - The whole session auto-stops after `maxSilenceMs` (default 5 minutes).
 * - Exposes pause()/resume() so the owner can mute the mic while TTS speaks.
 */
export function useSpeechToText({
  continuousConversation = true,
  endOfSpeechMs = 1800,
  maxSilenceMs = 5 * 60 * 1000,
  onUtterance,
}: UseSpeechToTextOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const wantsListeningRef = useRef(false);
  const pausedRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleDeadlineRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPhraseRef = useRef("");
  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;

  const clearTimer = (ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) => {
    if (ref.current) clearTimeout(ref.current);
    ref.current = null;
  };

  const resetIdleDeadline = useCallback(() => {
    clearTimer(idleDeadlineRef);
    idleDeadlineRef.current = setTimeout(() => {
      // Five minutes with no voice activity — end the session entirely.
      wantsListeningRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch {
        recognitionRef.current?.abort();
      }
      setIsListening(false);
    }, maxSilenceMs);
  }, [maxSilenceMs]);

  const commitUtterance = useCallback(() => {
    const phrase = pendingPhraseRef.current.trim();
    pendingPhraseRef.current = "";
    if (!phrase) return;
    setTranscript((current) => `${current} ${phrase}`.trim());
    setFinalTranscript(phrase);
    onUtteranceRef.current?.(phrase);
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const speechWindow = window as SpeechRecognitionWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Speech recognition is not supported here. Try Chrome or Safari.");
      return;
    }

    clearTimer(restartTimerRef);
    setError(null);
    pausedRef.current = false;
    wantsListeningRef.current = true;
    resetIdleDeadline();

    if (!recognitionRef.current) {
      const recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-IN";
      recognition.onresult = (event) => {
        resetIdleDeadline();
        let interim = "";
        let finalized = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (!result) continue;
          const phrase = result[0]?.transcript?.trim() ?? "";
          if (result.isFinal) finalized += `${phrase} `;
          else interim += `${phrase} `;
        }
        // Accumulate everything into the pending phrase; only flush it to the
        // owner after endOfSpeechMs of silence (see silenceTimer below).
        const heard = `${finalized} ${interim}`.trim();
        if (heard) {
          pendingPhraseRef.current = `${pendingPhraseRef.current} ${heard}`.trim();
          setTranscript((current) => {
            const base = current.replace(/\s*\([^)]*\)$/, "");
            return interim.trim() ? `${base} (${interim.trim()})`.trim() : base || pendingPhraseRef.current;
          });
          clearTimer(silenceTimerRef);
          silenceTimerRef.current = setTimeout(() => {
            silenceTimerRef.current = null;
            if (wantsListeningRef.current && !pausedRef.current) commitUtterance();
          }, endOfSpeechMs);
        }
      };
      recognition.onerror = (event) => {
        if (event.error === "no-speech" || event.error === "aborted") return;
        const messages: Record<string, string> = {
          "not-allowed": "Allow microphone access in your browser to talk with Lil Rizz.",
          "service-not-allowed": "Speech recognition is blocked by this browser.",
          "audio-capture": "No microphone was found.",
          network: "Your browser’s speech recognition service is unavailable.",
        };
        setError(messages[event.error] ?? `Speech recognition error: ${event.error}.`);
        wantsListeningRef.current = false;
        setIsListening(false);
      };
      recognition.onend = () => {
        // Browsers end recognition after a few seconds of silence even in
        // continuous mode. Restart instantly (no gap) while the user wants it.
        if (!wantsListeningRef.current || !continuousConversation || pausedRef.current) {
          setIsListening(false);
          return;
        }
        setIsListening(true);
        try {
          recognition.start();
        } catch {
          restartTimerRef.current = setTimeout(() => {
            if (!wantsListeningRef.current || pausedRef.current) return;
            try {
              recognition.start();
            } catch {
              // The browser can still be finishing its previous session.
            }
          }, 150);
        }
      };
      recognitionRef.current = recognition;
    }

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (startError) {
      if (startError instanceof DOMException && startError.name === "InvalidStateError") {
        setIsListening(true);
      } else {
        wantsListeningRef.current = false;
        setError("The microphone could not be started. Check browser permissions and try again.");
      }
    }
  }, [commitUtterance, continuousConversation, endOfSpeechMs, resetIdleDeadline]);

  const stopListening = useCallback(() => {
    wantsListeningRef.current = false;
    pausedRef.current = false;
    clearTimer(restartTimerRef);
    clearTimer(silenceTimerRef);
    clearTimer(idleDeadlineRef);
    // Commit whatever was still pending so it isn't lost.
    if (pendingPhraseRef.current.trim()) commitUtterance();
    try {
      recognitionRef.current?.stop();
    } catch {
      recognitionRef.current?.abort();
    }
    setIsListening(false);
  }, [commitUtterance]);

  /**
   * Temporarily mute the mic (used while Rizz speaks) without ending the
   * session: the recognition keeps running but no results are consumed, and
   * resume() restarts seamlessly.
   */
  const pauseListening = useCallback(() => {
    if (!wantsListeningRef.current) return;
    pausedRef.current = true;
    clearTimer(silenceTimerRef);
    try {
      recognitionRef.current?.stop();
    } catch {
      recognitionRef.current?.abort();
    }
    setIsListening(false);
  }, []);

  const resumeListening = useCallback(() => {
    if (!wantsListeningRef.current || !pausedRef.current) return;
    pausedRef.current = false;
    resetIdleDeadline();
    try {
      recognitionRef.current?.start();
      setIsListening(true);
    } catch {
      restartTimerRef.current = setTimeout(() => {
        if (!wantsListeningRef.current || pausedRef.current) return;
        try {
          recognitionRef.current?.start();
          setIsListening(true);
        } catch {
          /* previous session still winding down */
        }
      }, 150);
    }
  }, [resetIdleDeadline]);

  const clearTranscript = useCallback(() => {
    setTranscript("");
    setFinalTranscript("");
    pendingPhraseRef.current = "";
  }, []);

  useEffect(() => () => {
    wantsListeningRef.current = false;
    clearTimer(restartTimerRef);
    clearTimer(silenceTimerRef);
    clearTimer(idleDeadlineRef);
    recognitionRef.current?.abort();
    recognitionRef.current = null;
  }, []);

  return {
    isListening,
    transcript,
    finalTranscript,
    error,
    startListening,
    stopListening,
    pauseListening,
    resumeListening,
    clearTranscript,
  };
}
