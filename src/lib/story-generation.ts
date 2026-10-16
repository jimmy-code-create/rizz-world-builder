import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { sanitizeSpeakerName } from "@/lib/voice-cast";
import {
  STORY_LENGTH_PLANS,
  appendStoryChunk,
  assembleSagaFinale,
  buildChapterContext,
  type SagaBranch,
  type StoryLength,
} from "@/lib/story-length";
import {
  buildContinuationPrompt,
  buildFinalePrompt,
  buildOpeningPrompt,
  buildShortSystemPrompt,
  parseChunkLines,
  parseFinaleBranches,
  stripCodeFences,
} from "@/lib/story-prompt";

export const STORY_CATEGORIES = ["horror", "funny", "chaos", "cringe"] as const;
export type StoryCategory = (typeof STORY_CATEGORIES)[number];
export type StoryLanguage = "hi" | "en";
export type StoryVideoType = "horror_hallway" | "cyberpunk_neon" | "rain_window" | "cozy_room";

export const STORY_PRESET_VIDEOS: Record<StoryVideoType, string> = {
  horror_hallway: "https://upload.wikimedia.org/wikipedia/commons/9/9e/Misty_river_47_seconds.webm",
  cyberpunk_neon:
    "https://upload.wikimedia.org/wikipedia/commons/2/28/Traffic_at_dusk_%28time_lapse%29.webm",
  rain_window:
    "https://upload.wikimedia.org/wikipedia/commons/2/2e/Radevormwald_-_Raindrops_on_a_window_10_%281%29_ies.webm",
  cozy_room:
    "https://upload.wikimedia.org/wikipedia/commons/6/65/Fire_burning_in_a_fireplace_in_Bosnia_and_Herzegovina_%282026%29-bs.webm",
};

export type GeneratedStoryLine = {
  idx: number;
  /** Character display name: me, them, narrator, or a cast member (Dada, Chintu...). */
  speaker: string;
  body: string;
  body_en: string;
  chapter: string;
  next_idx: number | null;
};

export type GeneratedStoryChoice = {
  at_idx: number;
  position: number;
  label: string;
  label_en: string;
  reply_body: string;
  reply_body_en: string;
  goto_idx: number;
};

export type GeneratedStory = {
  title: string;
  hook: string;
  emoji: string;
  category: StoryCategory;
  them_name: string;
  me_name: string;
  video_type: StoryVideoType;
  lines: GeneratedStoryLine[];
  choices: GeneratedStoryChoice[];
};

export type StoryGenerationInput = {
  prompt: string;
  category: StoryCategory;
  language: StoryLanguage;
  /** short ≈ 15–30 messages, long ≈ 200–350, epic ≈ 1000–2000. */
  length?: StoryLength;
};

export type GeneratedStoryResult = {
  story: GeneratedStory;
  source: "ai" | "template";
  /** Why a built-in template was used instead of the AI. Surfaced in the UI. */
  reason: "ok" | "missing_key" | "request_failed";
};

const inputSchema = z.object({
  prompt: z.string().trim().min(4).max(500),
  category: z.enum(STORY_CATEGORIES),
  language: z.enum(["hi", "en"]),
  length: z.enum(["short", "long", "epic"]).optional().default("short"),
});

const sagaChunkSchema = z.object({
  prompt: z.string().trim().min(4).max(500),
  category: z.enum(STORY_CATEGORIES),
  language: z.enum(["hi", "en"]),
  length: z.enum(["long", "epic"]),
  chapterIndex: z.number().int().min(1).max(12),
  outline: z.array(z.string().max(120)).max(14).optional().default([]),
  context: z.string().max(6000).optional().default(""),
});

const FALLBACKS: Record<
  StoryCategory,
  {
    title: Record<StoryLanguage, string>;
    hook: Record<StoryLanguage, string>;
    emoji: string;
    them_name: string;
    video_type: StoryVideoType;
    opening: Array<{ speaker: GeneratedStoryLine["speaker"]; hi: string; en: string }>;
    choices: Array<{
      labelHi: string;
      labelEn: string;
      replyHi: string;
      replyEn: string;
      endHi: string;
      endEn: string;
    }>;
  }
> = {
  horror: {
    title: { hi: "तेरहवीं मंज़िल", en: "The Thirteenth Floor" },
    hook: {
      hi: "रात की लिफ़्ट एक ऐसे फ़्लोर पर रुकती है जो बिल्डिंग में है ही नहीं।",
      en: "A late-night elevator stops at a floor that isn't on the building directory.",
    },
    emoji: "👻",
    them_name: "Roommate",
    video_type: "horror_hallway",
    opening: [
      {
        speaker: "me",
        hi: "लिफ़्ट फिर से अपने आप रुक गई।",
        en: "The elevator stopped by itself again.",
      },
      { speaker: "them", hi: "कौन-सा फ़्लोर दिखा रहा है?", en: "What floor does it say?" },
      {
        speaker: "me",
        hi: "13. हमारी बिल्डिंग में 12 फ़्लोर ही हैं।",
        en: "13. This building only has 12 floors.",
      },
      {
        speaker: "them",
        hi: "दरवाज़े खुल रहे हैं। वहाँ कोई खड़ा है।",
        en: "The doors are opening. Someone is standing there.",
      },
    ],
    choices: [
      {
        labelHi: "दरवाज़ा बंद करने का बटन दबाओ",
        labelEn: "Hit the close-door button",
        replyHi: "मैंने सारे बटन एक साथ दबा दिए।",
        replyEn: "I mashed every button at once.",
        endHi: "लिफ़्ट नीचे पहुँची। फ़ोन पर नया मैसेज था: “अब तुम्हारी बारी।”",
        endEn: "The elevator reached the lobby. A new text arrived: “Your turn next.”",
      },
      {
        labelHi: "पूछो कि वहाँ कौन है",
        labelEn: "Ask who is there",
        replyHi: "मैंने दरवाज़े के बाहर आवाज़ लगाई।",
        replyEn: "I called out through the open doors.",
        endHi: "आवाज़ ने मेरा ही नाम लिया—मेरी ही आवाज़ में।",
        endEn: "The voice said my name—in my own voice.",
      },
    ],
  },
  funny: {
    title: { hi: "पहली डेट, आख़िरी चम्मच", en: "The First Date Spoon" },
    hook: {
      hi: "एक अजीब सी ग़लती पहली डेट को एक यादगार चैट में बदल देती है।",
      en: "One awkward mistake turns a first date into an unforgettable chat.",
    },
    emoji: "😂",
    them_name: "Date",
    video_type: "cozy_room",
    opening: [
      {
        speaker: "me",
        hi: "डेट बहुत अच्छी जा रही थी, फिर वेटर ने पूछा “दोनों के लिए एक बिल?”",
        en: "The date was going great until the server asked, “One check for both of you?”",
      },
      { speaker: "them", hi: "तुमने क्या कहा?", en: "What did you say?" },
      {
        speaker: "me",
        hi: "मैंने घबराकर कहा, “हम अभी तय कर रहे हैं।”",
        en: "I panicked and said, “We're still deciding.”",
      },
      {
        speaker: "them",
        hi: "और अब वह चम्मच लेकर वापस आ रहा है।",
        en: "And now the server is coming back with a spoon.",
      },
    ],
    choices: [
      {
        labelHi: "डेज़र्ट ऑर्डर करके बात संभालो",
        labelEn: "Save it with dessert",
        replyHi: "दो चम्मच वाली आइसक्रीम, प्लीज़।",
        replyEn: "Two-spoon ice cream, please.",
        endHi: "हमने डेज़र्ट शेयर किया। अगली डेट पर बिल पहले ही तय था।",
        endEn: "We shared dessert. The check was decided before our next date.",
      },
      {
        labelHi: "अपनी ही बात पर हँस दो",
        labelEn: "Laugh at yourself",
        replyHi: "मेरा दिमाग़ अभी buffering कर रहा है।",
        replyEn: "My brain is buffering right now.",
        endHi: "वह हँस पड़ी। चम्मच किसी और टेबल पर चला गया।",
        endEn: "They laughed. The spoon went to another table.",
      },
    ],
  },
  chaos: {
    title: { hi: "ग्रुप चैट का महा-कांड", en: "The Group Chat Incident" },
    hook: {
      hi: "एक गलत टैप से पूरा कैंपस उस पार्टी का इनवाइट पा जाता है।",
      en: "One wrong tap sends a party invite to the entire campus.",
    },
    emoji: "⚡",
    them_name: "Bestie",
    video_type: "cyberpunk_neon",
    opening: [
      {
        speaker: "me",
        hi: "मैंने पार्टी का इनवाइट सिर्फ़ तुम्हें भेजना था।",
        en: "I meant to send the party invite only to you.",
      },
      {
        speaker: "them",
        hi: "फिर पूरे कॉलेज को कैसे मिल गया?",
        en: "Then why did the whole college get it?",
      },
      {
        speaker: "me",
        hi: "क्योंकि “close friends” की जगह “all students” दब गया।",
        en: "Because I tapped “all students” instead of “close friends.”",
      },
      { speaker: "them", hi: "दरवाज़े पर डीन खड़े हैं।", en: "The dean is standing at the door." },
    ],
    choices: [
      {
        labelHi: "इसे थीम पार्टी बता दो",
        labelEn: "Call it a themed party",
        replyHi: "थीम है: जो भी हो रहा है, उसका नाम मत पूछना।",
        replyEn: "The theme is: don't ask what is happening.",
        endHi: "डीन ने भी एंट्री ली। अब यह आधिकारिक कैंपस इवेंट है।",
        endEn: "The dean joined in. It's now an official campus event.",
      },
      {
        labelHi: "सच बताकर मदद माँगो",
        labelEn: "Tell the truth and ask for help",
        replyHi: "यह गलती थी। क्या आप invite बंद करने में मदद करेंगे?",
        replyEn: "It was an accident. Can you help me shut the invite down?",
        endHi: "डीन ने लिंक बंद किया—फिर DJ से एक गाना माँग लिया।",
        endEn: "The dean shut off the link—and requested a song from the DJ.",
      },
    ],
  },
  cringe: {
    title: { hi: "गलत इंसान को वेव", en: "The Wrong-Person Wave" },
    hook: {
      hi: "एक छोटी सी awkward ग़लती के बाद चैट को बचाने के दो रास्ते हैं।",
      en: "One tiny awkward mistake leaves two ways to save the chat.",
    },
    emoji: "🫣",
    them_name: "Crush",
    video_type: "rain_window",
    opening: [
      {
        speaker: "me",
        hi: "मैंने तुम्हें कैफ़े में देखकर वेव किया।",
        en: "I waved when I saw you at the cafe.",
      },
      {
        speaker: "them",
        hi: "मैं तुम्हारे पीछे वाली टेबल पर थी।",
        en: "I was at the table behind you.",
      },
      {
        speaker: "me",
        hi: "हाँ। अब मुझे पता है कि तुमने वेव वापस नहीं किया।",
        en: "Right. Now I know you weren't waving back.",
      },
      {
        speaker: "them",
        hi: "मैंने किया था। बस तुम्हारे पीछे वाले को।",
        en: "I did wave back. Just at the person behind you.",
      },
    ],
    choices: [
      {
        labelHi: "ईमानदारी से हँस दो",
        labelEn: "Own the awkwardness",
        replyHi: "मैं अपनी ही कहानी का background character हूँ।",
        replyEn: "I'm the background character in my own story.",
        endHi: "वह हँसी। अगली बार उसने सबसे पहले तुम्हें वेव किया।",
        endEn: "They laughed. Next time, they waved to you first.",
      },
      {
        labelHi: "कॉफ़ी का ऑफ़र दो",
        labelEn: "Offer to buy a coffee",
        replyHi: "क्या मैं कम-से-कम तुम्हारी कॉफ़ी के लिए माफ़ी माँग सकता हूँ?",
        replyEn: "Can I at least apologize by buying your coffee?",
        endHi: "कॉफ़ी मिली। सही टेबल पहचानना अब भी सीखना है।",
        endEn: "You got coffee. You still need to learn which table is yours.",
      },
    ],
  },
};

function makeFallbackStory(input: StoryGenerationInput): GeneratedStory {
  const template = FALLBACKS[input.category];
  const lines: GeneratedStoryLine[] = template.opening.map((line, index) => ({
    idx: index + 1,
    speaker: line.speaker,
    body: line.hi,
    body_en: line.en,
    chapter: "opening",
    next_idx: index < template.opening.length - 1 ? index + 2 : null,
  }));

  template.choices.forEach((choice, index) => {
    const start = (index + 1) * 100;
    lines.push(
      {
        idx: start,
        speaker: "me",
        body: choice.replyHi,
        body_en: choice.replyEn,
        chapter: `ending-${index + 1}`,
        next_idx: start + 1,
      },
      {
        idx: start + 1,
        speaker: "them",
        body: choice.endHi,
        body_en: choice.endEn,
        chapter: `ending-${index + 1}`,
        next_idx: null,
      },
    );
  });

  return {
    title: template.title[input.language],
    hook: template.hook[input.language],
    emoji: template.emoji,
    category: input.category,
    them_name: template.them_name,
    me_name: "You",
    video_type: template.video_type,
    lines,
    choices: template.choices.map((choice, position) => ({
      at_idx: template.opening.length,
      position,
      label: choice.labelHi,
      label_en: choice.labelEn,
      reply_body: choice.replyHi,
      reply_body_en: choice.replyEn,
      goto_idx: (position + 1) * 100,
    })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function storyText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function normalizeStory(rawValue: unknown, input: StoryGenerationInput): GeneratedStory {
  const raw = isRecord(rawValue) ? rawValue : {};
  const fallback = makeFallbackStory(input);
  const rawLines = Array.isArray(raw.lines) ? raw.lines.filter(isRecord) : [];
  const rawLinesChoices = Array.isArray(raw.choices) ? raw.choices.filter(isRecord) : [];
  const usedIndexes = new Set<number>();
  const originalToNormalized = new Map<number, number>();

  const indexedLines = rawLines.map((line, position) => {
    const originalIndex = line.idx;
    const rawIdx =
      typeof originalIndex === "number" && Number.isInteger(originalIndex) && originalIndex >= 0
        ? originalIndex
        : position + 1;
    let idx = rawIdx;
    while (usedIndexes.has(idx)) idx += 1;
    usedIndexes.add(idx);
    if (!originalToNormalized.has(rawIdx)) {
      originalToNormalized.set(rawIdx, idx);
    }
    return { line, idx, rawIdx };
  });

  // Branch geometry, computed in the author's raw index space so long
  // branching stories link correctly even when the model omits next_idx.
  const rawIndexValues = (key: "at_idx" | "goto_idx") =>
    rawLinesChoices
      .map((choice) => choice[key])
      .filter(
        (value): value is number =>
          typeof value === "number" && Number.isInteger(value) && value >= 0,
      );
  const atIdxs = rawIndexValues("at_idx");
  const choicePointRaw = atIdxs.length > 0 ? Math.min(...atIdxs) : null;
  const branchStarts = [...new Set(rawIndexValues("goto_idx"))].sort((a, b) => a - b);
  const firstBranchStart = branchStarts.length > 0 ? branchStarts[0] : null;
  /** raw index where the branch containing this line ends (exclusive), null when not in a branch. */
  const branchEndFor = (rawIdx: number): number | null => {
    if (firstBranchStart == null || rawIdx < firstBranchStart) return null;
    for (let i = 0; i < branchStarts.length; i += 1) {
      if (
        branchStarts[i] <= rawIdx &&
        (i + 1 >= branchStarts.length || rawIdx < branchStarts[i + 1])
      ) {
        return i + 1 < branchStarts.length ? branchStarts[i + 1] : Number.POSITIVE_INFINITY;
      }
    }
    return Number.POSITIVE_INFINITY;
  };

  const lines: GeneratedStoryLine[] = indexedLines.map(({ line, idx, rawIdx }, position) => {
    const nextLine = indexedLines[position + 1];
    const rawNext = line.next_idx;
    const mappedNext =
      typeof rawNext === "number" && Number.isInteger(rawNext) && rawNext >= 0
        ? originalToNormalized.get(rawNext)
        : undefined;

    let inferredNext: number | null = null;
    if (nextLine) {
      const branchEnd = branchEndFor(rawIdx);
      if (branchEnd != null) {
        // Inside a branch: chain within the branch, never across the jump.
        inferredNext = nextLine.rawIdx >= branchEnd ? null : nextLine.idx;
      } else if (choicePointRaw != null && nextLine.rawIdx >= choicePointRaw) {
        // Before the choice point: stop at it unless the link is explicit.
        inferredNext = null;
      } else {
        inferredNext = nextLine.idx;
      }
    }

    const next_idx = mappedNext !== undefined && mappedNext !== idx ? mappedNext : inferredNext;
    // Named cast members keep their names so each character holds its voice;
    // anything unusable falls back to the two reader seats.
    const rawSpeaker = sanitizeSpeakerName(line.speaker);
    const speaker =
      rawSpeaker === "me" || rawSpeaker === "them" || rawSpeaker === "narrator"
        ? rawSpeaker
        : rawSpeaker.toLowerCase() === "you"
          ? "me"
          : rawSpeaker.toLowerCase() === "friend"
            ? "them"
            : rawSpeaker;
    const body = storyText(line.body, storyText(line.body_en, input.prompt));

    return {
      idx,
      speaker,
      body,
      body_en: storyText(line.body_en, body),
      chapter: storyText(line.chapter, "chapter"),
      next_idx,
    };
  });

  const storyLines = lines.length ? lines : fallback.lines;
  const choicePoint =
    (choicePointRaw != null ? originalToNormalized.get(choicePointRaw) : undefined) ??
    indexedLines[3]?.idx ??
    indexedLines.at(-1)?.idx ??
    storyLines[3]?.idx ??
    4;
  const choices: GeneratedStoryChoice[] = rawLinesChoices.map((choice, position) => {
    const generatedLabel = `Choice ${position + 1}`;
    const fallbackBranch =
      indexedLines[4 + position * 2]?.idx ??
      storyLines[4 + position * 2]?.idx ??
      storyLines[4]?.idx ??
      choicePoint;
    const atIdx =
      typeof choice.at_idx === "number"
        ? (originalToNormalized.get(choice.at_idx) ?? choicePoint)
        : choicePoint;
    const gotoIdx =
      typeof choice.goto_idx === "number"
        ? (originalToNormalized.get(choice.goto_idx) ?? fallbackBranch)
        : fallbackBranch;
    const label = storyText(choice.label, storyText(choice.label_en, generatedLabel));
    const reply = storyText(choice.reply_body, storyText(choice.reply_body_en, "..."));

    return {
      at_idx: atIdx,
      position,
      label,
      label_en: storyText(choice.label_en, label),
      reply_body: reply,
      reply_body_en: storyText(choice.reply_body_en, reply),
      goto_idx: gotoIdx,
    };
  });

  const videoTypes: StoryVideoType[] = [
    "horror_hallway",
    "cyberpunk_neon",
    "rain_window",
    "cozy_room",
  ];
  const videoType = videoTypes.includes(raw.video_type as StoryVideoType)
    ? (raw.video_type as StoryVideoType)
    : input.category === "horror"
      ? "horror_hallway"
      : "rain_window";

  return {
    title: storyText(raw.title, input.prompt.slice(0, 30)),
    hook: storyText(raw.hook, input.prompt),
    emoji: storyText(raw.emoji, "✨"),
    category: input.category,
    them_name: storyText(raw.them_name, "Friend"),
    me_name: storyText(raw.me_name, "You"),
    video_type: videoType,
    lines: storyLines,
    choices,
  };
}

const generateStoryServer = createServerFn({ method: "POST" })
  .inputValidator((input: StoryGenerationInput) => inputSchema.parse(input))

  .handler(async ({ data }) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return {
        story: makeFallbackStory(data),
        source: "template" as const,
        reason: "missing_key" as const,
      };
    }

    const systemPrompt = buildShortSystemPrompt(data);

    const model = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
    const payload: Record<string, unknown> = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `User Premise: "${data.prompt}"\n\nGenerate the complete JSON story for genre "${data.category}". Include title, hook, emoji, them_name, me_name, video_type, lines array, and choices array. Output ONLY clean JSON. Do not output markdown.`,
        },
      ],
      temperature: 0.8,
      max_completion_tokens: 8192,
      response_format: { type: "json_object" },
    };
    // The default brain is gpt-oss; skipping its reasoning pass keeps generation fast.
    if (model.includes("gpt-oss")) payload.reasoning_effort = "low";

    try {
      const response = await withRetries(
        () =>
          fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(45_000),
          }),
        2,
      );

      if (!response.ok) {
        console.error("Story generation failed with status", response.status);
        return {
          story: makeFallbackStory(data),
          source: "template" as const,
          reason: "request_failed" as const,
        };
      }

      const completion = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = completion.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("Groq returned no story text");

      const story = normalizeStory(JSON.parse(stripCodeFences(text)) as unknown, data);

      return { story, source: "ai" as const, reason: "ok" as const };
    } catch (error) {
      console.error("Story generation failed; using a built-in template.", error);
      return {
        story: makeFallbackStory(data),
        source: "template" as const,
        reason: "request_failed" as const,
      };
    }
  });

type SagaChunkInput = z.infer<typeof sagaChunkSchema>;

async function callGroqJson(
  apiKey: string,
  model: string,
  system: string,
  user: string,
  tokens: number,
  attempts = 2,
): Promise<unknown> {
  const payload: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.8,
    max_completion_tokens: tokens,
    response_format: { type: "json_object" },
  };
  // The default brain is gpt-oss; skipping its reasoning pass keeps generation fast.
  if (model.includes("gpt-oss")) payload.reasoning_effort = "low";
  const response = await withRetries(
    () =>
      fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60_000),
      }),
    attempts,
  );
  if (!response.ok) throw new Error(`Groq saga pass failed with status ${response.status}`);
  const completion = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Groq returned no saga text");
  return JSON.parse(stripCodeFences(text)) as unknown;
}

function groqModel(): string {
  return process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Transient Groq hiccups (cold model, 429/5xx, 60 s timeouts on slow tiers)
 * must not silently turn an epic saga into a template. Retries the pass a
 * few times with backoff; the caller still falls back gracefully when all
 * attempts fail.
 */
async function withRetries<T>(fn: () => Promise<T>, attempts: number): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(1000 * attempt);
    }
  }
  throw lastError;
}

/** First saga pass: chapter 1 plus the full chapter outline and story meta. */
const startSagaChunkServer = createServerFn({ method: "POST" })
  .inputValidator((input: SagaChunkInput) => sagaChunkSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return { source: "template" as const, reason: "missing_key" as const };
    const plan = STORY_LENGTH_PLANS[data.length];
    const { system, user } = buildOpeningPrompt(
      { prompt: data.prompt, category: data.category, language: data.language },
      plan.chapters,
      plan.chapterLines,
    );
    const raw = await callGroqJson(apiKey, groqModel(), system, user, plan.tokens, 3);
    const record = (raw ?? {}) as Record<string, unknown>;
    const chapter = `chapter-1`;
    return {
      source: "ai" as const,
      reason: "ok" as const,
      title: typeof record.title === "string" ? record.title : data.prompt.slice(0, 30),
      hook: typeof record.hook === "string" ? record.hook : data.prompt,
      emoji: typeof record.emoji === "string" ? record.emoji : "✨",
      them_name: typeof record.them_name === "string" ? record.them_name : "Friend",
      me_name: typeof record.me_name === "string" ? record.me_name : "You",
      video_type: typeof record.video_type === "string" ? record.video_type : "cozy_room",
      outline: Array.isArray(record.outline)
        ? (record.outline as unknown[])
            .filter((t): t is string => typeof t === "string")
            .slice(0, 14)
        : [],
      lines: parseChunkLines(record.lines, chapter, plan.chapterLines[1] + 20),
    };
  });

/** Middle saga passes: one chapter at a time from outline + rolling context. */
const continueSagaChunkServer = createServerFn({ method: "POST" })
  .inputValidator((input: SagaChunkInput) => sagaChunkSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return { lines: [] as GeneratedStoryLine[], reason: "missing_key" as const };
    const plan = STORY_LENGTH_PLANS[data.length];
    const outline =
      data.outline.length > 0
        ? data.outline
        : Array.from({ length: plan.chapters }, (_, i) => `Chapter ${i + 1}`);
    const { system, user } = buildContinuationPrompt(
      { prompt: data.prompt, category: data.category, language: data.language },
      data.chapterIndex,
      plan.chapters,
      plan.chapterLines,
      outline,
      data.context,
    );
    const raw = await callGroqJson(apiKey, groqModel(), system, user, plan.tokens);
    const record = (raw ?? {}) as Record<string, unknown>;
    return {
      lines: parseChunkLines(
        record.lines,
        `chapter-${data.chapterIndex}`,
        plan.chapterLines[1] + 20,
      ),
      reason: "ok" as const,
    };
  });

/** Final saga pass: the branching finale (choices + one ending per choice). */
const finaleSagaChunkServer = createServerFn({ method: "POST" })
  .inputValidator((input: SagaChunkInput) => sagaChunkSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return { branches: [] as SagaBranch[], reason: "missing_key" as const };
    const plan = STORY_LENGTH_PLANS[data.length];
    const { system, user } = buildFinalePrompt(
      { prompt: data.prompt, category: data.category, language: data.language },
      data.context,
    );
    const raw = await callGroqJson(apiKey, groqModel(), system, user, plan.tokens);
    return { branches: parseFinaleBranches(raw), reason: "ok" as const };
  });

function templateEndingBranches(category: StoryCategory): SagaBranch[] {
  const template = FALLBACKS[category];
  return template.choices.map((choice, position) => ({
    label: choice.labelHi,
    label_en: choice.labelEn,
    reply_body: choice.replyHi,
    reply_body_en: choice.replyEn,
    lines: [
      {
        idx: position * 2,
        speaker: "me",
        body: choice.replyHi,
        body_en: choice.replyEn,
        chapter: "finale",
        next_idx: null,
      },
      {
        idx: position * 2 + 1,
        speaker: "them",
        body: choice.endHi,
        body_en: choice.endEn,
        chapter: "finale",
        next_idx: null,
      },
    ],
  }));
}

export async function generateStory(input: StoryGenerationInput): Promise<GeneratedStoryResult> {
  return generateStoryServer({ data: input });
}

export type SagaProgress = { chapter: number; totalChapters: number; lines: number };

/**
 * Long / epic sagas are written chapter by chapter (one Groq pass per
 * chapter, ~50–200 messages each) and stitched into a 200–2000 message
 * story. Any failed pass stops the loop early and the saga still ends with
 * template branches, so a long story is always readable. Short stories use
 * the original single-pass path.
 */
export async function generateChatStory(
  input: StoryGenerationInput,
  onProgress?: (progress: SagaProgress) => void,
): Promise<GeneratedStoryResult> {
  if (input.length !== "long" && input.length !== "epic") {
    return generateChatStoryShort(input);
  }
  const plan = STORY_LENGTH_PLANS[input.length];
  // First non-ok reason seen across passes; reported when the saga degrades.
  let reason: GeneratedStoryResult["reason"] = "ok";
  const note = (value: GeneratedStoryResult["reason"]) => {
    if (reason === "ok") reason = value;
  };
  try {
    const base = { prompt: input.prompt, category: input.category, language: input.language };
    onProgress?.({ chapter: 1, totalChapters: plan.chapters, lines: 0 });
    const opening = await startSagaChunkServer({
      data: { ...base, length: input.length, chapterIndex: 1 },
    });
    if (opening.source !== "ai" || opening.lines.length === 0) {
      if (opening.source !== "ai") note(opening.reason);
      else note("request_failed");
      const fallback = await generateChatStoryShort(input);
      return { ...fallback, reason };
    }
    const outline =
      opening.outline.length > 0
        ? opening.outline
        : Array.from({ length: plan.chapters }, (_, i) => `Chapter ${i + 1}`);
    let lines = appendStoryChunk([], { lines: opening.lines, chapter: "chapter-1" });

    for (let chapterIndex = 2; chapterIndex <= plan.chapters; chapterIndex += 1) {
      if (lines.length >= plan.targetLines[1]) break;
      onProgress?.({ chapter: chapterIndex, totalChapters: plan.chapters, lines: lines.length });
      const chunk = await continueSagaChunkServer({
        data: {
          ...base,
          length: input.length,
          chapterIndex,
          outline,
          context: buildChapterContext(lines),
        },
      });
      note(chunk.reason);
      if (chunk.lines.length === 0) break;
      lines = appendStoryChunk(lines, { lines: chunk.lines, chapter: `chapter-${chapterIndex}` });
    }

    onProgress?.({ chapter: plan.chapters, totalChapters: plan.chapters, lines: lines.length });
    const finale = await finaleSagaChunkServer({
      data: {
        ...base,
        length: input.length,
        chapterIndex: plan.chapters,
        outline,
        context: buildChapterContext(lines),
      },
    });
    note(finale.reason);
    const branches =
      finale.branches.length > 0 ? finale.branches : templateEndingBranches(input.category);
    const { lines: fullLines, choices } = assembleSagaFinale(lines, branches);
    const videoTypes = ["horror_hallway", "cyberpunk_neon", "rain_window", "cozy_room"] as const;
    const video_type: StoryVideoType = (videoTypes as readonly string[]).includes(
      opening.video_type,
    )
      ? (opening.video_type as StoryVideoType)
      : input.category === "horror"
        ? "horror_hallway"
        : "rain_window";
    return {
      story: {
        title: opening.title,
        hook: opening.hook,
        emoji: opening.emoji,
        category: input.category,
        them_name: opening.them_name,
        me_name: opening.me_name,
        video_type,
        lines: fullLines,
        choices,
      },
      source: "ai",
      reason,
    };
  } catch (err) {
    console.warn("Using built-in story generator:", err);
  }
  const fallback = makeFallbackStory(input);
  return {
    story: fallback,
    source: "template",
    reason: reason === "ok" ? "request_failed" : reason,
  };
}

async function generateChatStoryShort(input: StoryGenerationInput): Promise<GeneratedStoryResult> {
  try {
    const raw: unknown = await generateStory(input);
    const r = raw as
      (Partial<GeneratedStoryResult> & { title?: string; lines?: unknown }) | null | undefined;
    const story = r?.story ?? (r?.title && r?.lines ? (raw as GeneratedStory) : undefined);
    if (story) {
      return {
        story,
        source: r?.source ?? "ai",
        reason: r?.reason ?? (r?.source === "template" ? "request_failed" : "ok"),
      };
    }
  } catch (err) {
    console.warn("Using built-in story generator:", err);
  }
  const fallback = makeFallbackStory(input);
  return { story: fallback, source: "template", reason: "request_failed" };
}

const STORY_GRADIENTS: Record<StoryCategory, string> = {
  horror: "linear-gradient(135deg,#0f172a,#ef4444)",
  funny: "linear-gradient(135deg,#ff2e88,#ff9a3c)",
  chaos: "linear-gradient(135deg,#22d3ee,#7c3aed)",
  cringe: "linear-gradient(135deg,#f472b6,#facc15)",
};

/**
 * PostgREST payloads get fragile on very long stories, and a failed insert
 * rolls the whole save back. Long uploads are written in batches instead.
 */
const STORY_INSERT_BATCH = 300;

export async function saveGeneratedStoryToSupabase(story: GeneratedStory): Promise<string> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) throw new Error("Sign in to save a generated story.");

  const slugBase =
    story.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "story";
  const slug = `story-${slugBase}-${crypto.randomUUID().slice(0, 8)}`;
  const wordCount = story.lines.reduce(
    (total, line) => total + line.body.trim().split(/\s+/).filter(Boolean).length,
    0,
  );

  const { data: savedStory, error: storyError } = await supabase
    .from("chat_stories")
    .insert({
      slug,
      title: story.title,
      hook: story.hook,
      emoji: story.emoji,
      category: story.category,
      gradient: STORY_GRADIENTS[story.category],
      them_name: story.them_name,
      me_name: story.me_name,
      word_count: wordCount,
      is_branching: story.choices.length > 0,
      created_by: user.id,
      video_url: STORY_PRESET_VIDEOS[story.video_type] ?? null,
    })
    .select("id")
    .single();

  if (storyError || !savedStory) {
    throw new Error(storyError?.message ?? "Could not save the generated story.");
  }

  const lineRows = story.lines.map((line) => ({
    story_id: savedStory.id,
    idx: line.idx,
    speaker: line.speaker,
    body: line.body,
    body_en: line.body_en,
    chapter: line.chapter,
    next_idx: line.next_idx,
  }));
  for (let start = 0; start < lineRows.length; start += STORY_INSERT_BATCH) {
    const { error: linesError } = await supabase
      .from("chat_story_lines")
      .insert(lineRows.slice(start, start + STORY_INSERT_BATCH));
    if (linesError) {
      await supabase.from("chat_stories").delete().eq("id", savedStory.id);
      throw new Error(linesError.message);
    }
  }

  if (story.choices.length > 0) {
    const choiceRows = story.choices.map((choice) => ({
      story_id: savedStory.id,
      at_idx: choice.at_idx,
      position: choice.position,
      label: choice.label,
      label_en: choice.label_en,
      reply_body: choice.reply_body,
      reply_body_en: choice.reply_body_en,
      goto_idx: choice.goto_idx,
    }));
    for (let start = 0; start < choiceRows.length; start += STORY_INSERT_BATCH) {
      const { error: choicesError } = await supabase
        .from("chat_story_choices")
        .insert(choiceRows.slice(start, start + STORY_INSERT_BATCH));
      if (choicesError) {
        await supabase.from("chat_stories").delete().eq("id", savedStory.id);
        throw new Error(choicesError.message);
      }
    }
  }

  return savedStory.id;
}
