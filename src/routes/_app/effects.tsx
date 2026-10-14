import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Lock, Check, Wand2, Eye, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  fetchAllEffects,
  fetchUserEffects,
  acquireEffect,
  equipEffect,
  unequipEffect,
  RARITY_GRADIENT,
  type ProfileEffect,
  type ProfileEffectType,
} from "@/lib/effects";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import { Nameplate } from "@/components/profile/Nameplate";
import { ProfileEffect as ProfileEffectVisual } from "@/components/profile/ProfileEffect";
import { toast } from "sonner";

const EFFECT_TABS = [
  { id: "avatar_decoration" as ProfileEffectType, label: "Avatar Decorations" },
  { id: "nameplate" as ProfileEffectType, label: "Nameplates" },
  { id: "profile_effect" as ProfileEffectType, label: "Profile Effects" },
];

export const Route = createFileRoute("/_app/effects")({
  head: () => ({ meta: [{ title: "Discord Profile Effects & Nameplates · RIZZ" }] }),
  component: EffectsPage,
});

function EffectsPage() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<ProfileEffectType>("avatar_decoration");

  const all = useQuery({ queryKey: ["effects-all"], queryFn: fetchAllEffects });
  const mine = useQuery({
    queryKey: ["effects-mine", user?.id],
    queryFn: () => fetchUserEffects(user!.id),
    enabled: !!user,
  });

  const owned = useMemo(() => new Map((mine.data ?? []).map((r: any) => [r.effect_id, r])), [mine.data]);

  // Find currently equipped item of each type
  const equippedDeco = useMemo(() => {
    return (mine.data ?? []).find((r: any) => r.equipped && r.effect?.type === "avatar_decoration")?.effect;
  }, [mine.data]);

  const equippedNameplate = useMemo(() => {
    return (mine.data ?? []).find((r: any) => r.equipped && r.effect?.type === "nameplate")?.effect;
  }, [mine.data]);

  const equippedProfileFx = useMemo(() => {
    return (mine.data ?? []).find((r: any) => r.equipped && r.effect?.type === "profile_effect")?.effect;
  }, [mine.data]);

  // Temporary live preview states (user can click an item to preview it live in the card)
  const [previewDeco, setPreviewDeco] = useState<ProfileEffect | null>(null);
  const [previewNameplate, setPreviewNameplate] = useState<ProfileEffect | null>(null);
  const [previewProfileFx, setPreviewProfileFx] = useState<ProfileEffect | null>(null);

  // Active items shown in the live preview
  const activeDeco = previewDeco || equippedDeco || null;
  const activeNameplate = previewNameplate || equippedNameplate || null;
  const activeProfileFx = previewProfileFx || equippedProfileFx || null;

  const filtered = (all.data ?? []).filter((e) => e.type === tab);

  const handleAcquire = async (e: ProfileEffect) => {
    if (!user || !profile) {
      toast.error("Sign in to unlock effects");
      return;
    }
    if ((profile.rizz_score ?? 0) < e.unlock_rizz) {
      toast.error(`Need ${e.unlock_rizz} Rizz to unlock`);
      return;
    }
    try {
      await acquireEffect(user.id, e.id);
      await equipEffect(user.id, e.id, e.type);
      toast.success(`${e.name} unlocked & equipped ✨`);
      qc.invalidateQueries({ queryKey: ["effects-mine"] });
      qc.invalidateQueries({ queryKey: ["equipped", user.id] });
    } catch (err: any) {
      toast.error(err.message || "Couldn't unlock effect");
    }
  };

  const handleToggleEquip = async (e: ProfileEffect, equipped: boolean) => {
    if (!user) return;
    try {
      if (equipped) {
        await unequipEffect(user.id, e.id, e.type);
        toast.success(`${e.name} unequipped`);
      } else {
        await equipEffect(user.id, e.id, e.type);
        toast.success(`${e.name} equipped`);
      }
      qc.invalidateQueries({ queryKey: ["effects-mine"] });
      qc.invalidateQueries({ queryKey: ["equipped", user.id] });
    } catch (err: any) {
      toast.error(err.message || "Couldn't equip effect");
    }
  };

  const handleSelectPreview = (e: ProfileEffect) => {
    if (e.type === "avatar_decoration") setPreviewDeco(e);
    if (e.type === "nameplate") setPreviewNameplate(e);
    if (e.type === "profile_effect") setPreviewProfileFx(e);
  };

  const resetPreviews = () => {
    setPreviewDeco(null);
    setPreviewNameplate(null);
    setPreviewProfileFx(null);
  };

  const displayName = profile?.display_name || profile?.username || user?.email?.split("@")[0] || "CosmicExplorer";
  const userInitial = displayName.charAt(0).toUpperCase();

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-2.5">
          <Wand2 className="h-8 w-8 text-[var(--rizz-pink)]" /> Profile Effects & Nameplates
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customize your profile with Discord-style animated avatar decorations, framed nameplates, and full banner effects.
        </p>
      </motion.div>

      {/* Discord-Style Live Interactive Profile Card Preview */}
      <div className="mb-8 rounded-3xl border border-white/10 bg-card/80 backdrop-blur-xl p-5 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-3 text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5 uppercase tracking-wider text-[var(--rizz-pink)] font-bold">
            <Eye className="h-3.5 w-3.5" /> Live Profile Preview
          </span>
          {(previewDeco || previewNameplate || previewProfileFx) && (
            <button
              type="button"
              onClick={resetPreviews}
              className="text-xs text-[var(--rizz-pink)] hover:underline font-medium"
            >
              Reset to equipped
            </button>
          )}
        </div>

        {/* Discord Profile Card */}
        <div className="max-w-md mx-auto rounded-2xl border border-white/15 bg-[#18191c] overflow-hidden shadow-2xl relative">
          {/* Banner with ProfileEffect */}
          <div className="h-32 w-full relative overflow-hidden bg-gradient-to-r from-purple-900/60 via-indigo-900/60 to-pink-900/60">
            {activeProfileFx && (
              <ProfileEffectVisual slug={activeProfileFx.slug} accent={activeProfileFx.preview_color} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#18191c] via-transparent to-transparent opacity-80" />
          </div>

          {/* Avatar with AvatarDecoration & Nameplate */}
          <div className="px-5 pb-5 pt-0 relative">
            <div className="flex items-end justify-between -mt-10 mb-3">
              <AvatarDecoration
                src={profile?.avatar_url}
                fallback={userInitial}
                size={76}
                effectSlug={activeDeco?.slug}
                accent={activeDeco?.preview_color}
                className="ring-4 ring-[#18191c] rounded-full"
              />
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300 bg-black/40 px-2.5 py-1 rounded-full border border-amber-400/20">
                <Sparkles className="h-3.5 w-3.5" />
                <span>{profile?.rizz_score ?? 150} Rizz</span>
              </div>
            </div>

            {/* Nameplate & Bio */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Nameplate
                  name={displayName}
                  slug={activeNameplate?.slug}
                  accent={activeNameplate?.preview_color}
                  variant="badge"
                  className="text-base"
                />
              </div>
              <p className="text-xs text-zinc-400 font-mono">@{profile?.username || "creator"}</p>
              <p className="text-xs text-zinc-300 mt-2 line-clamp-2">
                {profile?.bio || "Exploring realms and sharing aesthetic moments in Rizz World."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 glass rounded-2xl p-1 border border-white/10 w-fit">
        {EFFECT_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              tab === t.id
                ? "bg-gradient-primary text-white shadow-glow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Catalog Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((e) => {
          const own = owned.get(e.id);
          const equipped = !!own?.equipped;
          const locked = !own && (profile?.rizz_score ?? 0) < e.unlock_rizz;
          const isPreviewing =
            (e.type === "avatar_decoration" && previewDeco?.id === e.id) ||
            (e.type === "nameplate" && previewNameplate?.id === e.id) ||
            (e.type === "profile_effect" && previewProfileFx?.id === e.id);

          return (
            <motion.div
              key={e.id}
              whileHover={{ y: -4 }}
              onClick={() => handleSelectPreview(e)}
              className={`glass rounded-2xl p-4 border transition-all cursor-pointer flex flex-col items-center text-center relative overflow-hidden min-h-[240px] ${
                equipped
                  ? "border-[var(--rizz-pink)] shadow-glow bg-[var(--rizz-pink)]/[0.04]"
                  : isPreviewing
                  ? "border-cyan-400/80 shadow-[0_0_15px_rgba(6,182,212,0.3)] bg-cyan-400/[0.03]"
                  : "border-white/10 hover:border-white/25"
              }`}
            >
              {/* Rarity Tag */}
              <div
                className="absolute top-2.5 right-2.5 text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full text-white font-bold shadow-xs"
                style={{ background: RARITY_GRADIENT[e.rarity] }}
              >
                {e.rarity}
              </div>

              {/* Visual Preview */}
              <div className="relative h-24 w-full flex items-center justify-center my-2">
                {e.type === "avatar_decoration" && (
                  <AvatarDecoration
                    src={profile?.avatar_url}
                    fallback={userInitial}
                    size={60}
                    effectSlug={e.slug}
                    accent={e.preview_color}
                  />
                )}
                {e.type === "nameplate" && (
                  <Nameplate
                    name={displayName}
                    slug={e.slug}
                    accent={e.preview_color}
                    variant="badge"
                    className="font-bold text-sm"
                  />
                )}
                {e.type === "profile_effect" && (
                  <div className="relative h-20 w-full rounded-xl overflow-hidden border border-white/10 bg-gradient-to-r from-purple-950/60 to-indigo-950/60">
                    <ProfileEffectVisual slug={e.slug} accent={e.preview_color} />
                    <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white/80 drop-shadow-md">
                      {e.name}
                    </div>
                  </div>
                )}
              </div>

              {/* Title & Description */}
              <h3 className="font-display font-bold text-sm mt-1">{e.name}</h3>
              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 min-h-[32px]">
                {e.description}
              </p>

              {/* Action Buttons */}
              <div className="w-full mt-3" onClick={(event) => event.stopPropagation()}>
                {own ? (
                  <Button
                    size="sm"
                    variant={equipped ? "outline" : "default"}
                    onClick={() => handleToggleEquip(e, equipped)}
                    className={`w-full ${
                      equipped
                        ? "glass border-white/20 text-white"
                        : "bg-gradient-primary border-0 shadow-glow text-white font-semibold"
                    }`}
                  >
                    {equipped ? (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1" /> Equipped
                      </>
                    ) : (
                      "Equip"
                    )}
                  </Button>
                ) : locked ? (
                  <Button
                    size="sm"
                    disabled
                    className="w-full glass border border-white/10 text-muted-foreground"
                    variant="outline"
                  >
                    <Lock className="h-3 w-3 mr-1" /> {e.unlock_rizz} Rizz
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleAcquire(e)}
                    className="w-full bg-gradient-primary border-0 shadow-glow text-white font-semibold"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1" /> Unlock ({e.unlock_rizz} Rizz)
                  </Button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
