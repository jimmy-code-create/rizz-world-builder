import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Lock, Check, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { fetchAllEffects, fetchUserEffects, acquireEffect, equipEffect, unequipEffect, RARITY_GRADIENT, type ProfileEffect } from "@/lib/effects";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import { Nameplate } from "@/components/profile/Nameplate";
import { ProfileEffect as ProfileEffectOverlay } from "@/components/profile/ProfileEffect";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/effects")({
  head: () => ({ meta: [{ title: "Profile Effects · RIZZ" }] }),
  component: EffectsPage,
});

function EffectsPage() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"avatar_decoration" | "profile_effect" | "nameplate">("avatar_decoration");

  const all = useQuery({ queryKey: ["effects-all"], queryFn: fetchAllEffects });
  const mine = useQuery({ queryKey: ["effects-mine", user?.id], queryFn: () => fetchUserEffects(user!.id), enabled: !!user });

  const owned = new Map((mine.data ?? []).map((r: any) => [r.effect_id, r]));
  const filtered = (all.data ?? []).filter((e) => e.type === tab);

  const handleAcquire = async (e: ProfileEffect) => {
    if (!user || !profile) return;
    if ((profile.rizz_score ?? 0) < e.unlock_rizz) {
      toast.error(`Need ${e.unlock_rizz} Rizz to unlock`);
      return;
    }
    try {
      await acquireEffect(user.id, e.id);
      await equipEffect(user.id, e.id, e.type);
      toast.success(`${e.name} unlocked & equipped ✨`);
      qc.invalidateQueries({ queryKey: ["effects-mine"] });
    } catch (err: any) { toast.error(err.message); }
  };

  const handleToggleEquip = async (e: ProfileEffect, equipped: boolean) => {
    if (!user) return;
    try {
      if (equipped) await unequipEffect(user.id, e.id);
      else await equipEffect(user.id, e.id, e.type);
      qc.invalidateQueries({ queryKey: ["effects-mine"] });
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-2">
          <Wand2 className="h-7 w-7 text-[var(--rizz-pink)]" /> Profile Effects
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Unlock cosmetics with Rizz Score. Stack rings, banners, and nameplates.</p>
      </motion.div>

      <div className="flex gap-1 mb-5 glass rounded-xl p-1 border border-white/5 w-fit">
        {[
          { id: "avatar_decoration", label: "Rings" },
          { id: "profile_effect", label: "Overlays" },
          { id: "nameplate", label: "Nameplates" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === t.id ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"}`}
          >{t.label}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map((e) => {
          const own = owned.get(e.id);
          const equipped = !!own?.equipped;
          const locked = !own && (profile?.rizz_score ?? 0) < e.unlock_rizz;
          return (
            <motion.div key={e.id} whileHover={{ y: -4 }} className={`glass rounded-2xl p-4 border ${equipped ? "border-[var(--rizz-pink)]/40 shadow-glow" : "border-white/5"} flex flex-col items-center text-center relative overflow-hidden min-h-[200px]`}>
              <div className="absolute top-2 right-2 text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full text-white font-bold" style={{ background: RARITY_GRADIENT[e.rarity] }}>{e.rarity}</div>

              <div className="relative h-20 w-full flex items-center justify-center my-3">
                {e.type === "avatar_decoration" && (
                  <AvatarDecoration src={null} fallback="R" size={56} effectSlug={e.slug} accent={e.preview_color} />
                )}
                {e.type === "profile_effect" && (
                  <div className="relative h-20 w-full rounded-xl overflow-hidden" style={{ background: `linear-gradient(135deg, ${e.preview_color}33, transparent)` }}>
                    <ProfileEffectOverlay slug={e.slug} />
                  </div>
                )}
                {e.type === "nameplate" && (
                  <Nameplate name="@yourname" slug={e.slug} className="font-display text-lg font-bold" />
                )}
              </div>

              <h3 className="font-display font-bold text-sm">{e.name}</h3>
              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 min-h-[28px]">{e.description}</p>

              {own ? (
                <Button size="sm" variant={equipped ? "outline" : "default"} onClick={() => handleToggleEquip(e, equipped)} className={`w-full mt-3 ${equipped ? "glass border-white/10" : "bg-gradient-primary border-0 shadow-glow"}`}>
                  {equipped ? <><Check className="h-3 w-3 mr-1" /> Equipped</> : "Equip"}
                </Button>
              ) : locked ? (
                <Button size="sm" disabled className="w-full mt-3 glass border border-white/10" variant="outline">
                  <Lock className="h-3 w-3 mr-1" /> {e.unlock_rizz} Rizz
                </Button>
              ) : (
                <Button size="sm" onClick={() => handleAcquire(e)} className="w-full mt-3 bg-gradient-primary border-0 shadow-glow">
                  <Sparkles className="h-3 w-3 mr-1" /> Unlock
                </Button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// silence unused
void Avatar; void AvatarFallback;