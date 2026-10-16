import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import {
  AudioLines,
  ChevronsRight,
  GitBranch,
  Heart,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { CloseButton } from "@/components/ui/close-button";
import { FullScreenLayer } from "@/components/FullScreenLayer";
import { useKokoroTTS } from "@/hooks/useKokoroTTS";
import { pickDeviceVoice } from "@/lib/voice-selection";
import {
  SPEECH_EFFECT_PRESETS,
  displayText,
  speechSegmentsForText,
  waitForSpeech,
  type SpeechEffect,
} from "@/lib/chat-story-effects";
import panelOne from "@/assets/chatstory/room4b-panel-1.jpg";
import panelTwo from "@/assets/chatstory/room4b-panel-2.jpg";
import panelThree from "@/assets/chatstory/room4b-panel-3.jpg";
import panelFour from "@/assets/chatstory/room4b-panel-4.jpg";
import {
  ROOM_4B_CHOICES,
  ROOM_4B_HOOK,
  ROOM_4B_LINES,
  ROOM_4B_SCENE_LABELS,
  ROOM_4B_TITLE,
} from "@/components/chatstory/room4b-story";

export type StoryLine = {
  idx: number;
  speaker: string;
  body: string;
  body_en?: string;
  next_idx?: number | null;
  chapter?: string | null;
  is_terminal?: boolean;
};

export type StoryChoice = {
  at_idx: number;
  position: number;
  label: string;
  label_en?: string;
  reply_body: string;
  reply_body_en?: string;
  goto_idx: number;
};

export type ChatStory = {
  id: string;
  slug?: string;
  title: string;
  hook: string;
  emoji: string;
  category: string;
  gradient: string;
  them_name: string;
  me_name: string;
  video_url?: string | null;
};

type Bubble = { key: string; speaker: string; body: string; body_en?: string; idx: number };
type Scene = { id: string; label: string; image?: string };

const ROOM_4B_SCENES: Scene[] = [
  { id: "scene-1", label: ROOM_4B_SCENE_LABELS["scene-1"].en, image: panelOne },
  { id: "scene-2", label: ROOM_4B_SCENE_LABELS["scene-2"].en, image: panelTwo },
  { id: "scene-3", label: ROOM_4B_SCENE_LABELS["scene-3"].en, image: panelThree },
  { id: "scene-4", label: ROOM_4B_SCENE_LABELS["scene-4"].en, image: panelFour },
];

const SPEEDS = [1, 1.5, 2, 3] as const;
/** Pacing at 1x; higher speeds divide it so 2x really is twice as fast. */
const ADVANCE_DELAY_MS = 1250;
const TYPING_DELAY_MS = 420;
type NarrationLanguage = "hi" | "en";

type VoiceProfile = {
  voiceSlot: number;
  pitch: number;
  rateMultiplier: number;
  volume: number;
  gender: "female" | "male" | "neutral";
};

const VOICE_PROFILES: Record<string, VoiceProfile> = {
  narrator: { voiceSlot: 0, pitch: 0.78, rateMultiplier: 0.92, volume: 0.9, gender: "neutral" },
  me: { voiceSlot: 1, pitch: 1.06, rateMultiplier: 1.02, volume: 1, gender: "neutral" },
  them: { voiceSlot: 2, pitch: 1.38, rateMultiplier: 1.08, volume: 1, gender: "female" },
  Asha: { voiceSlot: 2, pitch: 1.44, rateMultiplier: 1.08, volume: 1, gender: "female" },
  Kabir: { voiceSlot: 3, pitch: 0.7, rateMultiplier: 0.94, volume: 0.96, gender: "male" },
  Echo: { voiceSlot: 4, pitch: 0.52, rateMultiplier: 0.82, volume: 0.86, gender: "neutral" },
};

const VOICE_NAME_PREFERENCES: Record<NarrationLanguage, Record<string, string[]>> = {
  en: {
    narrator: ["Microsoft Guy", "Microsoft Ryan", "Microsoft Andrew", "Daniel", "Alex"],
    me: ["Microsoft Andrew", "Microsoft Brian", "Daniel", "Alex", "Samantha"],
    Asha: ["Microsoft Aria", "Microsoft Jenny", "Samantha", "Ava"],
    Kabir: ["Microsoft Guy", "Microsoft Ryan", "Daniel", "Alex"],
    Echo: ["Microsoft Michelle", "Microsoft Sonia", "Samantha", "Ava"],
  },
  hi: {
    narrator: ["Microsoft Madhur", "Microsoft Hemant", "Lekha"],
    me: ["Microsoft Madhur", "Microsoft Hemant", "Madhur"],
    Asha: ["Microsoft Swara", "Microsoft Neerja", "Lekha"],
    Kabir: ["Microsoft Madhur", "Microsoft Prabhat", "Hemant"],
    Echo: ["Microsoft Kalpana", "Microsoft Swara", "Lekha"],
  },
};

/** HD voice pools from the bundled Kokoro model; one pool per character gender. */
const KOKORO_VOICES: Record<"female" | "male" | "neutral", string[]> = {
  female: ["af_bella", "af_nicole", "af_sky", "bf_emma"],
  male: ["am_michael", "am_adam", "am_onyx", "bm_george"],
  neutral: ["af_nova", "am_echo", "am_puck", "bm_fable"],
};

/** The three story seats always keep their signature HD voice. */
const KOKORO_STARRING_VOICES = {
  narrator: "bm_george",
  me: "am_michael",
  them: "af_bella",
} as const;

const HD_VOICE_KEY = "rizz.chatstory.hd-voice";

function characterHash(value: string) {
  return [...value.toLowerCase()].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
}

function resolveVoiceProfile(speaker: string, story: ChatStory): VoiceProfile {
  const normalized = speaker.trim().toLowerCase();
  const key =
    normalized === story.me_name.trim().toLowerCase()
      ? "me"
      : normalized === story.them_name.trim().toLowerCase()
        ? "them"
        : speaker;
  const known = VOICE_PROFILES[key];
  if (known) return known;

  const hash = characterHash(speaker);
  const female = /\b(asha|she|her|girl|woman|female|mom|mother|sister)\b/i.test(speaker);
  const male = /\b(kabir|he|him|boy|man|male|dad|father|brother)\b/i.test(speaker);
  return {
    voiceSlot: hash,
    pitch: 0.82 + (hash % 7) * 0.09,
    rateMultiplier: 0.94 + (hash % 5) * 0.035,
    volume: 0.96,
    gender: female ? "female" : male ? "male" : "neutral",
  };
}

/** Picks the HD (Kokoro) voice for a speaker, keeping each seat consistent. */
function resolveKokoroVoice(speaker: string, story: ChatStory, profile: VoiceProfile): string {
  const normalized = speaker.trim().toLowerCase();
  if (normalized === "narrator") return KOKORO_STARRING_VOICES.narrator;
  if (normalized === "me" || normalized === story.me_name.trim().toLowerCase())
    return KOKORO_STARRING_VOICES.me;
  if (normalized === "them" || normalized === story.them_name.trim().toLowerCase())
    return KOKORO_STARRING_VOICES.them;
  const pool = KOKORO_VOICES[profile.gender];
  return pool[characterHash(speaker) % pool.length];
}

function selectNarrationVoice(
  voices: SpeechSynthesisVoice[],
  language: NarrationLanguage,
  speaker: string,
  profile: VoiceProfile,
) {
  return pickDeviceVoice(voices, {
    language,
    gender: profile.gender,
    seed: profile.voiceSlot,
    preferNames: VOICE_NAME_PREFERENCES[language][speaker],
  });
}

function storyText(hindi: string, english: string | undefined, language: "hi" | "en") {
  return language === "hi" ? hindi : (english ?? hindi);
}

function speakerLabel(speaker: string, language: "hi" | "en") {
  if (speaker === "Asha") return language === "hi" ? "आशा" : "Asha";
  if (speaker === "Kabir") return language === "hi" ? "कबीर" : "Kabir";
  if (speaker === "Echo") return language === "hi" ? "तुम्हारा नंबर" : "Your number";
  return speaker;
}

function chapterLabel(chapter: string) {
  return chapter
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

const CHAPTER_BACKDROPS = [
  "linear-gradient(135deg, rgba(42, 55, 80, .78), rgba(20, 32, 54, .22) 58%, rgba(89, 49, 79, .58))",
  "linear-gradient(135deg, rgba(25, 77, 80, .72), rgba(21, 35, 62, .24) 55%, rgba(116, 65, 66, .58))",
  "linear-gradient(135deg, rgba(91, 58, 37, .72), rgba(37, 34, 65, .28) 55%, rgba(56, 76, 96, .62))",
  "linear-gradient(135deg, rgba(74, 43, 80, .72), rgba(24, 40, 62, .25) 55%, rgba(104, 73, 44, .58))",
];

export function ChatStoryPlayer({
  story,
  lines,
  choices = [],
  liked,
  onLike,
  onClose,
  initialLanguage = "hi",
}: {
  story: ChatStory;
  lines: StoryLine[];
  choices?: StoryChoice[];
  liked: boolean;
  onLike: () => void;
  onClose: () => void;
  initialLanguage?: "hi" | "en";
}) {
  const isRoom4B = story.slug === "room-4b";
  const storyLines = isRoom4B ? ROOM_4B_LINES : lines;
  const storyChoices = isRoom4B ? ROOM_4B_CHOICES : choices;
  const byIdx = useMemo(() => new Map(storyLines.map((line) => [line.idx, line])), [storyLines]);
  const sorted = useMemo(() => [...storyLines].sort((a, b) => a.idx - b.idx), [storyLines]);
  const first = sorted[0]?.idx;
  const chapterIds = useMemo(
    () => [
      ...new Set(
        sorted.flatMap((line) =>
          typeof line.chapter === "string" && line.chapter.trim() ? [line.chapter] : [],
        ),
      ),
    ],
    [sorted],
  );
  const scenes = useMemo<Scene[]>(
    () => (isRoom4B ? ROOM_4B_SCENES : chapterIds.map((id) => ({ id, label: chapterLabel(id) }))),
    [chapterIds, isRoom4B],
  );

  const choicesAt = useMemo(() => {
    const grouped = new Map<number, StoryChoice[]>();
    for (const choice of storyChoices) {
      const current = grouped.get(choice.at_idx) ?? [];
      current.push(choice);
      grouped.set(choice.at_idx, current);
    }
    for (const current of grouped.values()) current.sort((a, b) => a.position - b.position);
    return grouped;
  }, [storyChoices]);

  const [path, setPath] = useState<Bubble[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [typing, setTyping] = useState(false);
  const [auto, setAuto] = useState(true);
  const [narration, setNarration] = useState(true);
  const [language, setLanguage] = useState<"hi" | "en">(initialLanguage);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hdVoice, setHdVoice] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const availableVoicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const speechRunRef = useRef(0);

  const {
    speak: kokoroSpeak,
    stopSpeaking: kokoroStop,
    unlockAudio: kokoroUnlock,
    preload: kokoroPreload,
    isReady: hdVoiceReady,
    isLoading: hdVoiceLoading,
    loadingProgress: hdVoiceProgress,
  } = useKokoroTTS();

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synthesis = window.speechSynthesis;
    const refreshVoices = () => {
      const voices = synthesis.getVoices();
      if (voices.length > 0) availableVoicesRef.current = voices;
    };

    refreshVoices();
    synthesis.addEventListener("voiceschanged", refreshVoices);
    const retry = window.setTimeout(refreshVoices, 300);
    return () => {
      window.clearTimeout(retry);
      synthesis.removeEventListener("voiceschanged", refreshVoices);
    };
  }, []);

  // HD voices are the default; only an explicit opt-out turns them off.
  useEffect(() => {
    try {
      setHdVoice(window.localStorage.getItem(HD_VOICE_KEY) !== "0");
    } catch {
      // Private browsing can block storage; HD voices simply stay on.
    }
  }, []);

  // Warm the HD model as soon as an English scene opens, so the first lines
  // can upgrade from the device voice without a silent download stall.
  useEffect(() => {
    if (!hdVoice || language !== "en" || hdVoiceReady) return;
    kokoroPreload();
  }, [hdVoice, hdVoiceReady, kokoroPreload, language]);

  const stopNarration = useCallback(() => {
    speechRunRef.current += 1;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    speechRef.current = null;
    kokoroStop();
    setIsSpeaking(false);
  }, [kokoroStop]);

  const unlockVoice = useCallback(() => {
    try {
      kokoroUnlock();
    } catch {
      // Device voices need no unlock; ignore failures here.
    }
  }, [kokoroUnlock]);

  /** One segment through the device voices, with the character's profile. */
  const speakBrowserSegment = useCallback(
    (text: string, speaker: string, effect: SpeechEffect) =>
      new Promise<void>((resolve) => {
        if (
          typeof window === "undefined" ||
          !("speechSynthesis" in window) ||
          typeof SpeechSynthesisUtterance === "undefined"
        ) {
          resolve();
          return;
        }
        const synthesis = window.speechSynthesis;
        const utterance = new SpeechSynthesisUtterance(text);
        const profile = resolveVoiceProfile(speaker, story);
        const preset = SPEECH_EFFECT_PRESETS[effect];
        utterance.lang = language === "hi" ? "hi-IN" : "en-IN";
        // Speech rates above 3 sound garbled, so 3x is the ceiling here too.
        utterance.rate = Math.min(3, Math.max(0.5, speed * profile.rateMultiplier * preset.rate));
        utterance.pitch = Math.min(2, Math.max(0, profile.pitch + preset.pitch));
        utterance.volume = Math.min(1, Math.max(0.05, profile.volume * preset.volume));
        const voices =
          availableVoicesRef.current.length > 0
            ? availableVoicesRef.current
            : synthesis.getVoices();
        const voice = selectNarrationVoice(voices, language, speaker, profile);
        if (voice) utterance.voice = voice;
        const finish = () => resolve();
        utterance.onend = finish;
        utterance.onerror = finish;
        speechRef.current = utterance;
        try {
          synthesis.speak(utterance);
        } catch {
          finish();
        }
      }),
    // The helpers only read these two names, so those are the real dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language, speed, story.me_name, story.them_name],
  );

  /**
   * Speaks a full story line: plain text, whisper runs, interjections and
   * silence beats, in order. HD voices handle English scenes; anything else
   * (and any HD failure) falls back to the device narration.
   */
  const speakLine = useCallback(
    async (rawText: string, speaker = "narrator") => {
      if (!narration || typeof window === "undefined") return;
      const segments = speechSegmentsForText(rawText);
      if (segments.length === 0) return;

      speechRunRef.current += 1;
      const run = speechRunRef.current;
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      kokoroStop();
      setIsSpeaking(true);

      const useKokoro = hdVoice && language === "en" && hdVoiceReady;
      const profile = resolveVoiceProfile(speaker, story);

      for (const segment of segments) {
        if (speechRunRef.current !== run) return;
        if (segment.kind === "pause") {
          await waitForSpeech(segment.ms);
          continue;
        }
        if (useKokoro) {
          const preset = SPEECH_EFFECT_PRESETS[segment.effect];
          const played = await kokoroSpeak(
            segment.text,
            resolveKokoroVoice(speaker, story, profile),
            {
              speed: Math.min(1.5, Math.max(0.6, speed * profile.rateMultiplier * preset.rate)),
              volume: preset.volume,
            },
          );
          if (!played && speechRunRef.current === run) {
            await speakBrowserSegment(segment.text, speaker, segment.effect);
          }
        } else {
          await speakBrowserSegment(segment.text, speaker, segment.effect);
        }
        const trailing = SPEECH_EFFECT_PRESETS[segment.effect].trailingPauseMs;
        if (trailing > 0 && speechRunRef.current === run) await waitForSpeech(trailing);
      }
      if (speechRunRef.current === run) setIsSpeaking(false);
    },
    // The helpers only read these two names, so those are the real dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      hdVoice,
      hdVoiceReady,
      kokoroSpeak,
      kokoroStop,
      language,
      narration,
      speed,
      speakBrowserSegment,
      story.me_name,
      story.them_name,
    ],
  );

  const reset = useCallback(() => {
    unlockVoice();
    stopNarration();
    if (first == null) return;
    const line = byIdx.get(first);
    if (!line) return;
    setPath([
      {
        key: `line-${first}`,
        speaker: line.speaker,
        body: line.body,
        body_en: line.body_en,
        idx: first,
      },
    ]);
    setCursor(first);
    setPicked(new Set());
    setTyping(false);
  }, [byIdx, first, stopNarration, unlockVoice]);

  useEffect(() => {
    reset();
  }, [reset, story.id]);

  useEffect(() => () => stopNarration(), [stopNarration]);

  // Uploaded and generated stories carry both languages; default to the
  // language the first message is actually written in.
  const hasEnglish = useMemo(
    () =>
      !isRoom4B &&
      storyLines.some((line) => (line.body_en ?? "").trim() !== "" && line.body_en !== line.body),
    [isRoom4B, storyLines],
  );

  useEffect(() => {
    if (isRoom4B) return;
    const sample = sorted[0];
    if (!sample) return;
    const bodyLooksHindi = /[\u0900-\u097F]/.test(sample.body);
    if (!bodyLooksHindi && hasEnglish) setLanguage("en");
  }, [hasEnglish, isRoom4B, sorted]);

  const nextOf = (idx: number): number | null => {
    const line = byIdx.get(idx);
    if (line && line.next_idx !== undefined) return line.next_idx;
    if (line?.is_terminal) return null;
    const position = sorted.findIndex((item) => item.idx === idx);
    const next = sorted[position + 1];
    if (!next) return null;
    return Math.floor(next.idx / 100) === Math.floor(idx / 100) ? next.idx : null;
  };

  const pending = cursor != null && !picked.has(cursor) ? (choicesAt.get(cursor) ?? []) : [];
  const nextIdx = cursor == null ? null : nextOf(cursor);
  const done = pending.length === 0 && nextIdx == null;
  const nextSpeaker = nextIdx != null ? byIdx.get(nextIdx)?.speaker : undefined;
  const activeLine = cursor != null ? byIdx.get(cursor) : undefined;
  const activeScene =
    scenes.find((scene) => scene.id === activeLine?.chapter) ?? (isRoom4B ? scenes[0] : undefined);
  const sceneIndex = Math.max(
    0,
    scenes.findIndex((scene) => scene.id === activeScene?.id),
  );
  // Progress through the whole story, so long uploads always show how far in you are.
  const lineIndex =
    cursor == null
      ? 0
      : Math.max(
          0,
          sorted.findIndex((line) => line.idx === cursor),
        );
  const readingProgress = sorted.length > 0 ? (lineIndex + 1) / sorted.length : 0;
  const title = isRoom4B ? ROOM_4B_TITLE[language] : story.title;
  const hook = isRoom4B ? ROOM_4B_HOOK[language] : story.hook;
  const activeSceneLabel = activeScene
    ? isRoom4B
      ? (ROOM_4B_SCENE_LABELS[activeScene.id]?.[language] ?? activeScene.label)
      : activeScene.label
    : story.them_name;

  const addLine = useCallback(
    (idx: number) => {
      const line = byIdx.get(idx);
      if (!line) return;
      setPath((current) => [
        ...current,
        {
          key: `line-${idx}-${current.length}`,
          speaker: line.speaker,
          body: line.body,
          body_en: line.body_en,
          idx,
        },
      ]);
      setCursor(idx);
    },
    [byIdx],
  );

  const advance = useCallback(() => {
    unlockVoice();
    if (typing || done || pending.length > 0 || nextIdx == null) return;
    setTyping(true);
    // The typing bubble shortens with the speed pill, so 2x/3x feel faster too.
    window.setTimeout(() => {
      setTyping(false);
      addLine(nextIdx);
    }, TYPING_DELAY_MS / speed);
  }, [addLine, done, nextIdx, pending.length, speed, typing, unlockVoice]);

  const choose = (choice: StoryChoice) => {
    unlockVoice();
    if (cursor == null) return;
    setPicked((current) => new Set(current).add(cursor));
    setPath((current) => [
      ...current,
      {
        key: `reply-${choice.at_idx}-${choice.position}-${current.length}`,
        speaker: "me",
        body: choice.reply_body,
        body_en: choice.reply_body_en,
        idx: choice.at_idx,
      },
    ]);
    addLine(choice.goto_idx);
  };

  useEffect(() => {
    if (!auto || done || typing || pending.length > 0 || isSpeaking) return;
    const timeout = window.setTimeout(advance, ADVANCE_DELAY_MS / speed);
    return () => window.clearTimeout(timeout);
  }, [advance, auto, done, isSpeaking, pending.length, speed, typing]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [path.length, typing, pending.length]);

  useEffect(() => {
    if (activeLine && narration) {
      void speakLine(storyText(activeLine.body, activeLine.body_en, language), activeLine.speaker);
    }
  }, [activeLine, language, narration, speakLine]);

  const toggleNarration = () => {
    const next = !narration;
    unlockVoice();
    setNarration(next);
    if (!next) stopNarration();
  };

  const toggleHdVoice = () => {
    const next = !hdVoice;
    setHdVoice(next);
    if (next) unlockVoice();
    else kokoroStop();
    try {
      window.localStorage.setItem(HD_VOICE_KEY, next ? "1" : "0");
    } catch {
      // Private browsing can block storage; the choice just won't persist.
    }
  };

  const changeLanguage = (nextLanguage: "hi" | "en") => {
    unlockVoice();
    stopNarration();
    setLanguage(nextLanguage);
  };

  return (
    <FullScreenLayer open>
      <MotionConfig reducedMotion="user">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[130] flex flex-col overflow-hidden bg-background"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
          >
            <AnimatePresence mode="wait">
              {story.video_url ? (
                <motion.div
                  key="story-video"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.85 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8 }}
                  className="absolute inset-0"
                >
                  <video
                    src={story.video_url}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />
                </motion.div>
              ) : activeScene ? (
                <motion.img
                  key={activeScene.id}
                  src={activeScene.image}
                  alt=""
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 0.74, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <motion.div
                  key="story-canvas"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0"
                  style={{ background: story.gradient }}
                />
              )}
            </AnimatePresence>
            {/* Cinematic vignette to ensure chat bubbles remain crisp and readable */}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,7,16,.72)_0%,rgba(9,7,16,.65)_40%,rgba(9,7,16,.94)_100%)]" />
            <div className="absolute inset-0 bg-aurora opacity-15" />
          </div>

          <div className="relative z-10 min-h-0 flex-1 overflow-y-auto">
            <header
              className="relative z-10 flex items-center gap-3 px-4 pb-3"
              style={{ paddingTop: "calc(env(safe-area-inset-top,0px) + 12px)" }}
            >
              <CloseButton onClick={onClose} aria-label="Close story" className="glass-strong" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{title}</p>
                <p className="truncate text-[11px] text-muted-foreground">{activeSceneLabel}</p>
              </div>
              <button
                onClick={() => setAuto((current) => !current)}
                aria-label={auto ? "Pause autoplay" : "Play autoplay"}
                className="glass-strong flex h-10 w-10 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {auto ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
            </header>

            <div
              aria-hidden="true"
              className="relative z-10 mx-4 mb-2 h-1 overflow-hidden rounded-full bg-white/10"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                style={{ width: `${Math.max(3, Math.round(readingProgress * 100))}%` }}
              />
            </div>

            <div className="relative z-10 mx-4 mb-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 backdrop-blur-md">
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-foreground/55">
                  Anime chat story
                </p>
                <p className="truncate text-xs font-semibold">{activeSceneLabel || hook}</p>
              </div>
              <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold text-foreground/75">
                Scene {sceneIndex + 1}
                {scenes.length ? ` / ${scenes.length}` : ""}
              </span>
            </div>

            <div className="relative z-10 px-4 pb-5 pt-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                  <AudioLines className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">
                    {isRoom4B
                      ? language === "hi"
                        ? `अलग-अलग किरदारों की आवाज़ें ${narration ? "चालू" : "बंद"}`
                        : `Character voices ${narration ? "on" : "off"}`
                      : `Character voices ${narration ? "on" : "off"}`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {(isRoom4B || hasEnglish) && (
                    <div
                      role="group"
                      aria-label="Story language"
                      className="glass flex h-8 items-center gap-0.5 rounded-full p-0.5"
                    >
                      <button
                        onClick={() => changeLanguage("hi")}
                        aria-pressed={language === "hi"}
                        className={`rounded-full px-2 py-1 text-[10px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${language === "hi" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                      >
                        हिंदी
                      </button>
                      <button
                        onClick={() => changeLanguage("en")}
                        aria-pressed={language === "en"}
                        className={`rounded-full px-2 py-1 text-[10px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${language === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                      >
                        English
                      </button>
                    </div>
                  )}
                  <button
                    onClick={toggleNarration}
                    aria-label={narration ? "Turn narration off" : "Turn narration on"}
                    className="glass flex h-8 w-8 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {narration ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  </button>
                  {(isRoom4B || hasEnglish) && (
                    <button
                      onClick={toggleHdVoice}
                      aria-pressed={hdVoice}
                      title="HD character voices (Kokoro) run locally in your browser. English scenes download once; Hindi scenes use your device's most realistic voices."
                      className={`glass flex h-8 items-center gap-1 rounded-full px-2.5 text-[10px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${hdVoice ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {hdVoice && !hdVoiceReady && (hdVoiceLoading || hdVoiceProgress > 0) ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      {hdVoice
                        ? hdVoiceReady
                          ? "HD on"
                          : hdVoiceLoading || hdVoiceProgress > 0
                            ? `HD ${Math.round(hdVoiceProgress)}%`
                            : "HD on"
                        : "HD"}
                    </button>
                  )}
                  <div className="glass flex h-8 items-center gap-0.5 rounded-full px-1">
                    {SPEEDS.map((value) => (
                      <button
                        key={value}
                        onClick={() => setSpeed(value)}
                        aria-label={`Narration speed ${value}x`}
                        className={`rounded-full px-2 py-1 text-[10px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${speed === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                      >
                        {value}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {path.map((line) => (
                    <motion.div
                      key={line.key}
                      initial={{ opacity: 0, y: 12, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 420, damping: 30 }}
                      className={`${line.speaker === "narrator" ? "flex justify-center" : line.speaker === "me" ? "flex justify-end" : "flex justify-start"} [content-visibility:auto] [contain-intrinsic-size:auto_56px]`}
                    >
                      {line.speaker === "narrator" ? (
                        <span className="rounded-full border border-border/60 bg-card/80 px-3 py-1 text-center text-[11px] text-muted-foreground backdrop-blur">
                          {displayText(storyText(line.body, line.body_en, language))}
                        </span>
                      ) : (
                        <div
                          style={{ textShadow: "0 1px 7px rgba(0,0,0,.9)" }}
                          className={`chat-bubble max-w-[88%] rounded-2xl px-4 py-3 text-[18px] font-medium leading-snug text-white whitespace-pre-wrap break-words ${line.speaker === "me" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border border-white/10 bg-[var(--surface-bubble)]"}`}
                        >
                          {line.speaker !== "me" && (
                            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide opacity-70">
                              {speakerLabel(line.speaker, language)}
                            </p>
                          )}
                          {displayText(storyText(line.body, line.body_en, language))}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {typing && (
                  <div className={nextSpeaker === "me" ? "flex justify-end" : "flex justify-start"}>
                    <div className="chat-bubble flex gap-1 rounded-2xl border border-white/10 bg-[var(--surface-bubble)] px-4 py-3">
                      {[0, 1, 2].map((index) => (
                        <span
                          key={index}
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
                          style={{ animationDelay: `${index * 120}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            </div>
          </div>

          <footer
            className="glass-strong relative z-10 shrink-0 border-t border-border/60 px-4 pt-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom,0px) + 12px)" }}
          >
            {done ? (
              <div className="flex gap-2">
                <button
                  onClick={reset}
                  className="glass flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <RotateCcw className="h-4 w-4" />{" "}
                  {isRoom4B && language === "hi" ? "फिर से पढ़ें" : "Replay"}
                </button>
                <button
                  onClick={onLike}
                  className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${liked ? "bg-primary text-primary-foreground" : "glass"}`}
                >
                  <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />{" "}
                  {liked ? "Liked" : "Like"}
                </button>
              </div>
            ) : pending.length > 0 ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <GitBranch className="h-3 w-3" />{" "}
                  {language === "hi" && isRoom4B ? "रास्ता चुनो" : "Choose the scene"}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {pending.map((choice) => (
                    <button
                      key={`${choice.at_idx}-${choice.position}`}
                      onClick={() => choose(choice)}
                      className="glass h-11 rounded-full px-4 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {displayText(storyText(choice.label, choice.label_en, language))}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button
                onClick={advance}
                className="bg-primary text-primary-foreground flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {language === "hi" && isRoom4B ? "आगे बढ़ो" : "Tap to continue"}{" "}
                <ChevronsRight className="h-4 w-4" />
              </button>
            )}
          </footer>
        </motion.div>
      </MotionConfig>
    </FullScreenLayer>
  );
}
