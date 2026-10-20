import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Coins,
  Plus,
  Timer,
  Loader2,
  Sparkles,
  Users,
  Share2,
  Megaphone,
  Check,
  PawPrint,
} from "lucide-react";
import { motion } from "framer-motion";
import { formatNumber } from "@/lib/formatters";
import { fixCommonTypos, hasKnownTypo } from "@/lib/text-fix";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/_app/drops")({
  head: () => ({ meta: [{ title: "Bounties · RIZZ" }] }),
  component: DropsPage,
});

const SHARE_QUEST_KEY = "rizz.quests.shared";

type QuestAction =
  { kind: "link"; to: "/drops" | "/groups" | "/feed" } | { kind: "create" } | { kind: "share" };

type Quest = {
  id: string;
  icon: typeof Coins;
  title: string;
  desc: string;
  pays: string;
  action: QuestAction;
  done: (ctx: { claims: number; posted: boolean; shared: boolean }) => boolean;
};

/**
 * Promo challenges stay device-tracked. The economy itself is server-side:
 * every successful bounty claim pays Paws through `claim_bounty`, and Paws are
 * the score shown across profiles and the leaderboard.
 */
const BOUNTY_PAW_REWARD = 25;

const QUESTS: Quest[] = [
  {
    id: "quest:claim",
    icon: Coins,
    title: "Claim your first bounty",
    desc: "Grab any active bounty below before it sells out.",
    pays: `${BOUNTY_PAW_REWARD} Paws per claim`,
    action: { kind: "link", to: "/drops" },
    done: ({ claims }) => claims > 0,
  },
  {
    id: "quest:post",
    icon: Plus,
    title: "Post a bounty for the crew",
    desc: "Put up loot and watch the rush come to you.",
    pays: "Community heat",
    action: { kind: "create" },
    done: ({ posted }) => posted,
  },
  {
    id: "quest:invite",
    icon: Users,
    title: "Bring 3 friends to your group",
    desc: "Groups grow through invite links — be the connector.",
    pays: "More people in your corner",
    action: { kind: "link", to: "/groups" },
    done: () => false,
  },
  {
    id: "quest:share",
    icon: Share2,
    title: "Share RIZZ outside the app",
    desc: "Send your invite link anywhere friends hang out.",
    pays: "New members boost your posts",
    action: { kind: "share" },
    done: ({ shared }) => shared,
  },
  {
    id: "quest:hype",
    icon: Megaphone,
    title: "Hype a win on the feed",
    desc: "Post your bounty haul so others join the hunt.",
    pays: "More eyes on your haul",
    action: { kind: "link", to: "/feed" },
    done: () => false,
  },
];

function DropsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const [dropOpen, setDropOpen] = useState(false);
  const [shared, setShared] = useState<boolean>(() => {
    try {
      return typeof localStorage !== "undefined" && localStorage.getItem(SHARE_QUEST_KEY) === "1";
    } catch {
      return false;
    }
  });
  const drops = useQuery({
    queryKey: ["drops"],
    queryFn: async () => {
      const { data } = await supabase
        .from("drops")
        .select("*, creator:profiles!drops_creator_id_fkey(username,display_name,avatar_url)")
        .gt("expires_at", new Date().toISOString())
        .order("expires_at");
      return data ?? [];
    },
  });
  const myClaims = useQuery({
    queryKey: ["my-claims", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("drop_claims").select("drop_id").eq("user_id", user!.id);
      return new Set((data ?? []).map((r) => r.drop_id));
    },
    enabled: !!user,
  });

  useEffect(() => {
    const ch = supabase
      .channel("drops-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "drops" }, () =>
        qc.invalidateQueries({ queryKey: ["drops"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "drop_claims" }, () => {
        qc.invalidateQueries({ queryKey: ["drops"] });
        qc.invalidateQueries({ queryKey: ["my-claims"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const claim = async (dropId: string) => {
    if (!user) return;
    const { data, error } = await supabase.rpc("claim_bounty", { _drop_id: dropId });
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as { status?: string; reward?: number } | null;
    if (result?.status === "already_claimed") {
      toast.info("Already claimed");
    } else {
      toast.success(`Claimed! +${result?.reward ?? BOUNTY_PAW_REWARD} Paws`);
    }
    await Promise.all([
      refreshProfile(),
      qc.invalidateQueries({ queryKey: ["my-claims", user.id] }),
      qc.invalidateQueries({ queryKey: ["drops"] }),
    ]);
  };

  const shareApp = async () => {
    const url = typeof window !== "undefined" ? window.location.origin : "https://rizz.app";
    const data = { title: "RIZZ", text: "Join me on RIZZ — claim bounties and stack Paws.", url };
    try {
      const nav =
        typeof navigator === "undefined"
          ? null
          : (navigator as Navigator & {
              share?: (data: unknown) => Promise<void>;
              clipboard?: Clipboard;
            });
      if (nav?.share) {
        await nav.share(data);
      } else if (nav?.clipboard) {
        await nav.clipboard.writeText(`${data.text} ${url}`);
        toast.success("Invite link copied — paste it anywhere.");
      } else {
        toast.info("Copy this link", { description: url });
        return;
      }
      try {
        localStorage.setItem(SHARE_QUEST_KEY, "1");
      } catch {
        // Private mode: the quest simply won't persist on this device.
      }
      setShared(true);
    } catch {
      // Share sheet dismissed — not a failure, leave the quest open.
    }
  };

  const questCtx = {
    claims: myClaims.data?.size ?? 0,
    posted: (drops.data ?? []).some(
      (d: { creator_id?: string }) => user && d.creator_id === user.id,
    ),
    shared,
  };
  const questsDone = QUESTS.filter((q) => q.done(questCtx)).length;

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 flex items-center justify-between gap-3"
      >
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2 text-foreground">
            <Coins className="h-6 w-6 text-primary" /> Bounties
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Limited bounties. Fast claims. Don&apos;t sleep.
          </p>
        </div>
        <Button
          onClick={() => setDropOpen(true)}
          className="bg-primary text-primary-foreground border-0 shadow-md"
        >
          <Plus className="h-4 w-4 mr-1" />
          Bounty
        </Button>
        <CreateDropDialog open={dropOpen} onOpenChange={setDropOpen} />
      </motion.div>

      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/20 bg-primary/[0.055] p-3.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          <PawPrint className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Paws balance
          </p>
          <p className="font-display text-xl font-bold leading-tight">
            {formatNumber(profile?.paw_balance ?? 0)} Paws
          </p>
          <p className="text-[11px] text-muted-foreground">
            Every successful bounty claim pays {BOUNTY_PAW_REWARD} Paws.
          </p>
        </div>
        <Link
          to="/effects"
          className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Use Paws
        </Link>
      </div>

      {drops.isLoading && <div className="h-40 animate-pulse rounded-3xl glass" />}

      <div className="space-y-3">
        {drops.data?.map((d: any) => {
          const claimed = myClaims.data?.has(d.id);
          const soldOut = d.claim_count >= d.claim_limit;
          const ownBounty = d.creator_id === user?.id;
          const pct = Math.min(100, (d.claim_count / d.claim_limit) * 100);
          return (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-3xl overflow-hidden border border-white/5"
            >
              {d.media_url && (
                <div className="aspect-video bg-black overflow-hidden">
                  <img
                    src={d.media_url}
                    alt={d.title}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-xl">{fixCommonTypos(d.title)}</h3>
                    {d.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {fixCommonTypos(d.description)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">by @{d.creator?.username}</p>
                  </div>
                  <Countdown to={d.expires_at} />
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">
                      {formatNumber(d.claim_count)} / {formatNumber(d.claim_limit)} claimed
                    </span>
                    <span
                      className="font-bold"
                      style={{ color: pct > 90 ? "var(--brand-signal)" : undefined }}
                    >
                      {Math.round(pct)}%
                    </span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <Button
                  onClick={() => claim(d.id)}
                  disabled={claimed || soldOut || ownBounty || !user}
                  className={`w-full mt-4 ${claimed || soldOut || ownBounty ? "glass border border-white/10" : "bg-primary text-primary-foreground border-0 shadow-md"}`}
                  variant={claimed || soldOut || ownBounty ? "outline" : "default"}
                >
                  {claimed ? (
                    "✓ Claimed"
                  ) : soldOut ? (
                    "Sold out"
                  ) : ownBounty ? (
                    "Your bounty"
                  ) : (
                    <>
                      <PawPrint className="h-4 w-4 mr-1" /> Claim · +{BOUNTY_PAW_REWARD} Paws
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {drops.data?.length === 0 && (
        <div className="glass rounded-3xl p-10 text-center">
          <div className="text-5xl mb-3">🪙</div>
          <h2 className="font-display text-xl font-bold">No active bounties</h2>
          <p className="text-sm text-muted-foreground mt-1">Post one and watch the rush.</p>
        </div>
      )}

      <div className="glass rounded-3xl p-5 mt-3 flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <h2 className="font-display text-lg font-bold">Spend your Paws</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Unlock a full-profile effect or an avatar decoration.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            to="/effects"
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Sparkles className="h-4 w-4" /> Open Effects
          </Link>
          <Link
            to="/leaderboard"
            search={{ earn: true }}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/10 px-4 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Top Paws
          </Link>
        </div>
      </div>

      <section aria-label="Bounty quests" className="mt-3">
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <h2 className="font-display text-lg font-bold">Quests</h2>
          <span className="text-xs font-semibold text-muted-foreground" aria-live="polite">
            {questsDone} of {QUESTS.length} done
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-white/5"
          role="progressbar"
          aria-label="Quests completed"
          aria-valuenow={questsDone}
          aria-valuemin={0}
          aria-valuemax={QUESTS.length}
        >
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${Math.round((questsDone / QUESTS.length) * 100)}%` }}
          />
        </div>
        <div className="mt-2 space-y-2">
          {QUESTS.map((quest) => {
            const done = quest.done(questCtx);
            const Icon = quest.icon;
            return (
              <div
                key={quest.id}
                className={`glass flex items-center gap-3 rounded-2xl border border-white/5 p-4 ${done ? "opacity-80" : ""}`}
              >
                <span
                  aria-hidden
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${done ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground"}`}
                >
                  {done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{quest.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{quest.desc}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-primary">
                    Pays: {quest.pays}
                  </p>
                </div>
                {!done &&
                  (quest.action.kind === "link" ? (
                    <Link
                      to={quest.action.to}
                      className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full border border-white/10 px-4 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      Go
                    </Link>
                  ) : quest.action.kind === "create" ? (
                    <button
                      type="button"
                      onClick={() => setDropOpen(true)}
                      className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full border border-white/10 px-4 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      Go
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={shareApp}
                      className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full border border-white/10 px-4 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      Share
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
        <p className="mt-2 px-1 text-[11px] text-muted-foreground">
          Bounty claims pay {BOUNTY_PAW_REWARD} Paws each. Quest progress is tracked on this device;
          Paws never expire and never lose their leaderboard value when you spend them.
        </p>
      </section>
    </div>
  );
}

function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, new Date(to).getTime() - now);
  const h = Math.floor(diff / 3.6e6);
  const m = Math.floor((diff % 3.6e6) / 6e4);
  const s = Math.floor((diff % 6e4) / 1000);
  return (
    <div className="border border-border bg-card rounded-xl px-3 py-1.5 font-mono text-xs font-bold flex items-center gap-1 shrink-0">
      <Timer className="h-3 w-3 text-primary" />
      {h > 0 ? `${h}h ${m}m` : `${m}:${String(s).padStart(2, "0")}`}
    </div>
  );
}

function CreateDropDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [limit, setLimit] = useState(100);
  const [hours, setHours] = useState(24);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const create = async () => {
    if (!user || !title.trim()) return;
    setBusy(true);
    try {
      let media_url: string | null = null;
      if (file) {
        const path = `${user.id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("drops").upload(path, file);
        if (upErr) throw upErr;
        media_url = supabase.storage.from("drops").getPublicUrl(path).data.publicUrl;
      }
      const expires_at = new Date(Date.now() + hours * 3.6e6).toISOString();
      const { error } = await supabase.from("drops").insert({
        creator_id: user.id,
        title: title.trim(),
        description: desc.trim() || null,
        claim_limit: limit,
        expires_at,
        media_url,
      });
      if (error) throw error;
      toast.success("Bounty is live 🚀");
      qc.invalidateQueries({ queryKey: ["drops"] });
      onOpenChange(false);
      setTitle("");
      setDesc("");
      setFile(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-white/10">
        <DialogHeader>
          <DialogTitle className="font-display">New bounty</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
            className="glass border-white/10"
          />
          {hasKnownTypo(title) && (
            <button
              type="button"
              onClick={() => setTitle(fixCommonTypos(title))}
              className="-mt-1 text-left text-[11px] text-primary hover:underline"
            >
              Did you mean “{fixCommonTypos(title)}”?
            </button>
          )}
          <Textarea
            placeholder="Hype it up"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            maxLength={280}
            className="glass border-white/10"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            className="w-full glass border-white/10"
          >
            {file ? `📎 ${file.name}` : "Add image (optional)"}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Claim limit</label>
              <Input
                type="number"
                value={limit}
                onChange={(e) => setLimit(+e.target.value)}
                min={1}
                max={10000}
                className="glass border-white/10"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Duration (hrs)</label>
              <Input
                type="number"
                value={hours}
                onChange={(e) => setHours(+e.target.value)}
                min={1}
                max={168}
                className="glass border-white/10"
              />
            </div>
          </div>
          <Button
            onClick={create}
            disabled={busy || !title.trim()}
            className="w-full bg-primary text-primary-foreground border-0 shadow-md"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Launch bounty"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
