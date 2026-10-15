import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useKokoroTTS } from "@/hooks/useKokoroTTS";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { generateLilRizzReply, type LilRizzTurn } from "@/lib/lil-rizz.functions";
import { resolveVoiceCommand, type CommandMatch } from "@/lib/rizz-commands";
import { playListeningStartSound, playListeningStopSound } from "@/lib/rizz-sounds";
import { useAuth } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { LilRizzOrbWidget } from "./LilRizzOrbWidget";

function getLilRizzFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const status = message.match(/GROQ_HTTP_(\d{3})|HTTP\s+(\d{3})/i);
  const statusCode = status?.[1] ?? status?.[2];

  if (/GROQ_API_KEY|not configured/i.test(message)) {
    return "The AI brain is not configured on this server. Check GROQ_API_KEY in Render.";
  }
  if (statusCode === "404") {
    return "The configured AI model is unavailable. Check the model ID in the server.";
  }
  if (["400", "401", "403"].includes(statusCode ?? "")) {
    return "The AI rejected the request. Check the server's Groq API key and model access.";
  }
  if (statusCode === "429") {
    return "The AI's usage limit is reached. Please try again later.";
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
  const [isHandsFree, setIsHandsFree] = useState(false);
  const [reply, setReply] = useState("");
  const [lastUserMessage, setLastUserMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const conversationActiveRef = useRef(false);
  const mountedRef = useRef(true);
  const handledTranscriptRef = useRef("");
  const requestPendingRef = useRef(false);
  const historyRef = useRef<LilRizzTurn[]>([]);
  const handleUtteranceRef = useRef<(text: string) => void>(() => {});
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const router = useRouter();

  const speak = useRef<((text: string, voice?: "af_bella") => Promise<boolean>) | null>(null);

  const speech = useSpeechToText({
    continuousConversation: true,
    endOfSpeechMs: 1800,
    maxSilenceMs: 5 * 60 * 1000,
    onUtterance: (text) => handleUtteranceRef.current(text),
  });
  const tts = useKokoroTTS({ browserFirst: false });
  const {
    error: speechError,
    isListening,
    startListening,
    stopListening,
    pauseListening,
    resumeListening,
    transcript,
  } = speech;
  const { error: ttsError, isLoading, isSpeaking, speak: ttsSpeak, stopSpeaking, unlockAudio } = tts;
  speak.current = ttsSpeak;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      conversationActiveRef.current = false;
      // The speech hooks stop recognition and audio on unmount.
    };
  }, []);

  /**
   * Execute a matched voice command: perform the navigation/action, then speak
   * a short confirmation. Returns true when a command was consumed.
   */
  const executeCommand = useCallback(
    async (match: CommandMatch): Promise<boolean> => {
      const { command } = match;
      switch (command.id) {
        case "action:back": {
          if (typeof window !== "undefined") window.history.back();
          break;
        }
        case "action:close": {
          conversationActiveRef.current = false;
          setIsConversationActive(false);
          setIsHandsFree(false);
          stopListening();
          stopSpeaking();
          setIsMinimized(true);
          break;
        }
        case "action:handsfree-on": {
          setIsHandsFree(true);
          conversationActiveRef.current = true;
          setIsConversationActive(true);
          break;
        }
        case "action:handsfree-off": {
          setIsHandsFree(false);
          break;
        }
        case "action:create-story": {
          if (router.state.location.pathname !== "/chat-stories") {
            await nav({ to: "/chat-stories" });
          }
          // Ask the stories screen to open its generator dialog.
          window.dispatchEvent(new CustomEvent("rizz:create-story"));
          break;
        }
        case "open:profile": {
          const username = user?.user_metadata?.username ?? user?.email?.split("@")[0] ?? "";
          if (username) await nav({ to: "/u/$username", params: { username } });
          else await nav({ to: "/feed" });
          break;
        }
        default: {
          if (command.path) {
            if (command.params) {
              await nav({ to: command.path, params: command.params } as never);
            } else {
              await nav({ to: command.path } as never);
            }
          }
        }
      }
      // Spoken confirmation (short, Hinglish).
      if (!mountedRef.current) return true;
      unlockAudio();
      try {
        await speak.current?.(command.speak, "af_bella");
      } catch {
        // Confirmation speech is best-effort.
      }
      return true;
    },
    [nav, router.state.location.pathname, stopListening, stopSpeaking, unlockAudio, user],
  );

  const handleUserMessage = useCallback(
    async (text: string, speakReply = false) => {
      const message = text.trim().slice(0, 400);
      if (!mountedRef.current || !message || !user || requestPendingRef.current) return;
      requestPendingRef.current = true;
      setLastUserMessage(message);
      setReply("");
      pauseListening();
      setIsThinking(true);
      setError(null);

      try {
        let answer: string;
        try {
          const result = await generateLilRizzReply({
            message,
            history: historyRef.current.slice(-6),
          });
          if (!mountedRef.current) return;
          answer = result.reply;
          const nextHistory: LilRizzTurn[] = [
            ...historyRef.current,
            { role: "user", text: message },
            { role: "model", text: answer },
          ];
          historyRef.current = nextHistory.slice(-6);
        } catch (requestError) {
          if (!mountedRef.current) return;
          setError(getLilRizzFailureMessage(requestError));
          return;
        }

        setReply(answer);
        if (speakReply) {
          unlockAudio();
          try {
            await speak.current?.(answer, "af_bella");
          } catch (speechError) {
            console.error("[Lil Rizz] Speech playback failed", speechError);
          }
        }
      } finally {
        requestPendingRef.current = false;
        if (mountedRef.current) setIsThinking(false);
        if (conversationActiveRef.current) {
          handledTranscriptRef.current = "";
          resumeListening();
        }
      }
    },
    [pauseListening, resumeListening, unlockAudio, user],
  );

  /**
   * Every utterance goes through the command router first; only unrecognized
   * speech falls through to the chat AI.
   */
  const handleUtterance = useCallback(
    async (text: string) => {
      const message = text.trim().slice(0, 400);
      if (!message || handledTranscriptRef.current === message) return;
      handledTranscriptRef.current = message;
      try {
        const match = await resolveVoiceCommand(message);
        if (!mountedRef.current) return;
        if (match) {
          setLastUserMessage(message);
          pauseListening();
          await executeCommand(match);
          if (conversationActiveRef.current) resumeListening();
          return;
        }
      } catch {
        // Router failure — treat as chat.
      }
      void handleUserMessage(message, true);
    },
    [executeCommand, handleUserMessage, pauseListening, resumeListening],
  );
  handleUtteranceRef.current = handleUtterance;

  // "ek story bana do" → open stories screen and start the generator.
  useEffect(() => {
    const onOpenStory = () => {
      toast.info("Story bana rahe hai!");
    };
    window.addEventListener("rizz:create-story", onOpenStory);
    return () => window.removeEventListener("rizz:create-story", onOpenStory);
  }, []);

  const replayReply = useCallback(() => {
    if (!reply) return;
    setError(null);
    unlockAudio();
    pauseListening();
    void speak.current?.(reply, "af_bella").then((played) => {
      if (!mountedRef.current) return;
      if (!played) setError("I couldn’t play that reply aloud. Try again or read it here.");
      if (conversationActiveRef.current) resumeListening();
    });
  }, [reply, unlockAudio, pauseListening, resumeListening]);

  const toggleListening = useCallback(() => {
    if (isListening || isConversationActive) {
      conversationActiveRef.current = false;
      setIsConversationActive(false);
      stopListening();
      playListeningStopSound();
      return;
    }
    if (isSpeaking) stopSpeaking();
    conversationActiveRef.current = true;
    setIsConversationActive(true);
    handledTranscriptRef.current = "";
    setError(null);
    unlockAudio();
    playListeningStartSound();
    startListening();
  }, [
    isListening,
    isConversationActive,
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
      isHandsFree={isHandsFree}
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
