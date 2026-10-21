import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useI18n, tf } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { Check, Loader2, Save, Upload, UserRound } from "lucide-react";
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
import { BannerGradientPicker } from "@/components/profile/BannerGradientPicker";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { useEquipped } from "@/lib/useEquipped";
import {
  getBanner,
  normalizeBannerGradient,
  normalizeBannerMode,
  type BannerGradient,
  type BannerMode,
} from "@/lib/banner";

export const Route = createFileRoute("/_app/settings/profile")({
  head: () => ({ meta: [{ title: "Profile · Settings · RIZZ" }] }),
  component: ProfileSettingsPage,
});

function ProfileSettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [accent, setAccent] = useState("#c9ff3d");
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [bannerMode, setBannerMode] = useState<BannerMode>("none");
  const [bannerGradient, setBannerGradient] = useState<BannerGradient | null>(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const equipped = useEquipped(profile?.id);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setBio(profile.bio ?? "");
    setAccent(profile.accent_color ?? "#c9ff3d");
    setInterests(profile.interests ?? []);
    const gradient = normalizeBannerGradient(profile.banner_gradient);
    setBannerGradient(gradient);
    setBannerMode(
      normalizeBannerMode(profile.banner_mode) ??
        (profile.banner_url ? "image" : gradient ? "gradient" : "none"),
    );
  }, [profile]);

  async function uploadAvatar(file: File, kind: "avatar" | "banner") {
    if (!user) return;
    if (kind === "banner") setBannerUploading(true);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (upErr) {
      if (kind === "banner") setBannerUploading(false);
      return toast.error(upErr.message);
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error } = await supabase
      .from("profiles")
      .update(
        kind === "avatar"
          ? { avatar_url: data.publicUrl }
          : { banner_url: data.publicUrl, banner_mode: "image" },
      )
      .eq("id", user.id);
    if (kind === "banner") {
      setBannerUploading(false);
      if (!error) setBannerMode("image");
    }
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Updated ✨");
  }

  /** Banner/theme edits are instant: the preview above is the source of truth. */
  async function persistBanner(patch: {
    banner_mode?: BannerMode;
    banner_gradient?: BannerGradient | null;
    banner_url?: string | null;
  }) {
    if (!user) return false;
    const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    await refreshProfile();
    return true;
  }

  function changeBannerGradient(next: BannerGradient) {
    // The image and the full-profile gradient are independent. Keep the old
    // banner_mode column coherent for clients that have not updated yet.
    const nextMode: BannerMode = profile?.banner_url ? "image" : "gradient";
    setBannerGradient(next);
    setBannerMode(nextMode);
    void persistBanner({ banner_mode: nextMode, banner_gradient: next });
  }

  function clearBannerGradient() {
    const nextMode: BannerMode = profile?.banner_url ? "image" : "none";
    setBannerGradient(null);
    setBannerMode(nextMode);
    void persistBanner({ banner_mode: nextMode, banner_gradient: null });
  }

  async function removeBannerImage() {
    const nextMode: BannerMode = bannerGradient ? "gradient" : "none";
    setBannerMode(nextMode);
    const ok = await persistBanner({ banner_url: null, banner_mode: nextMode });
    if (ok) toast.success("Banner image removed");
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
    const patch = {
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
      accent_color: accent,
      banner_mode: bannerMode,
      banner_gradient: bannerGradient,
      interests,
    };
    let { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
    let gradientUnsupported = false;
    if (error && /banner_(gradient|mode)/i.test(error.message)) {
      // Keep the rest of the editor usable until the banner migration lands.
      const {
        banner_gradient: _pendingGradient,
        banner_mode: _pendingMode,
        ...withoutBanner
      } = patch;
      void _pendingGradient;
      void _pendingMode;
      ({ error } = await supabase.from("profiles").update(withoutBanner).eq("id", user.id));
      gradientUnsupported = !error;
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    if (gradientUnsupported) {
      toast.info("Profile saved — run the profile gradient migration to enable gradients.");
    } else {
      toast.success("Profile saved");
    }
    // Hand the member straight to the thing they were editing, already painted
    // with the row the server just accepted.
    if (profile?.username) nav({ to: "/u/$username", params: { username: profile.username } });
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
  const previewUser = {
    id: profile.id,
    username: profile.username,
    displayName: displayName || profile.username,
    avatarUrl: profile.avatar_url,
    bannerUrl: profile.banner_url,
    bannerMode,
    bannerGradient,
    updatedAt: profile.updated_at,
    accentColor: accent,
    reducedMotion: Boolean(profile.reduced_motion),
  };
  const previewBanner = getBanner(previewUser);

  return (
    <SettingsSubPage
      title="Profile"
      description="How the rest of RIZZ sees you."
      icon={<UserRound className="h-5 w-5" />}
    >
      <SettingsCard className="space-y-5">
        <div>
          <Label className="text-xs text-muted-foreground">Live preview</Label>
          <div
            className="mt-2 overflow-hidden rounded-3xl border border-white/10 bg-[#141416]"
            style={
              previewBanner.profileBackground
                ? { background: previewBanner.profileBackground }
                : undefined
            }
          >
            <ProfileHeader
              user={previewUser}
              effects={equipped.data}
              status="offline"
              surface={previewBanner.surface}
              gutter="16px"
            />
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            This is exactly how the banner, avatar, name row and profile gradient render on your
            profile.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 ring-2 ring-primary/40">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
              {initial}
            </AvatarFallback>
          </Avatar>
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0], "avatar")}
            />
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 glass-strong px-4 py-2 text-sm font-medium hover:bg-white/5">
              <Upload className="h-4 w-4" /> Upload a photo
            </span>
          </label>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">{t("profile_pick_cats")}</Label>
          <div
            className="mt-2 grid grid-cols-6 gap-2"
            role="radiogroup"
            aria-label={t("profile_choose_cat")}
          >
            {DEFAULT_AVATARS.map((avatar) => {
              const active = profile.avatar_url === avatar.url;
              return (
                <button
                  key={avatar.id}
                  type="button"
                  role="radio"
                  aria-label={tf("profile_use_cat", { label: avatar.label })}
                  aria-checked={active}
                  onClick={() => void chooseAvatar(avatar.url)}
                  className={`relative aspect-square overflow-hidden rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    active ? "border-primary shadow-md" : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <img
                    src={avatar.url}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {active && (
                    <span className="absolute inset-0 grid place-items-center rounded-full bg-black/30 text-white">
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">{t("profile_banner")}</Label>
          <div className="mt-2">
            <BannerGradientPicker
              imageUrl={profile.banner_url}
              gradient={bannerGradient}
              onGradientChange={changeBannerGradient}
              onClearGradient={clearBannerGradient}
              onUpload={(file) => void uploadAvatar(file, "banner")}
              onRemoveImage={removeBannerImage}
              uploading={bannerUploading}
            />
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">{t("profile_username")}</Label>
          <Input
            value={profile.username ?? ""}
            readOnly
            className="mt-1 border-white/10 bg-transparent text-muted-foreground"
          />
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">{t("profile_display_name")}</Label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.slice(0, 40))}
            className="mt-1 border-white/10 bg-transparent"
          />
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">{t("profile_bio")}</Label>
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 240))}
            rows={3}
            className="mt-1 resize-none border-white/10 bg-transparent"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">{240 - bio.length} chars left</p>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs text-muted-foreground">{t("profile_interests")}</Label>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {interests.length} / 6 selected
            </span>
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
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-white/10 bg-transparent hover:bg-white/5"
                  }`}
                >
                  <CustomEmoji name={emoji} className="h-5 w-5 shrink-0" />
                  <span>{id}</span>
                  {active && <Check className="ml-auto h-3.5 w-3.5 text-primary" aria-hidden />}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            These show on your public profile and help people find shared interests.
          </p>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">{t("profile_accent")}</Label>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="h-10 w-16 cursor-pointer rounded-lg border border-white/10 bg-transparent"
            />
            <span className="text-sm font-mono">{accent}</span>
          </div>
        </div>

        <Button
          onClick={save}
          disabled={saving}
          className="h-11 w-full gap-2 border-0 bg-primary text-[14px] font-bold text-primary-foreground shadow-[0_14px_30px_-18px_var(--brand-signal)] transition-transform active:scale-[0.99]"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : "Save & view profile"}
        </Button>
      </SettingsCard>
    </SettingsSubPage>
  );
}
