import { useCallback, useEffect, useRef, useState } from "react";
import { useKokoroTTS } from "@/hooks/useKokoroTTS";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { generateLilRizzReply, type LilRizzTurn } from "@/lib/lil-rizz.functions";
import { LilRizzOrbWidget } from "./LilRizzOrbWidget";

function getLilRizzFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const status = message.match(/GROQ_HTTP_(\d{3})|HTTP\s+(\d{3})/i);

  if (/GROQ_API_KEY|not configured/i.test(message)) {
    return "Groq is not configured on this server. Set GROQ_API_KEY in Render.";
  }
  if (status?.[1] === "401" || status?.[2] === "401") {
    return "The Groq API key is invalid. Check GROQ_API_KEY in Render.";
  }
  if (status?.[1] === "429" || status?.[2] === "429") {
    return "The Groq free limit is reached. Please try again later.";
  }
  if (/unauthorized|supabase|session|token/i.test(message)) {
    return "Your RIZZ sign-in expired. Sign in again, then retry.";
  }
  return "I couldn't answer right now, please try again.";
}

export function LilRizzCompanion() {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isConversationActive, setIsConversationActive] = useState(false);
  const [reply, setReply] = useState("");
  const [lastUserMessage, setLastUserMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const conversationActiveRef = useRef(false);
  const handledTranscriptRef = useRef("");
  const requestPendingRef = useRef(false);
  const historyRef = useRef<LilRizzTurn[]>([]);
  const speech = useSpeechToText({ continuousConversation: true });
  const tts = useKokoroTTS();
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
    async (text: string) => {
      const message = text.trim().slice(0, 400);
      if (!message || requestPendingRef.current) return;
      requestPendingRef.current = true;
      unlockAudio();
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
          answer = getLilRizzFailureMessage(requestError);
        }

        setReply(answer);
        try {
          await speak(answer, "af_bella");
        } catch (speechError) {
          console.error("[Lil Rizz] Speech playback failed", speechError);
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
    [clearTranscript, speak, startListening, stopListening, unlockAudio],
  );

  const handleFinalTranscript = useCallback(
    (text: string) => {
      const message = text.trim().slice(0, 400);
      if (!message || handledTranscriptRef.current === message) return;
      handledTranscriptRef.current = message;
      void handleUserMessage(message);
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
