import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Send, X, Loader2, BarChart3, Globe, Lock, Plus, ImagePlus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { createPost, rollbackCreatedPost } from "@/lib/posts";
import { createPoll } from "@/lib/polls";
import { QuoteEmbed } from "@/components/post/QuoteEmbed";
import { toast } from "@/lib/toast";
import { useI18n, tf } from "@/lib/i18n";
import { MentionAutocomplete, replaceMention } from "@/components/MentionAutocomplete";
import { confettiBurst } from "@/lib/confetti";
import { GifPicker } from "@/components/GifPicker";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const DRAFT_KEY = "rizz:post-draft";

export function PostComposer({ onPosted }: { onPosted?: () => void } = {}) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [caption, setCaption] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(DRAFT_KEY) ?? "";
  });
  const [caret, setCaret] = useState(0);
  const [pollOn, setPollOn] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [pollHours, setPollHours] = useState(24);
  const { t } = useI18n();
  const [visibility, setVisibility] = useState<"public" | "close_friends">("public");
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const postBtnRef = useRef<HTMLButtonElement | null>(null);

  const clearImage = () => {
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setImageFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const pickImage = (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files can be attached here.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("That image is over 50MB — pick a smaller one.");
      return;
    }
    if (file.size === 0) {
      toast.error("That file is empty. Pick another one.");
      return;
    }
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setImageFile(file);
  };

  // Autosave caption draft to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (caption) localStorage.setItem(DRAFT_KEY, caption);
    else localStorage.removeItem(DRAFT_KEY);
  }, [caption]);

  // Another surface (a post's "Quote post" action) can preload a quote target.
  useEffect(() => {
    const onQuote = (e: Event) => setQuoteId((e as CustomEvent).detail?.id ?? null);
    window.addEventListener("rizz:quote-post", onQuote as EventListener);
    return () => window.removeEventListener("rizz:quote-post", onQuote as EventListener);
  }, []);

  const mut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
       if (!caption.trim() && !quoteId && !pollOn && !imageFile) throw new Error("Write something or add an image before posting");
      if (pollOn && pollOptions.filter((o) => o.trim()).length < 2) {
        throw new Error("A poll needs at least 2 options");
      }
      const row = await createPost({
        authorId: user.id,
        caption,
        visibility,
        quotePostId: quoteId,
        file: imageFile ?? undefined,
      });
      if (pollOn && row?.id) {
        try {
          await createPoll(row.id, pollQuestion || caption || "Poll", pollOptions, pollHours);
        } catch (error) {
          try {
            await rollbackCreatedPost(row.id, row.media_url);
          } catch (rollbackError) {
            const reason = error instanceof Error ? error.message : "Unknown poll error";
            throw new Error(`${reason}. ${rollbackError instanceof Error ? rollbackError.message : "The post cleanup also failed."}`);
          }
          throw error;
        }
      }
      return row;
    },
    onSuccess: () => {
      setCaption("");
      setQuoteId(null);
      setPollOn(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
      setVisibility("public");
      clearImage();
      if (typeof window !== "undefined") localStorage.removeItem(DRAFT_KEY);
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["user-posts"] });
      onPosted?.();
      toast.success("Posted to RIZZ ✨");
      const r = postBtnRef.current?.getBoundingClientRect();
      confettiBurst(r ? r.left + r.width / 2 : undefined, r ? r.top : undefined);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const initial = (profile?.display_name || profile?.username || "?").charAt(0).toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-3xl p-4 md:p-5 mb-6 border border-white/5"
    >
      <div className="flex gap-3">
        <UserAvatar src={profile?.avatar_url} fallback={initial} size="md" className="shrink-0" />
        <div className="flex-1 min-w-0 relative">
          <Textarea
            ref={textareaRef}
            placeholder={t("drop_placeholder")}
            value={caption}
            onChange={(e) => {
              setCaption(e.target.value);
              setCaret(e.target.selectionStart ?? e.target.value.length);
            }}
            onKeyUp={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
            onClick={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
            className="bg-transparent border-0 resize-none min-h-[60px] focus-visible:ring-0 text-base placeholder:text-muted-foreground/60 px-0"
          />
          <MentionAutocomplete
            value={caption}
            caret={caret}
            onPick={(username) => {
              const { value, caret: nc } = replaceMention(caption, caret, username);
              setCaption(value);
              setCaret(nc);
              requestAnimationFrame(() => {
                const ta = textareaRef.current;
                if (ta) { ta.focus(); ta.setSelectionRange(nc, nc); }
              });
            }}
          />
          {quoteId && (
            <div className="relative mt-2">
              <QuoteEmbed postId={quoteId} />
              <button
                type="button"
                onClick={() => setQuoteId(null)}
                className="absolute right-6 top-2 grid h-7 w-7 place-items-center rounded-full glass-strong hover:bg-destructive/20"
                aria-label="Remove quote"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {imagePreview && (
            <div className="relative mt-2 inline-block">
              <img
                src={imagePreview}
                alt="Attached image preview"
                className="h-28 w-auto max-w-full rounded-2xl border border-white/10 object-cover"
              />
              {mut.isPending && (
                <div className="absolute inset-0 grid place-items-center rounded-2xl bg-black/50 text-xs font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={clearImage}
                disabled={mut.isPending}
                className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full glass-strong hover:bg-destructive/20 disabled:opacity-50"
                aria-label="Remove image"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {pollOn && (
            <div className="mt-3 space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <input
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value.slice(0, 200))}
                placeholder={t("poll_question_ph")}
                className="w-full rounded-lg bg-transparent px-2 py-1.5 text-sm font-semibold outline-none placeholder:text-muted-foreground/60"
              />
              {pollOptions.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={o}
                    onChange={(e) => setPollOptions((p) => p.map((v, j) => (j === i ? e.target.value.slice(0, 80) : v)))}
                    placeholder={tf("poll_option", { n: i + 1 })}
                    className="flex-1 min-w-0 rounded-lg border border-white/10 bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-primary/50"
                  />
                  {pollOptions.length > 2 && (
                    <button type="button" onClick={() => setPollOptions((p) => p.filter((_, j) => j !== i))}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-white/10" aria-label={t("remove_option")}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                {pollOptions.length < 4 && (
                  <button type="button" onClick={() => setPollOptions((p) => [...p, ""])}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-xs hover:bg-white/5">
                    <Plus className="h-3 w-3" /> {t("add_option")}
                  </button>
                )}
                <select
                  value={pollHours}
                  onChange={(e) => setPollHours(Number(e.target.value))}
                  className="rounded-full border border-white/10 bg-transparent px-2.5 py-1 text-xs outline-none"
                >
                  <option value={6}>{t("poll_6h")}</option>
                  <option value={24}>{t("poll_1d")}</option>
                  <option value={72}>{t("poll_3d")}</option>
                  <option value={168}>{t("poll_1w")}</option>
                </select>
                <button type="button" onClick={() => setPollOn(false)}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground">{t("remove_poll")}</button>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
            <div className="flex items-center gap-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-label="Attach an image"
                onChange={(e) => {
                  pickImage(e.target.files?.[0]);
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={`flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/5 ${imageFile ? "text-primary bg-white/5" : "text-primary"}`}
                aria-label="Attach an image"
                aria-pressed={!!imageFile}
              >
                <ImagePlus className="h-5 w-5" />
              </button>
              <GifPicker onSelect={(marker) => setCaption((current) => `${current}${current ? " " : ""}${marker}`)} />
              <button
                type="button"
                onClick={() => setPollOn((p) => !p)}
                className={`flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/5 ${pollOn ? "text-primary bg-white/5" : "text-primary"}`}
                aria-label={t("add_poll")}
              >
                <BarChart3 className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setVisibility((v) => (v === "public" ? "close_friends" : "public"))}
                className={`flex h-9 items-center gap-1 rounded-full px-2 text-[11px] font-medium hover:bg-white/5 ${
                  visibility === "close_friends" ? "text-emerald-300" : "text-muted-foreground"
                }`}
                aria-label={t("audience_toggle")}
              >
                {visibility === "close_friends" ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                <span className="hidden sm:inline">{visibility === "close_friends" ? t("audience_close") : t("audience_everyone")}</span>
              </button>
            </div>
            <Button
              ref={postBtnRef}
              size="sm"
              onClick={() => mut.mutate()}
               disabled={mut.isPending || (!caption.trim() && !quoteId && !pollOn && !imageFile)}
              className="bg-primary text-primary-foreground border-0 shadow-md hover:opacity-90 px-5"
            >
              {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1" /> {t("post")}</>}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}