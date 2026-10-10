import { useCallback, useEffect, useRef, useState } from "react";
import { useKokoroTTS } from "@/hooks/useKokoroTTS";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { generateLilRizzReply, type LilRizzTurn } from "@/lib/lil-rizz.functions";
import { LilRizzOrbWidget } from "./LilRizzOrbWidget";

export function LilRizzCompanion() {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const conversationActiveRef = useRef(false);
  const handledTranscriptRef = useRef("");
  const historyRef = useRef<LilRizzTurn[]>([]);
  const speech = useSpeechToText({ continuousConversation: true });
  const tts = useKokoroTTS();

  const handleFinalTranscript = useCallback(async (text: string) => {
    const message = text.trim().slice(0, 400);
    if (!message || handledTranscriptRef.current === message) return;
    handledTranscriptRef.current = message;
    speech.stopListening();
    setIsThinking(true);
    setError(null);

    let answer: string;
    try {
      const result = await generateLilRizzReply({
        message,
        history: historyRef.current.slice(-6),
      });
      answer = result.reply;
      historyRef.current = [
        ...historyRef.current,
        { role: "user", text: message },
        { role: "model", text: answer },
      ].slice(-6);
    } catch {
      answer = "Bhai, mera signal thoda cooked hai. Ek sec mein phir try kar.";
      setError("Couldn’t reach Lil Rizz’s brain. Check the connection and try again.");
    }

    setReply(answer);
    try {
      await tts.speak(answer, "af_bella");
    } finally {
      setIsThinking(false);
      if (conversationActiveRef.current) {
        handledTranscriptRef.current = "";
        speech.clearTranscript();
        speech.startListening();
      }
    }
  }, [speech.clearTranscript, speech.stopListening, speech.startListening, tts.speak]);

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
    setError(null);
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
      <LilRizzOrbWidget
      status={status}
      transcript={speech.transcript}
      reply={reply}
      isMinimized={isMinimized}
      loadingProgress={tts.loadingProgress}
      audioLevel={tts.audioLevel}
      error={error ?? speech.error ?? tts.error}
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
