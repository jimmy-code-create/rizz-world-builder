/**
 * "Edit avatar: Photo or Cat" — the settings row that opens Cat Studio.
 *
 * It renders nothing until pending_catstudio.sql has run, so the app never
 * offers a door into a screen whose tables do not exist yet.
 */
import { useNavigate } from "@tanstack/react-router";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { CatAvatar } from "./CatAvatar";
import { catFromProfile, useCatAvailability } from "./useCatStudio";

type LooseClient = { from(table: string): any };
const db = supabase as unknown as LooseClient;

export function CatAvatarEntry() {
  const { available, isLoading } = useCatAvailability();
  const { profile, user, refreshProfile } = useAuth();
  const nav = useNavigate();

  const isCat = (profile as Record<string, unknown> | null)?.avatar_type === "cat";
  const cat = catFromProfile(profile as Record<string, unknown> | null);

  if (isLoading || !available) return null;

  const switchToPhoto = async () => {
    if (!user) return;
    const { error } = await db.from("profiles").update({ avatar_type: "photo" }).eq("id", user.id);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Photo avatar restored");
  };

  return (
    <div>
      <Label className="text-xs text-muted-foreground">Edit avatar</Label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          aria-pressed={!isCat}
          onClick={() => void switchToPhoto()}
          className={`h-11 rounded-[14px] border text-[13px] font-semibold transition-colors ${
            !isCat ? "border-primary/50 bg-primary/15 text-primary" : "border-white/10 bg-surface-1 text-muted-foreground"
          }`}
        >
          Photo
        </button>
        <button
          type="button"
          aria-pressed={isCat}
          onClick={() => nav({ to: "/cat-studio" })}
          className={`flex h-11 items-center justify-center gap-2 rounded-[14px] border text-[13px] font-semibold transition-colors ${
            isCat ? "border-primary/50 bg-primary/15 text-primary" : "border-white/10 bg-surface-1 text-muted-foreground"
          }`}
        >
          {cat && <CatAvatar config={cat} size={24} label="" />}
          Cat
        </button>
      </div>
      {isCat && cat && (
        <div className="mt-2 flex items-center gap-2 rounded-[14px] border border-white/10 bg-surface-1 p-2">
          <CatAvatar config={cat} size={44} animated />
          <p className="min-w-0 flex-1 text-[11.5px] leading-snug text-muted-foreground">
            Your cat is drawn from its saved config, and the PNG is still used everywhere an avatar image is expected.
          </p>
          <button
            type="button"
            onClick={() => nav({ to: "/cat-studio" })}
            className="h-9 shrink-0 rounded-full border border-white/12 px-3 text-[12px] font-semibold"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
