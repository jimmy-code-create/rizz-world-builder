import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import {
  AudioLines,
  ChevronsRight,
  GitBranch,
  Heart,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { FullScreenLayer } from "@/components/FullScreenLayer";
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
};

type Bubble = { key: string; speaker: string; body: string; body_en?: string; idx: number };
type Scene = { id: string; label: string; image: string };

const ROOM_4B_SCENES: Scene[] = [
  { id: "scene-1", label: ROOM_4B_SCENE_LABELS["scene-1"].en, image: panelOne },
  { id: "scene-2", label: ROOM_4B_SCENE_LABELS["scene-2"].en, image: panelTwo },
  { id: "scene-3", label: ROOM_4B_SCENE_LABELS["scene-3"].en, image: panelThree },
  { id: "scene-4", label: ROOM_4B_SCENE_LABELS["scene-4"].en, image: panelFour },
];

const SPEEDS = [1, 1.5, 2] as const;
type NarrationLanguage = "hi" | "en";

const VOICE_PROFILES: Record<string, { voiceSlot: number; pitch: number; volume: number }> = {
  narrator: { voiceSlot: 0, pitch: 0.9, volume: 0.88 },
  me: { voiceSlot: 1, pitch: 1.02, volume: 1 },
  Asha: { voiceSlot: 2, pitch: 1.26, volume: 0.96 },
  Kabir: { voiceSlot: 3, pitch: 0.78, volume: 0.94 },
  Echo: { voiceSlot: 4, pitch: 0.62, volume: 0.78 },
};

const VOICE_NAME_PREFERENCES: Record<NarrationLanguage, Record<string, string[]>> = {
  en: {
    narrator: ["Google UK English Female", "Microsoft Zira", "Samantha"],
    me: ["Google US English", "Daniel", "Alex", "Microsoft David"],
    Asha: ["Microsoft Aria", "Samantha", "Google UK English Female"],
    Kabir: ["Microsoft Ryan", "Daniel", "Google US English"],
    Echo: ["Microsoft Zira", "Google UK English Female", "Samantha"],
  },
  hi: {
    narrator: ["Google हिन्दी", "Lekha", "Microsoft Hemant"],
    me: ["Google हिन्दी", "Madhur", "Hemant"],
    Asha: ["Lekha", "Swara", "Google हिन्दी"],
    Kabir: ["Hemant", "Madhur", "Google हिन्दी"],
    Echo: ["Google हिन्दी", "Lekha", "Hemant"],
  },
};

function selectNarrationVoice(
  voices: SpeechSynthesisVoice[],
  language: NarrationLanguage,
  speaker: string,
  voiceSlot: number,
) {
  const locale = language === "hi" ? "hi-IN" : "en-IN";
  const languageVoices = voices
    .filter((voice) => voice.lang.toLowerCase().startsWith(language))
    .sort((a, b) => a.name.localeCompare(b.name));
  const exactLocaleVoices = languageVoices.filter((voice) => voice.lang.toLowerCase() === locale.toLowerCase());
  const pool = exactLocaleVoices.length > 0 ? exactLocaleVoices : languageVoices;
  if (pool.length === 0) return undefined;

  const preferredNames = VOICE_NAME_PREFERENCES[language][speaker] ?? [];
  for (const preferredName of preferredNames) {
    const match = pool.find((voice) => voice.name.toLowerCase().includes(preferredName.toLowerCase()));
    if (match) return match;
  }

  return pool[voiceSlot % pool.length];
}

function storyText(hindi: string, english: string | undefined, language: "hi" | "en") {
  return language === "hi" ? hindi : english ?? hindi;
}

function speakerLabel(speaker: string, language: "hi" | "en") {
  if (speaker === "Asha") return language === "hi" ? "आशा" : "Asha";
  if (speaker === "Kabir") return language === "hi" ? "कबीर" : "Kabir";
  if (speaker === "Echo") return language === "hi" ? "तुम्हारा नंबर" : "Your number";
  return speaker;
}

export function ChatStoryPlayer({
  story,
  lines,
  choices = [],
  liked,
  onLike,
  onClose,
}: {
  story: ChatStory;
  lines: StoryLine[];
  choices?: StoryChoice[];
  liked: boolean;
  onLike: () => void;
  onClose: () => void;
}) {
  const isRoom4B = story.slug === "room-4b" || story.title.toLowerCase().includes("room 4b");
  const storyLines = isRoom4B ? ROOM_4B_LINES : lines;
  const storyChoices = isRoom4B ? ROOM_4B_CHOICES : choices;
  const byIdx = useMemo(() => new Map(storyLines.map((line) => [line.idx, line])), [storyLines]);
  const sorted = useMemo(() => [...storyLines].sort((a, b) => a.idx - b.idx), [storyLines]);
  const first = sorted[0]?.idx;
  const scenes = isRoom4B ? ROOM_4B_SCENES : [];

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
  const [language, setLanguage] = useState<"hi" | "en">("hi");
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synthesis = window.speechSynthesis;
    const refreshVoices = () => {
      const voices = synthesis.getVoices();
      if (voices.length > 0) setAvailableVoices(voices);
    };

    refreshVoices();
    synthesis.addEventListener("voiceschanged", refreshVoices);
    const retry = window.setTimeout(refreshVoices, 300);
    return () => {
      window.clearTimeout(retry);
      synthesis.removeEventListener("voiceschanged", refreshVoices);
    };
  }, []);

  const stopNarration = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    speechRef.current = null;
    setIsSpeaking(false);
  }, []);

  const speak = useCallback((text: string, speaker = "narrator") => {
    if (!narration || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    stopNarration();
    const utterance = new SpeechSynthesisUtterance(text);
    const spokenLanguage = isRoom4B ? language : /[\u0900-\u097F]/.test(text) ? "hi" : "en";
    const locale = spokenLanguage === "hi" ? "hi-IN" : "en-IN";
    const profile = VOICE_PROFILES[speaker] ?? VOICE_PROFILES.narrator;
    utterance.lang = locale;
    utterance.rate = speed;
    utterance.pitch = profile.pitch;
    utterance.volume = profile.volume;
    const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
    const voice = selectNarrationVoice(voices, spokenLanguage, speaker, profile.voiceSlot);
    if (voice) utterance.voice = voice;
    const finishSpeaking = () => {
      if (speechRef.current === utterance) {
        speechRef.current = null;
        setIsSpeaking(false);
      }
    };
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = finishSpeaking;
    utterance.onerror = finishSpeaking;
    speechRef.current = utterance;
    setIsSpeaking(true);
    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      finishSpeaking();
    }
  }, [availableVoices, isRoom4B, language, narration, speed, stopNarration]);

  const reset = useCallback(() => {
    stopNarration();
    if (first == null) return;
    const line = byIdx.get(first);
    if (!line) return;
    setPath([{ key: `line-${first}`, speaker: line.speaker, body: line.body, body_en: line.body_en, idx: first }]);
    setCursor(first);
    setPicked(new Set());
    setTyping(false);
  }, [byIdx, first, stopNarration]);

  useEffect(() => {
    reset();
  }, [reset, story.id]);

  useEffect(() => () => stopNarration(), [stopNarration]);

  const nextOf = (idx: number): number | null => {
    const line = byIdx.get(idx);
    if (line?.next_idx != null) return line.next_idx;
    if (line?.is_terminal) return null;
    const position = sorted.findIndex((item) => item.idx === idx);
    const next = sorted[position + 1];
    if (!next) return null;
    return Math.floor(next.idx / 100) === Math.floor(idx / 100) ? next.idx : null;
  };

  const pending = cursor != null && !picked.has(cursor) ? choicesAt.get(cursor) ?? [] : [];
  const nextIdx = cursor == null ? null : nextOf(cursor);
  const done = pending.length === 0 && nextIdx == null;
  const nextSpeaker = nextIdx != null ? byIdx.get(nextIdx)?.speaker : undefined;
  const activeLine = cursor != null ? byIdx.get(cursor) : undefined;
  const activeScene = scenes.find((scene) => scene.id === activeLine?.chapter) ?? scenes[0];
  const sceneIndex = Math.max(0, scenes.findIndex((scene) => scene.id === activeScene?.id));
  const title = isRoom4B ? ROOM_4B_TITLE[language] : story.title;
  const hook = isRoom4B ? ROOM_4B_HOOK[language] : story.hook;
  const activeSceneLabel = activeScene
    ? isRoom4B
      ? ROOM_4B_SCENE_LABELS[activeScene.id]?.[language] ?? activeScene.label
      : activeScene.label
    : story.them_name;

  const addLine = useCallback((idx: number) => {
    const line = byIdx.get(idx);
    if (!line) return;
    setPath((current) => [...current, { key: `line-${idx}-${current.length}`, speaker: line.speaker, body: line.body, body_en: line.body_en, idx }]);
    setCursor(idx);
  }, [byIdx]);

  const advance = useCallback(() => {
    if (typing || done || pending.length > 0 || nextIdx == null) return;
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      addLine(nextIdx);
    }, 420);
  }, [addLine, done, nextIdx, pending.length, typing]);

  const choose = (choice: StoryChoice) => {
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
    const timeout = window.setTimeout(advance, 1250);
    return () => window.clearTimeout(timeout);
  }, [advance, auto, done, isSpeaking, pending.length, typing]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [path.length, typing, pending.length]);

  useEffect(() => {
    if (activeLine && narration) {
      speak(storyText(activeLine.body, activeLine.body_en, language), activeLine.speaker);
    }
  }, [activeLine, language, narration, speak]);

  const toggleNarration = () => {
    const next = !narration;
    setNarration(next);
    if (!next) stopNarration();
  };

  const changeLanguage = (nextLanguage: "hi" | "en") => {
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
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <AnimatePresence mode="wait">
            {activeScene ? (
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
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,7,16,.64)_0%,rgba(9,7,16,.62)_40%,rgba(9,7,16,.92)_100%)]" />
          <div className="absolute inset-0 bg-aurora opacity-20" />
        </div>

        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto">

          <header
            className="relative z-10 flex items-center gap-3 px-4 pb-3"
            style={{ paddingTop: "calc(env(safe-area-inset-top,0px) + 12px)" }}
          >
            <button onClick={onClose} aria-label="Close story" className="glass-strong flex h-10 w-10 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)]">
              <X className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{title}</p>
              <p className="truncate text-[11px] text-muted-foreground">{activeSceneLabel}</p>
            </div>
            <button
              onClick={() => setAuto((current) => !current)}
              aria-label={auto ? "Pause autoplay" : "Play autoplay"}
              className="glass-strong flex h-10 w-10 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)]"
            >
              {auto ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
          </header>

          <div className="relative z-10 mx-4 mb-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 backdrop-blur-md">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-foreground/55">Anime chat story</p>
              <p className="truncate text-xs font-semibold">{activeSceneLabel || hook}</p>
            </div>
            <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold text-foreground/75">
              Scene {sceneIndex + 1}{scenes.length ? ` / ${scenes.length}` : ""}
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
                {isRoom4B && (
                  <div role="group" aria-label="Story language" className="glass flex h-8 items-center gap-0.5 rounded-full p-0.5">
                    <button
                      onClick={() => changeLanguage("hi")}
                      aria-pressed={language === "hi"}
                      className={`rounded-full px-2 py-1 text-[10px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)] ${language === "hi" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                    >
                      हिंदी
                    </button>
                    <button
                      onClick={() => changeLanguage("en")}
                      aria-pressed={language === "en"}
                      className={`rounded-full px-2 py-1 text-[10px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)] ${language === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                    >
                      English
                    </button>
                  </div>
                )}
                <button onClick={toggleNarration} aria-label={narration ? "Turn narration off" : "Turn narration on"} className="glass flex h-8 w-8 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)]">
                  {narration ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </button>
                <div className="glass flex h-8 items-center gap-0.5 rounded-full px-1">
                  {SPEEDS.map((value) => (
                    <button
                      key={value}
                      onClick={() => setSpeed(value)}
                      aria-label={`Narration speed ${value}x`}
                      className={`rounded-full px-2 py-1 text-[10px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)] ${speed === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
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
                    className={line.speaker === "narrator" ? "flex justify-center" : line.speaker === "me" ? "flex justify-end" : "flex justify-start"}
                  >
                    {line.speaker === "narrator" ? (
                      <span className="rounded-full border border-border/60 bg-card/80 px-3 py-1 text-center text-[11px] text-muted-foreground backdrop-blur">
                        {storyText(line.body, line.body_en, language)}
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
                        {storyText(line.body, line.body_en, language)}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {typing && (
                <div className={nextSpeaker === "me" ? "flex justify-end" : "flex justify-start"}>
                  <div className="chat-bubble flex gap-1 rounded-2xl border border-white/10 bg-[var(--surface-bubble)] px-4 py-3">
                    {[0, 1, 2].map((index) => <span key={index} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${index * 120}ms` }} />)}
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
              <button onClick={reset} className="glass flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)]">
                <RotateCcw className="h-4 w-4" /> {isRoom4B && language === "hi" ? "फिर से पढ़ें" : "Replay"}
              </button>
              <button onClick={onLike} className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)] ${liked ? "bg-primary text-primary-foreground" : "glass"}`}>
                <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} /> {liked ? "Liked" : "Like"}
              </button>
            </div>
          ) : pending.length > 0 ? (
            <div className="space-y-2">
              <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground"><GitBranch className="h-3 w-3" /> {language === "hi" && isRoom4B ? "रास्ता चुनो" : "Choose the scene"}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {pending.map((choice) => (
                  <button key={`${choice.at_idx}-${choice.position}`} onClick={() => choose(choice)} className="glass h-11 rounded-full px-4 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)]">
                    {storyText(choice.label, choice.label_en, language)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button onClick={advance} className="bg-gradient-primary flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)]">
              {language === "hi" && isRoom4B ? "आगे बढ़ो" : "Tap for next scene"} <ChevronsRight className="h-4 w-4" />
            </button>
          )}
        </footer>
      </motion.div>
      </MotionConfig>
    </FullScreenLayer>
  );
}