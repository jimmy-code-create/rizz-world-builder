import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useI18n, tf } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  Image as ImageIcon,
  Loader2,
  Save,
  Sparkles,
  Upload,
  UserRound,
} from "lucide-react";
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
import {
  getBanner,
  normalizeBannerGradient,
  normalizeBannerMode,
  presetForGradient,
  type BannerGradient,
  type BannerMode,
} from "@/lib/banner";
import { PURIFY_PRICE_LABEL, usePurify } from "@/lib/purify";

/**
 * The profile editor is deliberately split into parts.
 *
 * One screen used to stack avatar upload, cat picker, banner picker, name, bio,
 * interests and accent — a wall of controls that read as a single rushed form.
 * Now `/settings/profile` is a small hub with the live preview, and each part
 * opens on its own screen and saves only its own fields. `?part=` keeps the URL
 * shareable and lets the back button walk out of a part.
 */
type ProfilePart = "identity" | "banner" | "interests";

const PROFILE_PARTS: ProfilePart[] = ["identity", "banner", "interests"];

function isProfilePart(value: unknown): value is ProfilePart {
  return typeof value === "string" && (PROFILE_PARTS as string[]).includes(value);
}

export const Route = createFileRoute("/_app/settings/profile")({
  validateSearch: (search: Record<string, unknown>): { part?: ProfilePart } => ({
    part: isProfilePart(search.part) ? search.part : undefined,
  }),
  head: () => ({ meta: [{ title: "Profile · Settings · RIZZ" }] }),
  component: ProfileSettingsPage,
});

/** Same header a settings sub-page carries, but back goes to the parts hub. */
function PartFrame({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="max-w-xl space-y-4">
      <Link
        to="/settings/profile"
        search={{}}
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Profile
      </Link>

      <header className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md">
          {icon}
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold sm:text-2xl">{title}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </header>

      {children}
    </div>
  );
}

function ProfileSettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const { part } = Route.useSearch();
  const purify = usePurify();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [accent, setAccent] = useState("#c9ff3d");
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [bannerMode, setBannerMode] = useState<BannerMode>("none");
  const [bannerGradient, setBannerGradient] = useState<BannerGradient | null>(null);
  const [bannerUploading, setBannerUploading] = useState(false);

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

  function openPart(next: ProfilePart) {
    nav({ to: "/settings/profile", search: { part: next } });
  }

  /** Gradients and banner photos are Purify features; nothing already saved is removed. */
  function requirePurify(feature: string): boolean {
    if (purify.allowed) return true;
    toast.info(`${feature} comes with Purify.`);
    nav({ to: "/purify" });
    return false;
  }

  async function uploadAvatar(file: File, kind: "avatar" | "banner") {
    if (!user) return;
    if (kind === "banner" && !requirePurify("Banner photos")) return;
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

  /** Banner/theme edits are instant: the preview is the source of truth. */
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
    if (!requirePurify("Profile gradients")) return;
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

  /** Each part saves only what it owns, so one edit never rewrites another. */
  async function runSave(action: () => PromiseLike<unknown>, message: string) {
    setSaving(true);
    const result = (await action()) as { error: { message: string } | null };
    setSaving(false);
    if (result?.error) return toast.error(result.error.message);
    await refreshProfile();
    toast.success(message);
  }

  function saveIdentity() {
    if (!user) return;
    void runSave(
      () =>
        supabase
          .from("profiles")
          .update({ display_name: displayName.trim() || null, bio: bio.trim() || null })
          .eq("id", user.id),
      "Name and bio saved",
    );
  }

  function saveAccent() {
    if (!user) return;
    void runSave(
      () => supabase.from("profiles").update({ accent_color: accent }).eq("id", user.id),
      "Glow colour saved",
    );
  }

  function saveInterests() {
    if (!user) return;
    void runSave(
      () => supabase.from("profiles").update({ interests }).eq("id", user.id),
      "Interests saved",
    );
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
  // Same line the full profile carries beside the handle, so the preview never
  // hides the joined month the member is checking.
  const joinedDate = profile.created_at ? new Date(profile.created_at) : null;
  const joined =
    joinedDate && !Number.isNaN(joinedDate.getTime())
      ? joinedDate.toLocaleDateString(undefined, { month: "short", year: "numeric" })
      : null;
  const gradientLabel = presetForGradient(bannerGradient)?.label ?? null;
  const bannerSummary = profile.banner_url
    ? gradientLabel
      ? `Photo · ${gradientLabel} glow`
      : "Photo"
    : gradientLabel
      ? `${gradientLabel} glow`
      : "None";

  const parts: {
    id: ProfilePart;
    label: string;
    description: string;
    summary: string;
    icon: ReactNode;
  }[] = [
    {
      id: "identity",
      label: "Photo, name & bio",
      description: "Your face and the words under it.",
      summary: displayName || `@${profile.username}`,
      icon: <UserRound className="h-4 w-4" />,
    },
    {
      id: "banner",
      label: "Banner & glow",
      description: "The backdrop and the accent halo.",
      summary: bannerSummary,
      icon: <ImageIcon className="h-4 w-4" />,
    },
    {
      id: "interests",
      label: t("profile_interests"),
      description: "Up to six, shown on your public profile.",
      summary: `${interests.length} / 6`,
      icon: <Heart className="h-4 w-4" />,
    },
  ];

  if (part === "identity") {
    return (
      <PartFrame
        title="Photo, name & bio"
        description="Change one thing at a time — the preview on the profile hub follows along."
        icon={<UserRound className="h-5 w-5" />}
      >
        <SettingsCard className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 ring-2 ring-primary/40">
              <AvatarImage src={profile.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary text-2xl font-bold text-primary-foreground">
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

          <Button
            type="button"
            onClick={saveIdentity}
            disabled={saving}
            className="h-11 w-full gap-2 border-0 bg-primary text-[14px] font-bold text-primary-foreground shadow-[0_14px_30px_-18px_var(--brand-signal)] transition-transform active:scale-[0.99]"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Save name & bio"}
          </Button>
        </SettingsCard>
      </PartFrame>
    );
  }

  if (part === "banner") {
    return (
      <PartFrame
        title="Banner & glow"
        description="The backdrop photo, the full-page gradient and the accent halo."
        icon={<ImageIcon className="h-5 w-5" />}
      >
        <SettingsCard className="space-y-5">
          {!purify.allowed && (
            <Link
              to="/purify"
              className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-xs font-semibold text-primary"
            >
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Gradients and banner photos come with Purify — {PURIFY_PRICE_LABEL}.
              </span>
            </Link>
          )}
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
            <p className="mt-2 text-[10px] text-muted-foreground">
              Banner and gradient apply as you tap them.
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
              <span className="font-mono text-sm">{accent}</span>
            </div>
          </div>

          <Button
            type="button"
            onClick={saveAccent}
            disabled={saving}
            className="h-11 w-full gap-2 border-0 bg-primary text-[14px] font-bold text-primary-foreground shadow-[0_14px_30px_-18px_var(--brand-signal)] transition-transform active:scale-[0.99]"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Save glow colour"}
          </Button>
        </SettingsCard>
      </PartFrame>
    );
  }

  if (part === "interests") {
    return (
      <PartFrame
        title={t("profile_interests")}
        description="These show on your public profile and help people find shared interests."
        icon={<Heart className="h-5 w-5" />}
      >
        <SettingsCard className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs text-muted-foreground">{t("profile_interests")}</Label>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {interests.length} / 6 selected
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
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

          <Button
            type="button"
            onClick={saveInterests}
            disabled={saving}
            className="h-11 w-full gap-2 border-0 bg-primary text-[14px] font-bold text-primary-foreground shadow-[0_14px_30px_-18px_var(--brand-signal)] transition-transform active:scale-[0.99]"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Save interests"}
          </Button>
        </SettingsCard>
      </PartFrame>
    );
  }

  return (
    <SettingsSubPage
      title="Profile"
      description="How the rest of RIZZ sees you — one part at a time."
      icon={<UserRound className="h-5 w-5" />}
    >
      <SettingsCard className="space-y-2">
        <Label className="text-xs text-muted-foreground">Live preview</Label>
        <div
          className="overflow-hidden rounded-3xl border border-white/10 bg-[#141416]"
          style={
            previewBanner.profileBackground
              ? { background: previewBanner.profileBackground }
              : undefined
          }
        >
          <ProfileHeader
            user={previewUser}
            status="offline"
            surface={previewBanner.surface}
            gutter="16px"
            handleExtra={
              joined ? (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <img
                    src="/brand/rizz-cat-logo.svg"
                    alt=""
                    aria-hidden
                    className="h-3.5 w-3.5 shrink-0"
                  />
                  Joined {joined}
                </span>
              ) : undefined
            }
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          This is exactly how the banner, avatar, name row and profile gradient render on your
          profile.
        </p>
      </SettingsCard>

      <nav className="overflow-hidden rounded-2xl border border-white/5 glass">
        {parts.map((row, index) => (
          <button
            key={row.id}
            type="button"
            onClick={() => openPart(row.id)}
            className={`flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
              index > 0 ? "border-t border-white/5" : ""
            }`}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-primary">
              {row.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold leading-tight">{row.label}</span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {row.description}
              </span>
            </span>
            <span className="max-w-[38%] shrink-0 truncate text-[11px] font-semibold text-muted-foreground">
              {row.summary}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </nav>

      {profile.username && (
        <Link
          to="/u/$username"
          params={{ username: profile.username }}
          className="inline-flex items-center gap-1.5 px-1 text-xs font-semibold text-primary transition-opacity hover:opacity-80"
        >
          View your profile
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </SettingsSubPage>
  );
}
