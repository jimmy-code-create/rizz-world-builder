import { useCallback, useEffect, useRef, useState } from "react";
import { useKokoroTTS } from "@/hooks/useKokoroTTS";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { LilRizzWidget } from "./LilRizzWidget";
import { getLocalCompanionReply } from "./localReplies";

export function LilRizzCompanion() {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [reply, setReply] = useState("");
  const conversationActiveRef = useRef(false);
  const handledTranscriptRef = useRef("");
  const speech = useSpeechToText({ continuousConversation: true });
  const tts = useKokoroTTS();

  const handleFinalTranscript = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || handledTranscriptRef.current === message) return;
    handledTranscriptRef.current = message;
    speech.stopListening();
    setIsThinking(true);
    const answer = getLocalCompanionReply(message);
    setReply(answer);
    await tts.speak(answer, "af_bella");
    setIsThinking(false);
    if (conversationActiveRef.current) {
      handledTranscriptRef.current = "";
      speech.startListening();
    }
  }, [speech.stopListening, speech.startListening, tts.speak]);

  useEffect(() => {
    if (speech.finalTranscript) void handleFinalTranscript(speech.finalTranscript);
  }, [handleFinalTranscript, speech.finalTranscript]);

  const toggleListening = useCallback(() => {
    if (speech.isListening) {
      conversationActiveRef.current = false;
      speech.stopListening();
      return;
    }
    if (tts.isSpeaking) tts.stopSpeaking();
    conversationActiveRef.current = true;
    handledTranscriptRef.current = "";
    tts.unlockAudio();
    speech.clearTranscript();
    speech.startListening();
  }, [speech.clearTranscript, speech.isListening, speech.startListening, speech.stopListening, tts.isSpeaking, tts.stopSpeaking, tts.unlockAudio]);

  const status = speech.isListening
    ? "listening"
    : tts.isSpeaking
      ? "speaking"
      : isThinking || tts.isLoading
        ? "thinking"
        : "idle";

  return (
    <LilRizzWidget
      status={status}
      transcript={speech.transcript}
      reply={reply}
      isMinimized={isMinimized}
      loadingProgress={tts.loadingProgress}
      audioLevel={tts.audioLevel}
      error={speech.error ?? tts.error}
      onDismiss={() => {
        conversationActiveRef.current = false;
        speech.stopListening();
        tts.stopSpeaking();
        setIsMinimized(true);
      }}
      onSummon={() => setIsMinimized(false)}
      onToggleListening={toggleListening}
    />
  );
}
