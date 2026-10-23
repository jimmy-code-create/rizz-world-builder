import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check, PawPrint, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getBanner } from "@/lib/banner";
import { defaultAvatarFor } from "@/lib/default-avatars";
import { formatNumber } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import {
  AvatarDecorationArt,
  ProfileEffectArt,
  hasEffectArt,
  isPageProfileEffect,
} from "@/components/effects/registry";
import {
  EFFECT_CATEGORIES,
  RARITY_LABEL,
  RARITY_TINT,
  equipEffect,
  formatCardPrice,
  invalidateEffects,
  purchaseEffect,
  unequipEffect,
  useEffectCatalogue,
  useOwnedEffects,
  useWornEffects,
  type Effect,
} from "@/lib/effects";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/_app/shop")({
  head: () => ({ meta: [{ title: "Effects shop · RIZZ" }] }),
  component: ShopPage,
});

/**
 * The effects shop.
 *
 * Two shelves share one page: avatar decorations (a frame cut around the photo)
 * and profile effects (a scene over the banner). Every card is live art, not a
 * screenshot, and tapping one opens the effect worn on a real profile header so
 * the decision is made on the thing the member will actually see.
 */
function ShopPage() {
  const { user, profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const catalogue = useEffectCatalogue();
  const owned = useOwnedEffects(user?.id);
  const worn = useWornEffects(user?.id);
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  const balance = Number(profile?.paw_balance ?? 0);
  const ownedBySlug = useMemo(
    () => new Map((owned.data ?? []).map((entry) => [entry.effect.slug, entry])),
    [owned.data],
  );
  const effects = (catalogue.data ?? []).filter((effect) => hasEffectArt(effect.slug));
  const staged = effects.find((effect) => effect.slug === openSlug) ?? null;

  const buy = useMutation({
    mutationFn: (effect: Effect) => purchaseEffect(effect.slug),
    onSuccess: async (_result, effect) => {
      toast.success(`${effect.name} unlocked and worn`);
      invalidateEffects(qc, user?.id);
      await refreshProfile();
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't unlock that effect"),
  });

  const wear = useMutation({
    mutationFn: (effect: Effect) => equipEffect(effect.slug),
    onSuccess: (_result, effect) => {
      toast.success(`${effect.name} equipped`);
      invalidateEffects(qc, user?.id);
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't equip that effect"),
  });

  const remove = useMutation({
    mutationFn: (effect: Effect) => unequipEffect(effect.slug),
    onSuccess: (_result, effect) => {
      toast.success(`${effect.name} removed`);
      invalidateEffects(qc, user?.id);
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't remove that effect"),
  });

  const avatarSrc = profile?.avatar_url ?? defaultAvatarFor(profile?.username ?? user?.id ?? "you");
  const banner = getBanner({
    banner_url: profile?.banner_url ?? null,
    banner_mode: profile?.banner_mode ?? null,
    banner_gradient: profile?.banner_gradient ?? null,
    updated_at: profile?.updated_at ?? null,
  });

  const state = (effect: Effect) => {
    const entry = ownedBySlug.get(effect.slug);
    return {
      owned: !!entry,
      equipped: !!entry?.equipped,
    };
  };

  return (
    <div className="mx-auto w-full max-w-5xl pb-16">
      <header className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0e0e10] p-5 sm:p-6">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          Paws shop
        </p>
        <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Effects
        </h1>
        <p className="mt-1.5 max-w-lg text-[13px] leading-5 text-muted-foreground">
          Frames for your photo and scenes for your banner. Buy with Paws, wear one of each, and
          everyone who opens your profile sees it.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-bold text-[#ff2d3f]">
            <PawPrint className="h-3.5 w-3.5" aria-hidden="true" />
            {formatNumber(balance)}
            <span className="font-medium text-muted-foreground">Paws</span>
          </span>
          <Link
            to="/drops"
            className="rounded-full border border-white/10 px-3 py-1.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground"
          >
            Earn more
          </Link>
        </div>
      </header>

      <Tabs defaultValue={EFFECT_CATEGORIES[0].type} className="mt-4">
        <TabsList className="h-auto w-full justify-start gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {EFFECT_CATEGORIES.map((category) => (
            <TabsTrigger
              key={category.type}
              value={category.type}
              className="flex-1 rounded-lg px-3 py-2 text-[12px] font-semibold text-muted-foreground transition-colors data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
            >
              {category.label}
              <span className="ml-1.5 text-[10px] tabular-nums opacity-70">
                {effects.filter((effect) => effect.type === category.type).length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {EFFECT_CATEGORIES.map((category) => (
          <TabsContent key={category.type} value={category.type} className="mt-4">
            <p className="mb-3 text-[12.5px] leading-5 text-muted-foreground">{category.blurb}</p>

            {catalogue.isLoading && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-56 animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.03]"
                  />
                ))}
              </div>
            )}

            {catalogue.isError && (
              <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-[13px] text-muted-foreground">
                The shop couldn&apos;t load. Pull to refresh and try again.
              </p>
            )}

            {!catalogue.isLoading && !catalogue.isError && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {effects
                  .filter((effect) => effect.type === category.type)
                  .map((effect) => {
                    const { owned: isOwned, equipped } = state(effect);
                    return (
                      <button
                        key={effect.slug}
                        type="button"
                        onClick={() => setOpenSlug(effect.slug)}
                        className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e0e10] text-left transition-colors hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <EffectThumb
                          effect={effect}
                          avatarSrc={avatarSrc}
                          bannerBackground={banner.background}
                        />
                        <div className="flex items-start justify-between gap-2 p-3">
                          <div className="min-w-0">
                            <p className="truncate text-[13.5px] font-bold text-foreground">
                              {effect.name}
                            </p>
                            <p
                              className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em]"
                              style={{ color: RARITY_TINT[effect.rarity] }}
                            >
                              {RARITY_LABEL[effect.rarity]}
                            </p>
                          </div>
                          <span className="shrink-0">
                            {equipped ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground">
                                <Check className="h-3 w-3" /> Worn
                              </span>
                            ) : isOwned ? (
                              <span className="rounded-full border border-white/15 px-2 py-1 text-[10px] font-bold text-muted-foreground">
                                Owned
                              </span>
                            ) : (
                              <span className="flex flex-col items-end gap-0.5">
                                <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[#ff2d3f]">
                                  <PawPrint className="h-3 w-3" />
                                  {formatNumber(effect.paw_price)}
                                </span>
                                {effect.price_cents > 0 && (
                                  <span className="text-[10.5px] font-semibold text-muted-foreground">
                                    {formatCardPrice(effect.price_cents)}
                                  </span>
                                )}
                              </span>
                            )}
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}

            {!catalogue.isLoading && !catalogue.isError && effects.length === 0 && (
              <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-[13px] text-muted-foreground">
                The shelves are being restocked. Check back in a moment.
              </p>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!staged} onOpenChange={(open) => !open && setOpenSlug(null)}>
        <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto rounded-2xl border-white/10 bg-[#0e0e10] p-0 sm:max-w-md">
          {staged && (
            <>
              <DialogTitle className="sr-only">{staged.name} preview</DialogTitle>
              <PreviewStage
                effect={staged}
                avatarSrc={avatarSrc}
                banner={banner}
                profile={profile}
                wornAvatarSlug={worn.data?.avatar_decoration?.slug ?? null}
                wornProfileSlug={worn.data?.profile_effect?.slug ?? null}
              />

              <div className="space-y-3 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="min-w-0 truncate font-display text-lg font-bold text-foreground">
                      {staged.name}
                    </h2>
                    <span
                      className="shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em]"
                      style={{
                        color: RARITY_TINT[staged.rarity],
                        borderColor: `color-mix(in srgb, ${RARITY_TINT[staged.rarity]} 45%, transparent)`,
                      }}
                    >
                      {RARITY_LABEL[staged.rarity]}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">
                    {staged.description}
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {state(staged).owned ? "In your collection" : "Price"}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[13px] font-bold text-[#ff2d3f]">
                      <PawPrint className="h-3.5 w-3.5" />
                      {formatNumber(staged.paw_price)}
                    </span>
                    {staged.price_cents > 0 && (
                      <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {formatCardPrice(staged.price_cents)} card
                      </span>
                    )}
                  </span>
                </div>

                <div>
                  {!user ? (
                    <Button asChild className="h-11 w-full font-bold">
                      <Link to="/login">Sign in to unlock</Link>
                    </Button>
                  ) : state(staged).equipped ? (
                    <Button
                      variant="outline"
                      onClick={() => remove.mutate(staged)}
                      disabled={remove.isPending}
                      className="h-11 w-full border-white/15 font-bold"
                    >
                      Remove from profile
                    </Button>
                  ) : state(staged).owned ? (
                    <Button
                      onClick={() => wear.mutate(staged)}
                      disabled={wear.isPending}
                      className="h-11 w-full font-bold"
                    >
                      Wear on profile
                    </Button>
                  ) : (
                    <Button
                      onClick={() => buy.mutate(staged)}
                      disabled={buy.isPending || balance < staged.paw_price}
                      className="h-11 w-full font-bold"
                    >
                      {balance < staged.paw_price
                        ? `Need ${formatNumber(staged.paw_price - balance)} more Paws`
                        : `Unlock · ${formatNumber(staged.paw_price)} Paws`}
                    </Button>
                  )}
                </div>

                {!state(staged).owned && staged.price_cents > 0 && (
                  <p className="text-center text-[11px] text-muted-foreground">
                    Card checkout opens soon — Paws unlock it today.
                  </p>
                )}
                <p className="text-center text-[11px] text-muted-foreground">
                  This is a live preview on your own banner — nothing is saved until you unlock.
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Card art: the decoration around an avatar, or the scene over a mini banner. */
function EffectThumb({
  effect,
  avatarSrc,
  bannerBackground,
}: {
  effect: Effect;
  avatarSrc: string;
  bannerBackground: string;
}) {
  return (
    <div className="relative h-32 w-full overflow-hidden border-b border-white/[0.06] bg-[#131315]">
      {effect.type === "avatar_decoration" ? (
        <div className="absolute inset-0 grid place-items-center">
          <span className="relative block h-14 w-14 rounded-full">
            {/* Behind the photo, exactly like the header, so a frame's inner
                edge is masked by the avatar instead of covering the face. */}
            <AvatarDecorationArt slug={effect.slug} className="z-0" />
            <img
              src={avatarSrc}
              alt=""
              aria-hidden="true"
              className="relative z-[1] h-full w-full rounded-full object-cover"
            />
          </span>
        </div>
      ) : (
        <>
          <div
            className="absolute inset-x-0 top-0 h-[62%]"
            style={{ background: bannerBackground }}
          />
          <ProfileEffectArt slug={effect.slug} animated={false} />
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-3">
            <img
              src={avatarSrc}
              alt=""
              aria-hidden="true"
              className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-[#131315]"
            />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-bold text-foreground">Your profile</p>
              <p className="truncate text-[10px] text-muted-foreground">@you</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** The real profile header, wearing the staged effect, inside the preview sheet. */
function PreviewStage({
  effect,
  avatarSrc,
  banner,
  profile,
  wornAvatarSlug,
  wornProfileSlug,
}: {
  effect: Effect;
  avatarSrc: string;
  banner: ReturnType<typeof getBanner>;
  profile: ReturnType<typeof useAuth>["profile"];
  wornAvatarSlug: string | null;
  wornProfileSlug: string | null;
}) {
  const isAvatar = effect.type === "avatar_decoration";
  const displayName = profile?.display_name || profile?.username || "Your name";
  const username = profile?.username ?? "you";

  return (
    <div
      className="relative overflow-hidden rounded-t-2xl border-b border-white/[0.06]"
      style={{ background: banner.profileBackground ?? banner.surface }}
    >
      <ProfileHeader
        user={{
          id: profile?.id,
          username,
          displayName,
          avatarUrl: avatarSrc,
          bannerUrl: profile?.banner_url ?? null,
          bannerMode: profile?.banner_mode ?? null,
          bannerGradient: profile?.banner_gradient ?? null,
          updatedAt: profile?.updated_at ?? null,
          accentColor: profile?.accent_color ?? null,
          reducedMotion: Boolean(profile?.reduced_motion),
        }}
        statusEnabled={false}
        compact
        gutter="14px"
        surface={banner.surface}
        avatarDecoration={isAvatar ? effect.slug : wornAvatarSlug}
        profileEffect={isAvatar ? wornProfileSlug : effect.slug}
      />
      <div className="space-y-2 px-3.5 pb-3.5 pt-2.5">
        <p className="line-clamp-2 text-[12.5px] leading-5 text-foreground/80">
          {profile?.bio || "This is how your bio sits under the effect."}
        </p>
        <div className="grid grid-cols-3 divide-x divide-white/[0.06] rounded-xl border border-white/[0.08] bg-white/[0.03] py-2 text-center">
          {[
            { label: "Posts", value: 128 },
            { label: "Followers", value: 4200 },
            { label: "Following", value: 311 },
          ].map((stat) => (
            <div key={stat.label} className="min-w-0 px-1">
              <p className="truncate font-display text-[13px] font-bold tabular-nums text-foreground">
                {formatNumber(stat.value)}
              </p>
              <p className="mt-0.5 truncate text-[9px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Video effects wash over the whole card, exactly like the full profile. */}
      {isPageProfileEffect(effect.slug) && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20">
          <ProfileEffectArt slug={effect.slug} once />
        </div>
      )}
    </div>
  );
}
