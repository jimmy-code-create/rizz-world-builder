import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useKokoroTTS } from "@/hooks/useKokoroTTS";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { generateLilRizzReply, type LilRizzTurn } from "@/lib/lil-rizz.functions";
import { useAuth } from "@/lib/auth";
import { LilRizzOrbWidget } from "./LilRizzOrbWidget";

function getLilRizzFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const status = message.match(/GEMINI_HTTP_(\d{3})|HTTP\s+(\d{3})/i);
  const statusCode = status?.[1] ?? status?.[2];

  if (/GEMINI_API_KEY|not configured/i.test(message)) {
    return "Gemini is not configured on this server. Check GEMINI_API_KEY in Render.";
  }
  if (statusCode === "404") {
    return "The configured Gemini model is unavailable. Check the model ID in the server.";
  }
  if (["400", "401", "403"].includes(statusCode ?? "")) {
    return "Gemini rejected the request. Check the server's Gemini API key and model access.";
  }
  if (statusCode === "429") {
    return "Gemini's usage limit is reached. Please try again later.";
  }
  if (/unauthorized|supabase|session|token/i.test(message)) {
    return "Your RIZZ sign-in expired. Sign in again, then retry.";
  }
  return "I couldn't answer right now, please try again.";
}

export function LilRizzCompanion() {
  const [isMinimized, setIsMinimized] = useState(true);
  const [isThinking, setIsThinking] = useState(false);
  const [isConversationActive, setIsConversationActive] = useState(false);
  const [reply, setReply] = useState("");
  const [lastUserMessage, setLastUserMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const conversationActiveRef = useRef(false);
  const handledTranscriptRef = useRef("");
  const requestPendingRef = useRef(false);
  const historyRef = useRef<LilRizzTurn[]>([]);
  const { user, loading: authLoading } = useAuth();
  const speech = useSpeechToText({ continuousConversation: true });
  const tts = useKokoroTTS({ browserFirst: true });
  const {
    clearTranscript,
    error: speechError,
    finalTranscript,
    isListening,
    startListening,
    stopListening,
    transcript,
  } = speech;
  const { error: ttsError, isLoading, isSpeaking, speak, stopSpeaking, unlockAudio } = tts;

  const handleUserMessage = useCallback(
    async (text: string, speakReply = false) => {
      const message = text.trim().slice(0, 400);
      if (!message || !user || requestPendingRef.current) return;
      requestPendingRef.current = true;
      setLastUserMessage(message);
      setReply("");
      stopListening();
      setIsThinking(true);
      setError(null);

      try {
        let answer: string;
        try {
          const result = await generateLilRizzReply({
            message,
            history: historyRef.current.slice(-6),
          });
          answer = result.reply;
          const nextHistory: LilRizzTurn[] = [
            ...historyRef.current,
            { role: "user", text: message },
            { role: "model", text: answer },
          ];
          historyRef.current = nextHistory.slice(-6);
        } catch (requestError) {
          setError(getLilRizzFailureMessage(requestError));
          return;
        }

        setReply(answer);
        if (speakReply) {
          unlockAudio();
          try {
            await speak(answer, "af_bella");
          } catch (speechError) {
            console.error("[Lil Rizz] Speech playback failed", speechError);
          }
        }
      } finally {
        requestPendingRef.current = false;
        setIsThinking(false);
        if (conversationActiveRef.current) {
          handledTranscriptRef.current = "";
          clearTranscript();
          startListening();
        }
      }
    },
    [clearTranscript, speak, startListening, stopListening, unlockAudio, user],
  );

  const handleFinalTranscript = useCallback(
    (text: string) => {
      const message = text.trim().slice(0, 400);
      if (!message || handledTranscriptRef.current === message) return;
      handledTranscriptRef.current = message;
      void handleUserMessage(message, true);
    },
    [handleUserMessage],
  );

  useEffect(() => {
    if (finalTranscript) void handleFinalTranscript(finalTranscript);
  }, [finalTranscript, handleFinalTranscript]);

  const replayReply = useCallback(() => {
    if (!reply) return;
    setError(null);
    unlockAudio();
    void speak(reply, "af_bella").then((played) => {
      if (!played) setError("I couldn’t play that reply aloud. Try again or read it here.");
    });
  }, [reply, speak, unlockAudio]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      conversationActiveRef.current = false;
      setIsConversationActive(false);
      stopListening();
      return;
    }
    if (isSpeaking) stopSpeaking();
    conversationActiveRef.current = true;
    setIsConversationActive(true);
    handledTranscriptRef.current = "";
    setError(null);
    unlockAudio();
    clearTranscript();
    startListening();
  }, [
    clearTranscript,
    isListening,
    isSpeaking,
    startListening,
    stopListening,
    stopSpeaking,
    unlockAudio,
  ]);

  const status = isListening
    ? "listening"
    : isSpeaking
      ? "speaking"
      : isThinking || isLoading
        ? "thinking"
        : "idle";

  return (
    <LilRizzOrbWidget
      status={status}
      transcript={transcript}
      lastUserMessage={lastUserMessage}
      reply={reply}
      isConversationActive={isConversationActive}
      isMinimized={isMinimized}
      error={error ?? speechError ?? ttsError}
      isBusy={isThinking || isLoading}
      isGuest={!user && !authLoading}
      isAuthLoading={authLoading}
      signInLink={<Link to="/login" className="font-semibold text-cyan-100 underline decoration-cyan-100/40 underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">Sign in</Link>}
      onDismiss={() => {
        conversationActiveRef.current = false;
        setIsConversationActive(false);
        stopListening();
        stopSpeaking();
        setIsMinimized(true);
      }}
      onSummon={() => setIsMinimized(false)}
      onToggleListening={toggleListening}
      onSendMessage={(message) => void handleUserMessage(message)}
      onReplay={replayReply}
    />
  );
}
