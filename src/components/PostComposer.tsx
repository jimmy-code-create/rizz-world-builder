import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ImagePlus, Sparkles, X, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { createPost } from "@/lib/posts";
import { toast } from "sonner";

export function PostComposer({ onPosted }: { onPosted?: () => void } = {}) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (!caption.trim() && !file) throw new Error("Add a caption or media");
      return createPost({ authorId: user.id, caption, file });
    },
    onSuccess: () => {
      setCaption("");
      setFile(null);
      setPreviewUrl(null);
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["user-posts"] });
      onPosted?.();
      toast.success("Posted to RIZZ ✨");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const initial = (profile?.display_name || profile?.username || "?").charAt(0).toUpperCase();

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > 25 * 1024 * 1024) {
      toast.error("Max 25MB");
      return;
    }
    setFile(f);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-3xl p-4 md:p-5 mb-6 border border-white/5"
    >
      <div className="flex gap-3">
        <Avatar className="h-10 w-10 ring-2 ring-[var(--rizz-pink)]/40 shrink-0">
          <AvatarImage src={profile?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-gradient-primary text-primary-foreground font-bold">{initial}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <Textarea
            placeholder="Drop something hot…"
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 600))}
            className="bg-transparent border-0 resize-none min-h-[60px] focus-visible:ring-0 text-base placeholder:text-muted-foreground/60 px-0"
          />
          {previewUrl && (
            <div className="relative mt-2 rounded-2xl overflow-hidden border border-white/10">
              {file?.type.startsWith("video/") ? (
                <video src={previewUrl} controls className="w-full max-h-80 object-cover" />
              ) : (
                <img src={previewUrl} alt="preview" className="w-full max-h-80 object-cover" />
              )}
              <button
                type="button"
                onClick={() => { setFile(null); setPreviewUrl(null); }}
                className="absolute top-2 right-2 h-8 w-8 rounded-full glass-strong flex items-center justify-center hover:bg-destructive/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
            <div className="flex items-center gap-1">
              <label className="cursor-pointer">
                <input type="file" accept="image/*,video/*" hidden onChange={onPickFile} />
                <div className="h-9 w-9 rounded-full hover:bg-white/5 flex items-center justify-center text-[var(--rizz-pink)]">
                  <ImagePlus className="h-5 w-5" />
                </div>
              </label>
              <span className="text-xs text-muted-foreground ml-2">
                {600 - caption.length} chars left
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => mut.mutate()}
              disabled={mut.isPending || (!caption.trim() && !file)}
              className="bg-gradient-primary border-0 shadow-glow hover:opacity-90 px-5"
            >
              {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4 mr-1" /> Post</>}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}