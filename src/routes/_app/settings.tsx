import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Upload, Palette, Check } from "lucide-react";
import { THEME_PRESETS, applyTheme, type ThemePreset, type ThemeMode, type Density } from "@/lib/theme";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings · RIZZ" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const nav = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [accent, setAccent] = useState("#ff2d92");
  const [saving, setSaving] = useState(false);

  const [preset, setPreset] = useState<ThemePreset>((profile?.theme_preset as ThemePreset) || "nightclub");
  const [mode, setMode] = useState<ThemeMode>((profile?.theme_mode as ThemeMode) || "dark");
  const [density, setDensity] = useState<Density>((profile?.ui_density as Density) || "comfy");
  const [reduced, setReduced] = useState<boolean>(!!profile?.reduced_motion);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setAccent(profile.accent_color ?? "#ff2d92");
      setPreset((profile.theme_preset as ThemePreset) || "nightclub");
      setMode((profile.theme_mode as ThemeMode) || "dark");
      setDensity((profile.ui_density as Density) || "comfy");
      setReduced(!!profile.reduced_motion);
    }
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

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null, bio: bio.trim() || null, accent_color: accent })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Profile saved");
  }

  async function saveAppearance(next: { preset?: ThemePreset; mode?: ThemeMode; density?: Density; reduced?: boolean }) {
    const newPreset = next.preset ?? preset;
    const newMode = next.mode ?? mode;
    const newDensity = next.density ?? density;
    const newReduced = next.reduced ?? reduced;
    if (next.preset) setPreset(next.preset);
    if (next.mode) setMode(next.mode);
    if (next.density) setDensity(next.density);
    if (next.reduced !== undefined) setReduced(next.reduced);
    applyTheme(newPreset, newMode, newDensity, newReduced);
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ theme_preset: newPreset, theme_mode: newMode, ui_density: newDensity, reduced_motion: newReduced } as any)
      .eq("id", user.id);
    await refreshProfile();
  }

  if (!profile) return null;
  const initial = (profile.display_name || profile.username).charAt(0).toUpperCase();

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="font-display text-3xl font-bold">Settings</h1>

      {/* Profile */}
      <section className="glass rounded-3xl p-5 space-y-5 border border-white/5">
        <h2 className="font-display font-semibold text-lg">Profile</h2>
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 ring-2 ring-[var(--rizz-pink)]/40">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="bg-gradient-primary text-2xl font-bold">{initial}</AvatarFallback>
          </Avatar>
          <label className="cursor-pointer">
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0], "avatar")} />
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glass-strong border border-white/10 text-sm font-medium hover:bg-white/5">
              <Upload className="h-4 w-4" /> Change avatar
            </span>
          </label>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Banner</Label>
          <label className="mt-1 block cursor-pointer">
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0], "banner")} />
            <div className="h-24 rounded-2xl border border-dashed border-white/10 flex items-center justify-center text-sm text-muted-foreground hover:bg-white/5"
              style={profile.banner_url ? { backgroundImage: `url(${profile.banner_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
              {!profile.banner_url && <><Upload className="h-4 w-4 mr-2" /> Upload banner</>}
            </div>
          </label>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Username</Label>
          <Input value={profile.username} readOnly className="mt-1 bg-transparent border-white/10 text-muted-foreground" />
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Display name</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value.slice(0, 40))} className="mt-1 bg-transparent border-white/10" />
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Bio</Label>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 240))} rows={3} className="mt-1 bg-transparent border-white/10 resize-none" />
          <p className="text-[10px] text-muted-foreground mt-1">{240 - bio.length} chars left</p>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Accent glow color</Label>
          <div className="mt-1 flex items-center gap-3">
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-10 w-16 rounded-lg cursor-pointer bg-transparent border border-white/10" />
            <span className="text-sm font-mono">{accent}</span>
          </div>
        </div>

        <Button onClick={save} disabled={saving} className="bg-gradient-primary border-0 shadow-glow w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save profile"}
        </Button>
      </section>

      {/* Appearance */}
      <section id="appearance" className="glass rounded-3xl p-5 space-y-5 border border-white/5">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-[var(--rizz-pink)]" />
          <h2 className="font-display font-semibold text-lg">Appearance</h2>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">Theme</Label>
          <div className="grid grid-cols-2 gap-2">
            {THEME_PRESETS.map((t) => {
              const active = preset === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => saveAppearance({ preset: t.id })}
                  className={`relative text-left p-3 rounded-2xl border transition-all ${active ? "border-[var(--rizz-pink)] shadow-glow" : "border-white/10 hover:border-white/20"}`}
                >
                  <div className="flex gap-1 mb-2">
                    {t.colors.map((c) => (
                      <span key={c} className="h-5 w-5 rounded-full ring-1 ring-white/10" style={{ background: c }} />
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{t.name}</span>
                    {active && <Check className="h-3.5 w-3.5 text-[var(--rizz-pink)]" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">Mode</Label>
          <div className="flex gap-2">
            {(["dark", "light", "auto"] as ThemeMode[]).map((m) => (
              <button
                key={m}
                onClick={() => saveAppearance({ mode: m })}
                className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium capitalize border ${mode === m ? "bg-gradient-primary border-transparent text-primary-foreground shadow-glow" : "border-white/10 hover:bg-white/5"}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">Density</Label>
          <div className="flex gap-2">
            {(["comfy", "compact"] as Density[]).map((d) => (
              <button
                key={d}
                onClick={() => saveAppearance({ density: d })}
                className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium capitalize border ${density === d ? "bg-gradient-primary border-transparent text-primary-foreground shadow-glow" : "border-white/10 hover:bg-white/5"}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Reduced motion</Label>
            <p className="text-[11px] text-muted-foreground">Minimize animations and transitions</p>
          </div>
          <Switch checked={reduced} onCheckedChange={(v) => saveAppearance({ reduced: v })} />
        </div>
      </section>

      {/* Account */}
      <section className="glass rounded-3xl p-5 border border-white/5">
        <h2 className="font-display font-semibold mb-3">Account</h2>
        <Button
          variant="outline"
          className="w-full glass-strong border-destructive/30 text-destructive hover:bg-destructive/10"
          onClick={async () => { await signOut(); nav({ to: "/" }); }}
        >
          Sign out
        </Button>
      </section>
    </div>
  );
}
