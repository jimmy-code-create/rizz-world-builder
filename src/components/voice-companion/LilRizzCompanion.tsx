import { useCallback, useEffect, useRef, useState } from "react";
import { useKokoroTTS } from "@/hooks/useKokoroTTS";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { generateLilRizzReply, type LilRizzTurn } from "@/lib/lil-rizz.functions";
import { LilRizzOrbWidget } from "./LilRizzOrbWidget";

function getLilRizzFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const status = message.match(/HTTP\s+(\d{3})/i)?.[1];

  if (/XAI_API_KEY|not configured/i.test(message)) {
    return "Grok is not configured on this server. Add XAI_API_KEY in Render and redeploy.";
  }
  if (status === "401" || status === "403") {
    return "Grok rejected this request. Check the XAI_API_KEY saved in Render.";
  }
  if (status === "404") {
    return "Grok could not find the requested model. Check the model setting in the server logs.";
  }
  if (status === "429") {
    return "Grok is rate-limited or out of API quota. Check your xAI usage.";
  }
  if (status?.startsWith("5")) {
    return "Grok is temporarily unavailable. Try again in a moment.";
  }
  if (/unauthorized|supabase|session|token/i.test(message)) {
    return "Your RIZZ sign-in expired. Sign in again, then retry.";
  }
  if (/fetch|network|timeout/i.test(message)) {
    return "Lil Rizz could not reach Grok. Check the Render service and try again.";
  }
  return "Lil Rizz could not get a reply. Check the Render service logs, then try again.";
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
      } catch (requestError) {
        answer = "Mera connection abhi off hai. Thodi der mein phir try kar.";
        setError(getLilRizzFailureMessage(requestError));
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
