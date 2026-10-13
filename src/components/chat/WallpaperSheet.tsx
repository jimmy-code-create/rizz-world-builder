import { useRef, useState } from "react";
import { Check, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  WALLPAPER_PRESETS,
  loadWallpaper,
  saveWallpaper,
  uploadWallpaper,
  type ChatWallpaper,
  type WallpaperChatKind,
} from "@/lib/chat-wallpaper";

/**
 * The wallpaper picker for one chat.
 *
 * Picking is instant and saved per chat, so the choice survives a reopen (an
 * uploaded background keeps working because the stored value is its URL). The
 * sheet never blocks the conversation: it only edits the chat's own value.
 */
export function WallpaperSheet({
  open,
  onOpenChange,
  kind,
  chatId,
  userId,
  value,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: WallpaperChatKind;
  chatId: string;
  userId: string | null | undefined;
  value: ChatWallpaper;
  onChange: (value: ChatWallpaper) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const activePreset = value && "preset" in value ? value.preset : null;
  const uploadedUrl = value && "url" in value ? value.url : null;

  const apply = (next: ChatWallpaper) => {
    saveWallpaper(kind, chatId, next);
    onChange(next);
  };

  const choosePreset = (preset: number) => {
    apply({ preset });
    toast.success(WALLPAPER_PRESETS[preset] === "none" ? "Wallpaper removed" : "Chat wallpaper changed");
    onOpenChange(false);
  };

  const pickFile = async (file: File | null) => {
    if (!file) return;
    if (!userId) {
      toast.error("Sign in to upload a wallpaper.");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadWallpaper(file, userId);
      apply({ url });
      toast.success("Wallpaper updated");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't upload that wallpaper");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="glass-strong rounded-t-3xl border-white/10 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]"
      >
        <SheetTitle className="font-display text-lg">Chat wallpaper</SheetTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Saved to this chat only, and kept when you come back.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {WALLPAPER_PRESETS.map((preset, index) => {
            const isNone = preset === "none";
            const active = activePreset === index;
            return (
              <button
                key={index}
                type="button"
                onClick={() => choosePreset(index)}
                aria-label={isNone ? "No wallpaper" : `Wallpaper ${index + 1}`}
                aria-pressed={active}
                className={`relative grid h-20 place-items-center overflow-hidden rounded-2xl border bg-black/30 transition-transform active:scale-[0.98] ${
                  active ? "border-[var(--rizz-cyan)] ring-2 ring-[var(--rizz-cyan)]/40" : "border-white/10"
                }`}
                style={isNone ? undefined : { backgroundImage: preset, backgroundRepeat: "no-repeat" }}
              >
                {isNone && <X className="h-5 w-5 text-muted-foreground" aria-hidden="true" />}
                {active && <Check className="h-4 w-4 text-[var(--rizz-cyan)]" aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            void pickFile(event.target.files?.[0] ?? null);
            event.currentTarget.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="mt-3 w-full min-h-11 gap-2 border-white/10 bg-white/5"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {uploading ? "Uploading…" : uploadedUrl ? "Replace uploaded background" : "Upload your own background"}
        </Button>

        {uploadedUrl && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-2">
            <span
              className="h-12 w-12 shrink-0 rounded-xl border border-white/10 bg-cover bg-center"
              style={{ backgroundImage: `url(${uploadedUrl})` }}
              aria-hidden="true"
            />
            <p className="min-w-0 flex-1 text-xs text-muted-foreground">Your uploaded background is active in this chat.</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 text-xs text-destructive hover:bg-destructive/10"
              onClick={() => {
                apply(null);
                toast.success("Wallpaper removed");
                onOpenChange(false);
              }}
            >
              Remove
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Reloads the saved wallpaper for a chat — used when the chat id changes. */
export function readWallpaper(kind: WallpaperChatKind, chatId: string): ChatWallpaper {
  return loadWallpaper(kind, chatId);
}
