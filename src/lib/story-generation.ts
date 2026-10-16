import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

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
  speaker: "me" | "them" | "narrator";
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
};

export type GeneratedStoryResult = {
  story: GeneratedStory;
  source: "ai" | "template";
};

const inputSchema = z.object({
  prompt: z.string().trim().min(4).max(500),
  category: z.enum(STORY_CATEGORIES),
  language: z.enum(["hi", "en"]),
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
    const speaker =
      line.speaker === "me" || line.speaker === "them" || line.speaker === "narrator"
        ? line.speaker
        : position % 2 === 0
          ? "me"
          : "them";
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
      return { story: makeFallbackStory(data), source: "template" as const };
    }

    const systemPrompt = [
      "Write an original, vivid branching chat story for the RIZZ app as a text-message conversation.",
      `The selected genre is ${data.category}; keep the story firmly in that genre with real tension, humor or dread.`,
      `Write title and hook in ${data.language === "hi" ? "Hindi" : "English"}.`,
      "For every line, body must be Hindi and body_en must be its natural English translation.",
      "For every choice, label and reply_body must be Hindi; label_en and reply_body_en must be natural English translations.",
      "Use only me, them, or narrator as speaker values.",
      "Structure: 8 to 12 opening messages that build the premise with escalating beats and small cliffhangers, then one choice point with exactly 2 or 3 choices.",
      "Each choice starts its own branch of 4 to 8 messages with its own twist, and each branch ends on a strong final line.",
      "Messages should read like real texts: 1-2 sentences, personality, occasional interjections (Hmm, wait—, no no no). Narration lines set the scene in one sentence.",
      "You may sprinkle spoken voice effects so the narration sounds human: [pause], [sigh], [laughs], [gasp], [whisper]...[/whisper]. Use the exact same effect tokens in body and body_en, at most one effect per line.",
      "Use unique integer indexes, next_idx links for linear sequences, and null at the choice point and at every branch ending.",
      "Set each choice's at_idx to the last opening line and goto_idx to the first line of its own branch.",
      "Use a relevant video_type from horror_hallway, cyberpunk_neon, rain_window, or cozy_room.",
      "Return only the JSON matching the provided schema. Do not include markdown.",
    ].join(" ");

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
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(45_000),
      });

      if (!response.ok) {
        console.error("Story generation failed with status", response.status);
        return { story: makeFallbackStory(data), source: "template" as const };
      }

      const completion = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = completion.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("Groq returned no story text");

      // Strip any ```json ... ``` code fences the model sends
      const cleanedText = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      const story = normalizeStory(JSON.parse(cleanedText) as unknown, data);

      return { story, source: "ai" as const };
    } catch (error) {
      console.error("Story generation failed; using a built-in template.", error);
      return { story: makeFallbackStory(data), source: "template" as const };
    }
  });

export async function generateStory(input: StoryGenerationInput): Promise<GeneratedStoryResult> {
  return generateStoryServer({ data: input });
}

export async function generateChatStory(input: StoryGenerationInput): Promise<GeneratedStory> {
  try {
    const raw: unknown = await generateStory(input);
    const r = raw as { story?: GeneratedStory; title?: string; lines?: unknown } | null | undefined;
    const story = r?.story ?? (r?.title && r?.lines ? (raw as GeneratedStory) : undefined);
    if (story) return story;
  } catch (err) {
    console.warn("Using built-in story generator:", err);
  }
  return makeFallbackStory(input);
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
