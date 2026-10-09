import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

export const STORY_CATEGORIES = ["horror", "funny", "chaos", "cringe"] as const;
export type StoryCategory = (typeof STORY_CATEGORIES)[number];
export type StoryLanguage = "hi" | "en";
export type StoryVideoType = "horror_hallway" | "cyberpunk_neon" | "rain_window" | "cozy_room";

export const STORY_PRESET_VIDEOS: Record<StoryVideoType, string> = {
  horror_hallway: "https://assets.mixkit.co/videos/preview/mixkit-creepy-dark-hallway-with-flickering-lights-42938-large.mp4",
  cyberpunk_neon: "https://assets.mixkit.co/videos/preview/mixkit-neon-city-lights-at-night-42962-large.mp4",
  rain_window: "https://assets.mixkit.co/videos/preview/mixkit-rain-falling-on-a-window-pane-at-night-42861-large.mp4",
  cozy_room: "https://assets.mixkit.co/videos/preview/mixkit-fire-burning-in-a-fireplace-43103-large.mp4",
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
  source: "gemini" | "template";
};

const inputSchema = z.object({
  prompt: z.string().trim().min(4).max(500),
  category: z.enum(STORY_CATEGORIES),
  language: z.enum(["hi", "en"]),
});

const generatedStorySchema = z.object({
  title: z.string().min(1).max(100),
  hook: z.string().min(1).max(240),
  emoji: z.string().min(1).max(16),
  category: z.enum(STORY_CATEGORIES),
  them_name: z.string().min(1).max(40),
  me_name: z.string().min(1).max(40),
  video_type: z.enum(["horror_hallway", "cyberpunk_neon", "rain_window", "cozy_room"]),
  lines: z.array(z.object({
    idx: z.number().int().nonnegative(),
    speaker: z.enum(["me", "them", "narrator"]),
    body: z.string().min(1).max(800),
    body_en: z.string().min(1).max(800),
    chapter: z.string().min(1).max(60),
    next_idx: z.number().int().nonnegative().nullable(),
  }).strict()).min(6).max(36),
  choices: z.array(z.object({
    at_idx: z.number().int().nonnegative(),
    position: z.number().int().nonnegative(),
    label: z.string().min(1).max(120),
    label_en: z.string().min(1).max(120),
    reply_body: z.string().min(1).max(500),
    reply_body_en: z.string().min(1).max(500),
    goto_idx: z.number().int().nonnegative(),
  }).strict()).min(2).max(8),
}).strict().superRefine((story, context) => {
  const indices = new Set<number>();
  for (const line of story.lines) {
    if (indices.has(line.idx)) {
      context.addIssue({ code: "custom", message: `Duplicate line index ${line.idx}` });
    }
    indices.add(line.idx);
  }

  for (const line of story.lines) {
    if (line.next_idx != null && !indices.has(line.next_idx)) {
      context.addIssue({ code: "custom", message: `Missing next line ${line.next_idx}` });
    }
  }
  for (const choice of story.choices) {
    if (!indices.has(choice.at_idx)) {
      context.addIssue({ code: "custom", message: `Missing choice line ${choice.at_idx}` });
    }
    if (!indices.has(choice.goto_idx)) {
      context.addIssue({ code: "custom", message: `Missing choice destination ${choice.goto_idx}` });
    }
  }
});

const geminiResponseSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    hook: { type: "STRING" },
    emoji: { type: "STRING" },
    category: { type: "STRING", enum: [...STORY_CATEGORIES] },
    them_name: { type: "STRING" },
    me_name: { type: "STRING" },
    video_type: {
      type: "STRING",
      enum: ["horror_hallway", "cyberpunk_neon", "rain_window", "cozy_room"],
    },
    lines: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          idx: { type: "INTEGER" },
          speaker: { type: "STRING", enum: ["me", "them", "narrator"] },
          body: { type: "STRING" },
          body_en: { type: "STRING" },
          chapter: { type: "STRING" },
          next_idx: { type: "INTEGER", nullable: true },
        },
        required: ["idx", "speaker", "body", "body_en", "chapter", "next_idx"],
      },
    },
    choices: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          at_idx: { type: "INTEGER" },
          position: { type: "INTEGER" },
          label: { type: "STRING" },
          label_en: { type: "STRING" },
          reply_body: { type: "STRING" },
          reply_body_en: { type: "STRING" },
          goto_idx: { type: "INTEGER" },
        },
        required: [
          "at_idx",
          "position",
          "label",
          "label_en",
          "reply_body",
          "reply_body_en",
          "goto_idx",
        ],
      },
    },
  },
  required: [
    "title",
    "hook",
    "emoji",
    "category",
    "them_name",
    "me_name",
    "video_type",
    "lines",
    "choices",
  ],
};

const FALLBACKS: Record<StoryCategory, {
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
}> = {
  horror: {
    title: { hi: "तेरहवीं मंज़िल", en: "The Thirteenth Floor" },
    hook: { hi: "रात की लिफ़्ट एक ऐसे फ़्लोर पर रुकती है जो बिल्डिंग में है ही नहीं।", en: "A late-night elevator stops at a floor that isn't on the building directory." },
    emoji: "👻",
    them_name: "Roommate",
    video_type: "horror_hallway",
    opening: [
      { speaker: "me", hi: "लिफ़्ट फिर से अपने आप रुक गई।", en: "The elevator stopped by itself again." },
      { speaker: "them", hi: "कौन-सा फ़्लोर दिखा रहा है?", en: "What floor does it say?" },
      { speaker: "me", hi: "13. हमारी बिल्डिंग में 12 फ़्लोर ही हैं।", en: "13. This building only has 12 floors." },
      { speaker: "them", hi: "दरवाज़े खुल रहे हैं। वहाँ कोई खड़ा है।", en: "The doors are opening. Someone is standing there." },
    ],
    choices: [
      { labelHi: "दरवाज़ा बंद करने का बटन दबाओ", labelEn: "Hit the close-door button", replyHi: "मैंने सारे बटन एक साथ दबा दिए।", replyEn: "I mashed every button at once.", endHi: "लिफ़्ट नीचे पहुँची। फ़ोन पर नया मैसेज था: “अब तुम्हारी बारी।”", endEn: "The elevator reached the lobby. A new text arrived: “Your turn next.”" },
      { labelHi: "पूछो कि वहाँ कौन है", labelEn: "Ask who is there", replyHi: "मैंने दरवाज़े के बाहर आवाज़ लगाई।", replyEn: "I called out through the open doors.", endHi: "आवाज़ ने मेरा ही नाम लिया—मेरी ही आवाज़ में।", endEn: "The voice said my name—in my own voice." },
    ],
  },
  funny: {
    title: { hi: "पहली डेट, आख़िरी चम्मच", en: "The First Date Spoon" },
    hook: { hi: "एक अजीब सी ग़लती पहली डेट को एक यादगार चैट में बदल देती है।", en: "One awkward mistake turns a first date into an unforgettable chat." },
    emoji: "😂",
    them_name: "Date",
    video_type: "cozy_room",
    opening: [
      { speaker: "me", hi: "डेट बहुत अच्छी जा रही थी, फिर वेटर ने पूछा “दोनों के लिए एक बिल?”", en: "The date was going great until the server asked, “One check for both of you?”" },
      { speaker: "them", hi: "तुमने क्या कहा?", en: "What did you say?" },
      { speaker: "me", hi: "मैंने घबराकर कहा, “हम अभी तय कर रहे हैं।”", en: "I panicked and said, “We're still deciding.”" },
      { speaker: "them", hi: "और अब वह चम्मच लेकर वापस आ रहा है।", en: "And now the server is coming back with a spoon." },
    ],
    choices: [
      { labelHi: "डेज़र्ट ऑर्डर करके बात संभालो", labelEn: "Save it with dessert", replyHi: "दो चम्मच वाली आइसक्रीम, प्लीज़।", replyEn: "Two-spoon ice cream, please.", endHi: "हमने डेज़र्ट शेयर किया। अगली डेट पर बिल पहले ही तय था।", endEn: "We shared dessert. The check was decided before our next date." },
      { labelHi: "अपनी ही बात पर हँस दो", labelEn: "Laugh at yourself", replyHi: "मेरा दिमाग़ अभी buffering कर रहा है।", replyEn: "My brain is buffering right now.", endHi: "वह हँस पड़ी। चम्मच किसी और टेबल पर चला गया।", endEn: "They laughed. The spoon went to another table." },
    ],
  },
  chaos: {
    title: { hi: "ग्रुप चैट का महा-कांड", en: "The Group Chat Incident" },
    hook: { hi: "एक गलत टैप से पूरा कैंपस उस पार्टी का इनवाइट पा जाता है।", en: "One wrong tap sends a party invite to the entire campus." },
    emoji: "⚡",
    them_name: "Bestie",
    video_type: "cyberpunk_neon",
    opening: [
      { speaker: "me", hi: "मैंने पार्टी का इनवाइट सिर्फ़ तुम्हें भेजना था।", en: "I meant to send the party invite only to you." },
      { speaker: "them", hi: "फिर पूरे कॉलेज को कैसे मिल गया?", en: "Then why did the whole college get it?" },
      { speaker: "me", hi: "क्योंकि “close friends” की जगह “all students” दब गया।", en: "Because I tapped “all students” instead of “close friends.”" },
      { speaker: "them", hi: "दरवाज़े पर डीन खड़े हैं।", en: "The dean is standing at the door." },
    ],
    choices: [
      { labelHi: "इसे थीम पार्टी बता दो", labelEn: "Call it a themed party", replyHi: "थीम है: जो भी हो रहा है, उसका नाम मत पूछना।", replyEn: "The theme is: don't ask what is happening.", endHi: "डीन ने भी एंट्री ली। अब यह आधिकारिक कैंपस इवेंट है।", endEn: "The dean joined in. It's now an official campus event." },
      { labelHi: "सच बताकर मदद माँगो", labelEn: "Tell the truth and ask for help", replyHi: "यह गलती थी। क्या आप invite बंद करने में मदद करेंगे?", replyEn: "It was an accident. Can you help me shut the invite down?", endHi: "डीन ने लिंक बंद किया—फिर DJ से एक गाना माँग लिया।", endEn: "The dean shut off the link—and requested a song from the DJ." },
    ],
  },
  cringe: {
    title: { hi: "गलत इंसान को वेव", en: "The Wrong-Person Wave" },
    hook: { hi: "एक छोटी सी awkward ग़लती के बाद चैट को बचाने के दो रास्ते हैं।", en: "One tiny awkward mistake leaves two ways to save the chat." },
    emoji: "🫣",
    them_name: "Crush",
    video_type: "rain_window",
    opening: [
      { speaker: "me", hi: "मैंने तुम्हें कैफ़े में देखकर वेव किया।", en: "I waved when I saw you at the cafe." },
      { speaker: "them", hi: "मैं तुम्हारे पीछे वाली टेबल पर थी।", en: "I was at the table behind you." },
      { speaker: "me", hi: "हाँ। अब मुझे पता है कि तुमने वेव वापस नहीं किया।", en: "Right. Now I know you weren't waving back." },
      { speaker: "them", hi: "मैंने किया था। बस तुम्हारे पीछे वाले को।", en: "I did wave back. Just at the person behind you." },
    ],
    choices: [
      { labelHi: "ईमानदारी से हँस दो", labelEn: "Own the awkwardness", replyHi: "मैं अपनी ही कहानी का background character हूँ।", replyEn: "I'm the background character in my own story.", endHi: "वह हँसी। अगली बार उसने सबसे पहले तुम्हें वेव किया।", endEn: "They laughed. Next time, they waved to you first." },
      { labelHi: "कॉफ़ी का ऑफ़र दो", labelEn: "Offer to buy a coffee", replyHi: "क्या मैं कम-से-कम तुम्हारी कॉफ़ी के लिए माफ़ी माँग सकता हूँ?", replyEn: "Can I at least apologize by buying your coffee?", endHi: "कॉफ़ी मिली। सही टेबल पहचानना अब भी सीखना है।", endEn: "You got coffee. You still need to learn which table is yours." },
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
      { idx: start, speaker: "me", body: choice.replyHi, body_en: choice.replyEn, chapter: `ending-${index + 1}`, next_idx: start + 1 },
      { idx: start + 1, speaker: "them", body: choice.endHi, body_en: choice.endEn, chapter: `ending-${index + 1}`, next_idx: null },
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

const generateStoryServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: StoryGenerationInput) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { story: makeFallbackStory(data), source: "template" as const };
    }

    const systemPrompt = [
      "Write an original, concise branching chat story for the RIZZ app.",
      `The selected genre is ${data.category}; keep the story firmly in that genre.`,
      `Write title and hook in ${data.language === "hi" ? "Hindi" : "English"}.`,
      "For every line, body must be Hindi and body_en must be its natural English translation.",
      "For every choice, label and reply_body must be Hindi; label_en and reply_body_en must be natural English translations.",
      "Use only me, them, or narrator as speaker values.",
      "Create 4 opening lines followed by one choice point with exactly two choices.",
      "Each choice must lead to its own two-line ending. Use unique integer indexes, next_idx links for linear sequences, and null at the choice point and endings.",
      "Set each choice's at_idx to the fourth opening line and goto_idx to the first line of its own ending.",
      "Use a relevant video_type from horror_hallway, cyberpunk_neon, rain_window, or cozy_room.",
      "Return only the JSON matching the provided schema. Do not include markdown.",
    ].join(" ");

    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: inputSchema.parse(data).prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: geminiResponseSchema,
              temperature: 0.8,
              maxOutputTokens: 4096,
            },
          }),
          signal: AbortSignal.timeout(45_000),
        },
      );
      if (!response.ok) {
        console.error("Gemini story generation failed with status", response.status);
        return { story: makeFallbackStory(data), source: "template" as const };
      }

      const payload = await response.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim();
      if (!text) throw new Error("Gemini returned no story text");

      const parsed = generatedStorySchema.parse(JSON.parse(text));
      parsed.category = data.category;
      return { story: parsed, source: "gemini" as const };
    } catch (error) {
      console.error("Gemini story generation failed; using a built-in template.", error);
      return { story: makeFallbackStory(data), source: "template" as const };
    }
  });

export async function generateStory(input: StoryGenerationInput): Promise<GeneratedStoryResult> {
  return generateStoryServer({ data: input });
}

export async function generateGeminiStory(input: StoryGenerationInput): Promise<GeneratedStory> {
  const result = await generateStory(input);
  return result.story;
}

const STORY_GRADIENTS: Record<StoryCategory, string> = {
  horror: "linear-gradient(135deg,#0f172a,#ef4444)",
  funny: "linear-gradient(135deg,#ff2e88,#ff9a3c)",
  chaos: "linear-gradient(135deg,#22d3ee,#7c3aed)",
  cringe: "linear-gradient(135deg,#f472b6,#facc15)",
};

export async function saveGeneratedStoryToSupabase(story: GeneratedStory): Promise<string> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) throw new Error("Sign in to save a generated story.");

  const slugBase = story.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "story";
  const slug = `gemini-${slugBase}-${crypto.randomUUID().slice(0, 8)}`;
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
    } as any)
    .select("id")
    .single();

  if (storyError || !savedStory) {
    throw new Error(storyError?.message ?? "Could not save the generated story.");
  }

  const { error: linesError } = await supabase.from("chat_story_lines").insert(
    story.lines.map((line) => ({
      story_id: savedStory.id,
      idx: line.idx,
      speaker: line.speaker,
      body: line.body,
      body_en: line.body_en,
      chapter: line.chapter,
      next_idx: line.next_idx,
    })),
  );
  if (linesError) {
    await supabase.from("chat_stories").delete().eq("id", savedStory.id);
    throw new Error(linesError.message);
  }

  if (story.choices.length > 0) {
    const { error: choicesError } = await supabase.from("chat_story_choices").insert(
      story.choices.map((choice) => ({
        story_id: savedStory.id,
        at_idx: choice.at_idx,
        position: choice.position,
        label: choice.label,
        label_en: choice.label_en,
        reply_body: choice.reply_body,
        reply_body_en: choice.reply_body_en,
        goto_idx: choice.goto_idx,
      })),
    );
    if (choicesError) {
      await supabase.from("chat_stories").delete().eq("id", savedStory.id);
      throw new Error(choicesError.message);
    }
  }

  return savedStory.id;
}
