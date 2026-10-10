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
  continuousConversation?: boolean;
};

export function useSpeechToText({ continuousConversation = true }: UseSpeechToTextOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const wantsListeningRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const speechWindow = window as SpeechRecognitionWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Speech recognition is not supported here. Try Chrome or Safari.");
      return;
    }

    clearRestartTimer();
    setError(null);
    setFinalTranscript("");
    wantsListeningRef.current = true;

    if (!recognitionRef.current) {
      const recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onresult = (event) => {
        let interim = "";
        let finalized = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (!result) continue;
          const phrase = result[0]?.transcript?.trim() ?? "";
          if (result.isFinal) finalized += `${phrase} `;
          else interim += `${phrase} `;
        }
        if (finalized.trim()) {
          const finalText = finalized.trim();
          setTranscript((current) => `${current} ${finalText}`.trim());
          setFinalTranscript(finalText);
        } else if (interim.trim()) {
          setTranscript((current) => `${current.replace(/\s*\([^)]*\)$/, "")} (${interim.trim()})`.trim());
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
        setIsListening(false);
        if (!wantsListeningRef.current || !continuousConversation) return;
        restartTimerRef.current = setTimeout(() => {
          if (!wantsListeningRef.current) return;
          try {
            recognition.start();
            setIsListening(true);
          } catch {
            // The browser can still be finishing its previous recognition session.
          }
        }, 450);
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
  }, [clearRestartTimer, continuousConversation]);

  const stopListening = useCallback(() => {
    wantsListeningRef.current = false;
    clearRestartTimer();
    try {
      recognitionRef.current?.stop();
    } catch {
      recognitionRef.current?.abort();
    }
    setIsListening(false);
  }, [clearRestartTimer]);

  const clearTranscript = useCallback(() => {
    setTranscript("");
    setFinalTranscript("");
  }, []);

  useEffect(() => () => {
    wantsListeningRef.current = false;
    clearRestartTimer();
    recognitionRef.current?.abort();
    recognitionRef.current = null;
  }, [clearRestartTimer]);

  return { isListening, transcript, finalTranscript, error, startListening, stopListening, clearTranscript };
}
