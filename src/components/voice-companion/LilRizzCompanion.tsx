import { useCallback, useEffect, useRef, useState } from "react";
import { useKokoroTTS } from "@/hooks/useKokoroTTS";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { generateLilRizzReply, type LilRizzTurn } from "@/lib/lil-rizz.functions";
import { LilRizzOrbWidget } from "./LilRizzOrbWidget";

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
    async (text: string) => {
      const message = text.trim().slice(0, 400);
      if (!message || requestPendingRef.current) return;
      requestPendingRef.current = true;
      setLastUserMessage(message);
      setReply("");
      stopListening();
      setIsThinking(true);
      setError(null);

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
      } catch {
        answer = "Mera connection abhi off hai. Thodi der mein phir try kar.";
        setError("Couldn’t reach Lil Rizz’s brain. Check the connection and try again.");
      }

      setReply(answer);
      try {
        await speak(answer, "af_bella");
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
    [clearTranscript, speak, startListening, stopListening],
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
