import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { Check, Loader2, Upload, UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SettingsCard, SettingsSubPage } from "@/components/settings/SettingsSubPage";
import { DEFAULT_AVATARS } from "@/lib/default-avatars";
import { CustomEmoji } from "@/components/CustomEmoji";
import { TUTORIAL_INTERESTS } from "@/lib/emoji.js";

export const Route = createFileRoute("/_app/settings/profile")({
  head: () => ({ meta: [{ title: "Profile · Settings · RIZZ" }] }),
  component: ProfileSettingsPage,
});

function ProfileSettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [accent, setAccent] = useState("#c9ff3d");
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setBio(profile.bio ?? "");
    setAccent(profile.accent_color ?? "#c9ff3d");
    setInterests(profile.interests ?? []);
  }, [profile]);

  async function uploadAvatar(file: File, kind: "avatar" | "banner") {
    if (!user) return;
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) return toast.error(upErr.message);
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error } = await supabase
      .from("profiles")
      .update(kind === "avatar" ? { avatar_url: data.publicUrl } : { banner_url: data.publicUrl })
      .eq("id", user.id);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Updated ✨");
  }

  /** Pick one of the built-in cat avatars — no upload, no storage. */
  async function chooseAvatar(url: string) {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Avatar updated ✨");
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null, bio: bio.trim() || null, accent_color: accent, interests })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Profile saved");
  }

  function toggleInterest(interest: string) {
    setInterests((current) =>
      current.includes(interest)
        ? current.filter((item) => item !== interest)
        : current.length < 6
          ? [...current, interest]
          : current,
    );
  }

  if (!profile) return null;
  const initial = (profile.display_name || profile.username || "?").charAt(0).toUpperCase();

  return (
    <SettingsSubPage
      title="Profile"
      description="How the rest of RIZZ sees you."
      icon={<UserRound className="h-5 w-5" />}
    >
      <SettingsCard className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 ring-2 ring-primary/40">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">{initial}</AvatarFallback>
          </Avatar>
          <label className="cursor-pointer">
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0], "avatar")} />
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 glass-strong px-4 py-2 text-sm font-medium hover:bg-white/5">
              <Upload className="h-4 w-4" /> Upload a photo
            </span>
          </label>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Or choose one of the six RIZZ cats</Label>
          <div className="mt-2 grid grid-cols-6 gap-2" role="radiogroup" aria-label="Choose a profile cat">
            {DEFAULT_AVATARS.map((avatar) => {
              const active = profile.avatar_url === avatar.url;
              return (
                <button
                  key={avatar.id}
                  type="button"
                  role="radio"
                  aria-label={`Use the ${avatar.label} avatar`}
                  aria-checked={active}
                  onClick={() => void chooseAvatar(avatar.url)}
                  className={`relative aspect-square overflow-hidden rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    active ? "border-primary shadow-md" : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <img src={avatar.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  {active && <span className="absolute inset-0 grid place-items-center rounded-full bg-black/30 text-white"><Check className="h-4 w-4" /></span>}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Banner</Label>
          <label className="mt-1 block cursor-pointer">
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0], "banner")} />
            <div
              className="flex h-24 items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-muted-foreground hover:bg-white/5"
              style={profile.banner_url ? { backgroundImage: `url(${profile.banner_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
            >
              {!profile.banner_url && (
                <>
                  <Upload className="mr-2 h-4 w-4" /> Upload banner
                </>
              )}
            </div>
          </label>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Username</Label>
          <Input value={profile.username ?? ""} readOnly className="mt-1 border-white/10 bg-transparent text-muted-foreground" />
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Display name</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value.slice(0, 40))} className="mt-1 border-white/10 bg-transparent" />
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Bio</Label>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 240))} rows={3} className="mt-1 resize-none border-white/10 bg-transparent" />
          <p className="mt-1 text-[10px] text-muted-foreground">{240 - bio.length} chars left</p>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs text-muted-foreground">Interests</Label>
            <span className="text-[11px] tabular-nums text-muted-foreground">{interests.length} / 6 selected</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {TUTORIAL_INTERESTS.map(({ id, emoji }) => {
              const active = interests.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  disabled={!active && interests.length >= 6}
                  onClick={() => toggleInterest(id)}
                  className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40 ${
                    active ? "border-primary bg-primary/10 text-foreground" : "border-white/10 bg-transparent hover:bg-white/5"
                  }`}
                >
                  <CustomEmoji name={emoji} className="h-5 w-5 shrink-0" />
                  <span>{id}</span>
                  {active && <Check className="ml-auto h-3.5 w-3.5 text-primary" aria-hidden />}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">These show on your public profile and help people find shared interests.</p>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Accent glow color</Label>
          <div className="mt-1 flex items-center gap-3">
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-10 w-16 cursor-pointer rounded-lg border border-white/10 bg-transparent" />
            <span className="text-sm font-mono">{accent}</span>
          </div>
        </div>

        <Button onClick={save} disabled={saving} className="w-full border-0 bg-primary text-primary-foreground shadow-md">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save profile"}
        </Button>
      </SettingsCard>
    </SettingsSubPage>
  );
}
