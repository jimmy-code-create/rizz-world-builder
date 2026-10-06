import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";
import { Heart, Loader2, MessageSquareText, Play, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { ChatStoryPlayer, type ChatStory, type StoryLine, type StoryChoice } from "@/components/chatstory/ChatStoryPlayer";
import { ROOM_4B_HOOK, ROOM_4B_TITLE } from "@/components/chatstory/room4b-story";
import { generateGeminiStory, saveGeneratedStoryToSupabase, type StoryCategory } from "@/lib/gemini-story";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/chat-stories")({
  head: () => ({
    meta: [
      { title: "Chat Stories · RIZZ" },
      { name: "description", content: "Bite-size funny, chaotic and spooky stories told as text conversations. Tap through them like you're reading someone's chat." },
      { property: "og:title", content: "Chat Stories · RIZZ" },
      { property: "og:description", content: "Tap-to-read chat stories: wrong numbers, haunted fridges and gym crush disasters." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Chat Stories · RIZZ" },
      { name: "twitter:description", content: "Tap-to-read chat stories on RIZZ." },
    ],
  }),
  component: ChatStoriesPage,
});

const CATEGORIES = ["all", "funny", "chaos", "horror", "cringe"] as const;
const QUICK_PROMPTS = [
  "Late-night elevator at 2:13 AM",
  "Confessing feelings to my best friend",
  "A wrong number texting from my own contact",
  "Gym crush disaster",
] as const;
const GENRES: StoryCategory[] = ["horror", "funny", "chaos", "cringe"];

function ChatStoriesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [isGenOpen, setIsGenOpen] = useState(false);
  const [genPrompt, setGenPrompt] = useState("");
  const [genCategory, setGenCategory] = useState<StoryCategory>("horror");
  const [genLang, setGenLang] = useState<"hi" | "en">("en");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedStoryId, setGeneratedStoryId] = useState<string | null>(null);
  const [generatedLanguage, setGeneratedLanguage] = useState<"hi" | "en">("en");

  const stories = useQuery({
    queryKey: ["chat-stories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chat_stories").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as (ChatStory & { likes_count: number })[];
    },
  });

  const likes = useQuery({
    queryKey: ["chat-story-likes", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("chat_story_likes").select("story_id").eq("user_id", user!.id);
      return new Set((data ?? []).map((r: { story_id: string }) => r.story_id));
    },
    enabled: !!user,
  });

  const lines = useQuery({
    queryKey: ["chat-story-lines", openId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_story_lines")
        .select("idx,speaker,body,body_en,next_idx,chapter")
        .eq("story_id", openId!)
        .order("idx");
      if (error) throw error;
      return (data ?? []) as unknown as StoryLine[];
    },
    enabled: !!openId,
  });

  const choices = useQuery({
    queryKey: ["chat-story-choices", openId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_story_choices")
        .select("at_idx,position,label,label_en,reply_body,reply_body_en,goto_idx")
        .eq("story_id", openId!)
        .order("position");
      if (error) throw error;
      return (data ?? []) as unknown as StoryChoice[];
    },
    enabled: !!openId,
  });

  const toggleLike = async (storyId: string) => {
    if (!user) return toast.info("Sign in to like stories");
    const isLiked = likes.data?.has(storyId);
    if (isLiked) await supabase.from("chat_story_likes").delete().eq("story_id", storyId).eq("user_id", user.id);
    else await supabase.from("chat_story_likes").insert({ story_id: storyId, user_id: user.id });
    qc.invalidateQueries({ queryKey: ["chat-story-likes", user.id] });
  };

  const generateStory = async () => {
    if (isGenerating) return;
    if (!user) {
      toast.info("Sign in to create a story");
      return;
    }
    const prompt = genPrompt.trim();
    if (prompt.length < 4) {
      toast.error("Add a prompt with at least 4 characters.");
      return;
    }

    setIsGenerating(true);
    try {
      const generatedStory = await generateGeminiStory({
        prompt,
        category: genCategory,
        language: genLang,
      });
      const storyId = await saveGeneratedStoryToSupabase(generatedStory);
      await qc.invalidateQueries({ queryKey: ["chat-stories"] });
      setGeneratedStoryId(storyId);
      setGeneratedLanguage(genLang);
      setGenPrompt("");
      setGenCategory("horror");
      setGenLang("en");
      setIsGenOpen(false);
      toast.success("Your story is ready.");
      setOpenId(storyId);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not generate your story. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const list = (stories.data ?? []).filter((s) => cat === "all" || s.category === cat);
  const open = list.find((s) => s.id === openId) ?? (stories.data ?? []).find((s) => s.id === openId);

  return (
    <div className="max-w-2xl mx-auto">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <MessageSquareText className="h-6 w-6 text-[var(--rizz-pink)]" /> Chat Stories
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Short stories told as texts. Tap through them one message at a time.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsGenOpen(true)}
          className="group relative isolate inline-flex h-10 shrink-0 items-center gap-2 overflow-hidden rounded-full border border-[var(--rizz-pink)]/70 bg-background/55 px-4 text-xs font-bold text-foreground shadow-[0_0_22px_rgba(255,65,150,.18)] backdrop-blur-xl transition hover:border-[var(--rizz-pink)] hover:shadow-[0_0_28px_rgba(255,65,150,.32)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)]"
        >
          <span className="absolute inset-0 -z-10 bg-gradient-to-r from-[var(--rizz-pink)]/15 via-transparent to-fuchsia-400/10 opacity-80" />
          <Sparkles className="h-4 w-4 text-[var(--rizz-pink)]" />
          <span className="hidden sm:inline">Generate with Gemini</span>
          <span className="sm:hidden">Generate</span>
        </button>
      </header>

      <Dialog
        open={isGenOpen}
        onOpenChange={(nextOpen) => {
          if (!isGenerating) setIsGenOpen(nextOpen);
        }}
      >
        <DialogContent
          className="max-h-[92dvh] overflow-y-auto border border-[var(--rizz-pink)]/25 bg-background/95 shadow-[0_24px_90px_rgba(20,8,24,.45)] backdrop-blur-2xl sm:rounded-2xl"
          onEscapeKeyDown={(event) => { if (isGenerating) event.preventDefault(); }}
          onPointerDownOutside={(event) => { if (isGenerating) event.preventDefault(); }}
          onInteractOutside={(event) => { if (isGenerating) event.preventDefault(); }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-left">
              <Wand2 className="h-5 w-5 text-[var(--rizz-pink)]" /> Make a chat story
            </DialogTitle>
            <DialogDescription className="text-left">
              Give Gemini a premise. It will turn it into a branching conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="story-prompt" className="text-xs font-semibold">Your premise</label>
              <textarea
                id="story-prompt"
                value={genPrompt}
                onChange={(event) => setGenPrompt(event.target.value.slice(0, 500))}
                maxLength={500}
                minLength={4}
                rows={3}
                disabled={isGenerating}
                placeholder="A midnight elevator stops on a floor that shouldn't exist…"
                className="w-full resize-y rounded-xl border border-border/70 bg-card/70 px-3 py-3 text-sm outline-none transition placeholder:text-muted-foreground/65 focus:border-[var(--rizz-pink)]/70 focus:ring-2 focus:ring-[var(--rizz-pink)]/15 disabled:opacity-60"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>At least 4 characters</span>
                <span>{genPrompt.length}/500</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={isGenerating}
                    onClick={() => setGenPrompt(prompt)}
                    className="rounded-full border border-border/70 bg-card/55 px-3 py-1.5 text-left text-[11px] text-muted-foreground transition hover:border-[var(--rizz-pink)]/50 hover:text-foreground disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset disabled={isGenerating} className="space-y-2">
                <legend className="mb-2 text-xs font-semibold">Genre</legend>
                <div className="flex flex-wrap gap-2">
                  {GENRES.map((genre) => (
                    <button
                      key={genre}
                      type="button"
                      aria-pressed={genCategory === genre}
                      onClick={() => setGenCategory(genre)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition ${genCategory === genre ? "border-[var(--rizz-pink)]/70 bg-[var(--rizz-pink)]/15 text-foreground" : "border-border/70 bg-card/50 text-muted-foreground hover:text-foreground"}`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset disabled={isGenerating} className="space-y-2">
                <legend className="mb-2 text-xs font-semibold">Story language</legend>
                <div className="flex gap-2">
                  {(["hi", "en"] as const).map((language) => (
                    <button
                      key={language}
                      type="button"
                      aria-pressed={genLang === language}
                      onClick={() => setGenLang(language)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${genLang === language ? "border-[var(--rizz-pink)]/70 bg-[var(--rizz-pink)]/15 text-foreground" : "border-border/70 bg-card/50 text-muted-foreground hover:text-foreground"}`}
                    >
                      {language === "hi" ? "हिंदी" : "English"}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setIsGenOpen(false)}
              disabled={isGenerating}
              className="h-10 rounded-full border border-border/70 px-4 text-sm font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={generateStory}
              disabled={isGenerating || genPrompt.trim().length < 4}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-gradient-primary px-5 text-sm font-bold text-primary-foreground transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isGenerating ? "Creating story…" : "Create story"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 mb-4">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`shrink-0 px-4 h-9 rounded-full text-sm font-semibold capitalize ${
              cat === c ? "bg-gradient-primary" : "glass"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {stories.isLoading && <p className="text-sm text-muted-foreground">Loading stories…</p>}
      {stories.isError && (
        <div role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-semibold">Stories couldn’t be loaded.</p>
          <button type="button" onClick={() => stories.refetch()} className="mt-2 text-xs font-semibold underline underline-offset-4">Try again</button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((s, i) => (
          <motion.button
            key={s.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => setOpenId(s.id)}
            className="relative text-left rounded-2xl overflow-hidden p-4 min-h-[132px] flex flex-col justify-between"
            style={{ background: s.gradient }}
          >
            <div className="absolute inset-0 bg-black/25" />
            <div className="relative">
              <div className="flex items-start gap-2">
                <span className="text-2xl">{s.emoji}</span>
                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/20">
                  {s.category}
                </span>
              </div>
              <h2 className="mt-2 font-extrabold leading-tight">
                {s.slug === "room-4b" ? ROOM_4B_TITLE.en : s.title}
              </h2>
              <p className="text-xs opacity-85 mt-1 line-clamp-2">
                {s.slug === "room-4b" ? ROOM_4B_HOOK.en : s.hook}
              </p>
            </div>
            <div className="relative mt-3 flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1 font-semibold">
                <Play className="h-3.5 w-3.5" /> Read
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); toggleLike(s.id); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); toggleLike(s.id); } }}
                className="inline-flex items-center gap-1"
              >
                <Heart className={`h-3.5 w-3.5 ${likes.data?.has(s.id) ? "fill-current" : ""}`} />
                {likes.data?.has(s.id) ? "Liked" : "Like"}
              </span>
            </div>
          </motion.button>
        ))}
      </div>

      {openId && (lines.isError || choices.isError) && (
        <div role="alert" className="fixed inset-x-4 bottom-5 z-[140] mx-auto max-w-md rounded-xl border border-destructive/35 bg-background/95 p-4 shadow-xl backdrop-blur">
          <p className="text-sm font-semibold">This story couldn’t be opened.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {lines.error instanceof Error ? lines.error.message : choices.error instanceof Error ? choices.error.message : "Please try again."}
          </p>
          <div className="mt-3 flex gap-3">
            <button type="button" onClick={() => { void lines.refetch(); void choices.refetch(); }} className="text-xs font-semibold underline underline-offset-4">Try again</button>
            <button type="button" onClick={() => setOpenId(null)} className="text-xs font-semibold text-muted-foreground">Close</button>
          </div>
        </div>
      )}
      {open && lines.isSuccess && choices.isSuccess && (
        <ChatStoryPlayer
          key={open.id}
          story={open}
          lines={lines.data}
          choices={choices.data}
          liked={!!likes.data?.has(open.id)}
          onLike={() => toggleLike(open.id)}
          onClose={() => setOpenId(null)}
          initialLanguage={generatedStoryId === open.id ? generatedLanguage : "hi"}
        />
      )}
    </div>
  );
}