import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Check,
  Coins,
  Hand,
  Megaphone,
  PawPrint,
  Plus,
  Share2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { formatNumber } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import { BountyCard } from "@/components/bounties/BountyCard";
import { PostBountyDialog } from "@/components/bounties/PostBountyDialog";
import {
  activeBounties,
  bountiesNeedingYou,
  isEscrowBounty,
  settleExpiredBounties,
  useBountySubmissions,
  viewerRole,
  type BountyRow,
} from "@/lib/bounties";

/**
 * The quest emblem: a squared tile rather than a round chip.
 *
 * Round icon pills read as generic settings rows; a squared tile with a top
 * sheen and a corner tick for the finished ones reads as an achievement token,
 * which is what a quest is. It is also what the reward tile and the empty state
 * use, so the whole page speaks one shape language.
 */
function QuestEmblem({
  icon: Icon,
  done = false,
  size = "md",
}: {
  icon: typeof Coins;
  done?: boolean;
  size?: "md" | "lg";
}) {
  return (
    <span
      aria-hidden
      className={`relative grid shrink-0 place-items-center overflow-hidden border ${
        size === "lg" ? "h-14 w-14 rounded-2xl" : "h-11 w-11 rounded-[13px]"
      } ${
        done
          ? "border-primary/35 bg-primary/[0.14] text-primary"
          : "border-white/10 bg-white/[0.04] text-foreground/80"
      }`}
    >
      {/* Sheen: keeps the flat tile from reading as an empty grey box. */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.07] to-transparent"
      />
      {done ? (
        <Check className={size === "lg" ? "relative h-6 w-6" : "relative h-5 w-5"} strokeWidth={2.6} />
      ) : (
        <Icon className={size === "lg" ? "relative h-6 w-6" : "relative h-5 w-5"} strokeWidth={1.9} />
      )}
      {done && (
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-tl-[7px] bg-primary/85" />
      )}
    </span>
  );
}

/** The one button recipe for the bounty page: square corners, 40px tall. */
const ACTION_BUTTON =
  "inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 text-xs font-bold text-foreground transition-colors hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

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
 * claiming an open call pays Paws through `claim_bounty`, and an escrowed
 * bounty pays its prize through `review_bounty_submission`.
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

/**
 * How far back the board asks for rows. Finished bounties are filtered out of
 * the list, but an expired one is still fetched for a few days so the settle
 * pass below can hand its Paws back before it disappears.
 */
const BOARD_LOOKBACK_DAYS = 3;

function DropsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const [dropOpen, setDropOpen] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
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
      const since = new Date(Date.now() - BOARD_LOOKBACK_DAYS * 86_400_000).toISOString();
      const { data } = await (supabase.from as any)("drops")
        .select(
          "*, creator:profiles!drops_creator_id_fkey(username,display_name,avatar_url,bounties_completed,bounties_cancelled)",
        )
        .gt("expires_at", since)
        .order("expires_at");
      return (data ?? []) as BountyRow[];
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

  // Housekeeping: an open bounty that ran out of time hands the Paws back. It
  // is idempotent and only touches bounties past their deadline, so running it
  // on every visit is cheaper than a cron that can be missed.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void settleExpiredBounties().then((settled) => {
      if (cancelled || settled <= 0) return;
      toast.info(
        settled === 1 ? "A bounty expired — Paws refunded" : `${settled} bounties expired — Paws refunded`,
      );
      void qc.invalidateQueries({ queryKey: ["drops"] });
      void refreshProfile();
    });
    return () => {
      cancelled = true;
    };
  }, [user, qc, refreshProfile]);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "bounty_submissions" }, () => {
        qc.invalidateQueries({ queryKey: ["bounty-submissions"] });
        qc.invalidateQueries({ queryKey: ["drops"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const rows = drops.data ?? [];

  // Names of the members currently on a bounty, so a card can say who.
  const workerIds = useMemo(
    () => [...new Set(rows.map((row) => row.assigned_to).filter((id): id is string => !!id))],
    [rows],
  );
  const workers = useQuery({
    queryKey: ["bounty-workers", workerIds.join(",")],
    enabled: workerIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,username,avatar_url")
        .in("id", workerIds);
      return new Map(
        (data ?? []).map((row: { id: string; username: string | null; avatar_url: string | null }) => [
          row.id,
          row,
        ]),
      );
    },
  });

  // Proof is only readable by the two people in the deal, so only ask for the
  // bounties this viewer is part of.
  const myDropIds = useMemo(() => {
    if (!user) return [];
    return rows
      .filter((row) => viewerRole(row, user.id) !== "guest")
      .map((row) => row.id);
  }, [rows, user]);
  const submissions = useBountySubmissions(myDropIds);

  const submissionFor = (dropId: string) =>
    (submissions.data ?? []).find((row) => row.drop_id === dropId) ?? null;

  // Paid, cancelled and expired bounties are done — they leave the board, and
  // so does an open call whose every claim has been taken. Only work a member
  // can still act on is listed.
  const active = useMemo(() => activeBounties(rows), [rows]);
  const myBounties = useMemo(
    () => active.filter((row) => viewerRole(row, user?.id) !== "guest"),
    [active, user],
  );
  const desk = useMemo(() => bountiesNeedingYou(active, user?.id), [active, user]);
  const visible = onlyMine ? myBounties : active;

  const escrowHeld = useMemo(
    () =>
      rows
        .filter(
          (row) =>
            row.creator_id === user?.id && (row.escrow_state ?? "none") === "held" && isEscrowBounty(row),
        )
        .reduce((total, row) => total + Number(row.prize_paws ?? 0), 0),
    [rows, user],
  );

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
    posted: rows.some((row) => row.creator_id === user?.id),
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
            Put Paws on a task. Pay only for work you approve.
          </p>
        </div>
        <Button
          onClick={() => setDropOpen(true)}
          className="bg-primary text-primary-foreground border-0 shadow-md"
        >
          <Plus className="h-4 w-4 mr-1" />
          Bounty
        </Button>
        <PostBountyDialog open={dropOpen} onOpenChange={setDropOpen} />
      </motion.div>

      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/20 bg-primary/[0.055] p-3.5">
        <QuestEmblem icon={PawPrint} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Paws balance
          </p>
          <p className="font-display text-xl font-bold leading-tight">
            {formatNumber(profile?.paw_balance ?? 0)} Paws
          </p>
          <p className="text-[11px] text-muted-foreground">
            {escrowHeld > 0
              ? `${formatNumber(escrowHeld)} Paws are held in escrow on your bounties.`
              : "Open calls still pay 25 Paws per claim; escrow bounties pay their full prize on approval."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {[
            { label: "Done", value: Number((profile as any)?.bounties_completed ?? 0) },
            { label: "Held", value: escrowHeld },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-center"
            >
              <p className="font-mono text-sm font-bold leading-none">{formatNumber(stat.value)}</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {active.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(
            [
              { id: false, label: "All bounties", icon: Coins },
              { id: true, label: desk.length ? `Your desk · ${desk.length}` : "Your desk", icon: Hand },
            ] as const
          ).map((tab) => (
            <button
              key={String(tab.id)}
              type="button"
              onClick={() => setOnlyMine(tab.id)}
              aria-pressed={onlyMine === tab.id}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-colors ${
                onlyMine === tab.id
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {drops.isLoading && <div className="h-40 animate-pulse rounded-3xl glass" />}

      <div className="space-y-3">
        {visible.map((row) => (
          <BountyCard
            key={row.id}
            bounty={row}
            submission={submissionFor(row.id)}
            workerName={
              row.assigned_to ? (workers.data?.get(row.assigned_to)?.username ?? null) : null
            }
            claimed={myClaims.data?.has(row.id) ?? false}
            onClaim={claim}
            onChanged={() => {
              void qc.invalidateQueries({ queryKey: ["drops"] });
              void refreshProfile();
              void qc.invalidateQueries({ queryKey: ["paw-ledger", user?.id] });
            }}
          />
        ))}
      </div>

      {visible.length === 0 && (
        <div className="glass flex flex-col items-center rounded-3xl p-10 text-center">
          <QuestEmblem icon={onlyMine ? Hand : Coins} size="lg" />
          <h2 className="mt-3 font-display text-xl font-bold">
            {onlyMine ? "Nothing on your desk" : "No active bounties"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {onlyMine
              ? "Bounties you post or take show up here, with the next move spelled out."
              : "Post one and watch the rush."}
          </p>
        </div>
      )}

      <div className="glass rounded-3xl p-5 mt-3 flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> How escrow protects both sides
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            The prize leaves the poster's wallet when the bounty goes live and is locked until they
            approve the work. No approval inside the review window and it pays out on its own. Pull a
            bounty and a fee is kept — double once somebody is already on it.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Link to="/leaderboard" search={{ earn: true }} className={ACTION_BUTTON}>
            <PawPrint className="h-4 w-4 text-primary" />
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
                <QuestEmblem icon={Icon} done={done} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{quest.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{quest.desc}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-primary">
                    Pays: {quest.pays}
                  </p>
                </div>
                {done ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary">
                    <Check className="h-3.5 w-3.5" /> Done
                  </span>
                ) : quest.action.kind === "link" ? (
                  <Link to={quest.action.to} className={ACTION_BUTTON}>
                    Go
                  </Link>
                ) : quest.action.kind === "create" ? (
                  <button type="button" onClick={() => setDropOpen(true)} className={ACTION_BUTTON}>
                    Go
                  </button>
                ) : (
                  <button type="button" onClick={shareApp} className={ACTION_BUTTON}>
                    <Share2 className="h-3.5 w-3.5" />
                    Share
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 px-1 text-[11px] text-muted-foreground">
          Open calls pay {BOUNTY_PAW_REWARD} Paws each. Quest progress is tracked on this device;
          Paws never expire and never lose their leaderboard value when you spend them.
        </p>
      </section>
    </div>
  );
}
