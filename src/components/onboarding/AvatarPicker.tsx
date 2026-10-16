import { useRef, useState } from "react";
import { Camera, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DEFAULT_AVATARS, isDefaultAvatar } from "@/lib/default-avatars";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/**
 * The one picture picker the whole onboarding wears — the claim step and
 * tutorial step 1 both render through it, so they restyle together and the
 * flow looks like one screen repeated, not two different designs.
 *
 * Cats are free built-in SVGs; the upload tile puts a real photo in the
 * account's `avatars` bucket (the same place Settings → Profile uploads to)
 * and hands back its public URL. Nothing is written to the profile row until
 * the parent page decides to save, so page submit logic stays untouched.
 */
export function AvatarPicker({
  value,
  onChange,
  currentPhotoUrl = null,
  disabled = false,
}: {
  /** Currently selected picture URL (cat or uploaded public URL). */
  value: string;
  onChange: (url: string) => void;
  /** An already-uploaded photo worth offering to keep (e.g. a provider avatar). */
  currentPhotoUrl?: string | null;
  disabled?: boolean;
}) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const keepPhoto = !!currentPhotoUrl && !isDefaultAvatar(currentPhotoUrl);

  /** Same upload that Settings → Profile performs, minus the profile write. */
  async function uploadPhoto(file: File) {
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("That file isn't an image — pick a photo.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("That photo is over 5 MB — pick a smaller one.");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't upload your photo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full ring-2 ring-ring ring-offset-2 ring-offset-background">
          {value ? (
            <img src={value} alt="Your picture" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-muted" />
          )}
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          A cat keeps it simple, your own photo keeps it real. Either shows up everywhere in RIZZ.
        </p>
      </div>

      <div role="radiogroup" aria-label="Choose your profile picture">
        <div className="grid grid-cols-6 gap-2">
          {DEFAULT_AVATARS.map((avatar) => {
            const selected = value === avatar.url;
            return (
              <button
                key={avatar.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={avatar.label}
                title={avatar.label}
                onClick={() => onChange(avatar.url)}
                disabled={disabled || uploading}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "ring-2 ring-ring ring-offset-2 ring-offset-background"
                    : "ring-1 ring-border hover:ring-ring/50",
                )}
              >
                <img src={avatar.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                {selected && (
                  <span className="absolute inset-0 grid place-items-center rounded-full bg-black/30 text-white">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className={cn("mt-2 grid gap-2", keepPhoto ? "grid-cols-2" : "grid-cols-1")}>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading}
            aria-label="Upload a new photo"
            className={cn(
              "flex h-16 items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground transition",
              "hover:border-ring/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
            )}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />}
            {uploading ? "Uploading…" : "Upload a photo"}
          </button>
          {keepPhoto && (
            <button
              type="button"
              role="radio"
              aria-checked={value === currentPhotoUrl}
              aria-label="Keep my current photo"
              onClick={() => onChange(currentPhotoUrl!)}
              disabled={disabled || uploading}
              className={cn(
                "flex h-16 items-center justify-center gap-2 rounded-xl border p-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                value === currentPhotoUrl
                  ? "border-primary bg-primary/10 shadow-[0_0_0_1px_var(--primary)] text-foreground"
                  : "border-border bg-card hover:border-primary/50 text-muted-foreground",
              )}
            >
              <img src={currentPhotoUrl!} alt="" className="h-9 w-9 rounded-full object-cover" />
              <span>My photo</span>
              {value === currentPhotoUrl && <Check className="h-4 w-4 text-primary" aria-hidden />}
            </button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void uploadPhoto(file);
        }}
      />
    </div>
  );
}
