import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subscribeSafely } from "@/lib/realtime";
import { useAuth } from "@/lib/auth";
import { publicStatusOf, usePresence, type PresenceRow } from "@/lib/presence";

/**
 * KNOCK KNOCK — the availability check that comes before a message.
 *
 * "Are you around?" is a question this app could never answer: a status dot
 * says online / idle / dnd, but it cannot tell an account that closed the tab
 * hours ago from one that has Rizz open in another window while YouTube plays.
 * So the doorbell has two halves:
 *
 *  * a heartbeat (`ping_presence`) that runs while the tab is open, which turns
 *    `last_seen_at` into the honest "is their app actually open" signal, and
 *  * a knock: one row, one answer, kept in the conversation so a knock you were
 *    away for is still waiting instead of disappearing like a toast.
 */

export type KnockResponse = "come_in" | "later" | "busy";

export type Knock = {
  id: string;
  from_user: string;
  to_user: string;
  note: string | null;
  response: KnockResponse | null;
  responded_at: string | null;
  /** True once the recipient has looked at the door. */
  seen: boolean;
  created_at: string;
};

export type KnockVerdict = "live" | "away" | "dnd" | "offline";

/** An open tab pings every two minutes; four minutes of silence means it is gone. */
export const PRESENCE_PING_MS = 2 * 60_000;
export const LIVE_WINDOW_MS = 4 * 60_000;
/** Knocks older than this are history, not a doorbell. */
const DOORBELL_WINDOW_MS = 12 * 60 * 60_000;

const knocksTable = () =>
  (supabase as unknown as { from: (table: string) => any }).from("knocks");

/** "just now", "12m ago", "3h ago", "2d ago" — the answer to "when were they last here". */
export function relativeLastSeen(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "a while ago";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "a while ago";
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return "a long time ago";
}

export type KnockMood = {
  verdict: KnockVerdict;
  /** The word on the pill. */
  label: string;
  /** The honest second line. */
  detail: string;
  /** What the knock button says, which changes with the door. */
  action: string;
};

/**
 * Reads a presence row the way a person would: is their app open, are they at
 * the keyboard, or is the door shut and the lights off?
 */
export function knockMood(
  row: PresenceRow | null | undefined,
  now = Date.now(),
): KnockMood {
  const status = publicStatusOf(row ?? null);
  const lastSeen = row?.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
  const open = !!row && Number.isFinite(lastSeen) && now - lastSeen <= LIVE_WINDOW_MS;

  // Invisible users have a live heartbeat too, but nobody is allowed to see
  // it. `publicStatusOf` folds invisible down to offline; keeping the check
  // here as well means their fresh last_seen_at can never leak a live dot.
  if (!open || status === "offline") {
    return {
      verdict: "offline",
      label: "App closed",
      detail: row?.last_seen_at ? `Last seen ${relativeLastSeen(row.last_seen_at, now)}` : "Not around yet",
      action: "Leave a knock",
    };
  }
  if (status === "dnd") {
    return {
      verdict: "dnd",
      label: "Do not disturb",
      detail: "App open, focusing",
      action: "Knock softly",
    };
  }
  if (status === "idle") {
    return {
      verdict: "away",
      label: "Around, away",
      detail: "App open, nobody at the keyboard",
      action: "Knock anyway",
    };
  }
  return {
    verdict: "live",
    label: "Live now",
    detail: "App open and moving",
    action: "Knock",
  };
}

export function knockMoodColor(verdict: KnockVerdict): string {
  if (verdict === "live") return "#a3e635";
  if (verdict === "away") return "#facc15";
  if (verdict === "dnd") return "#f87171";
  return "#64748b";
}

/** The recipient's answer, in their words. */
export function knockResponseLabel(response: KnockResponse | null): string | null {
  if (response === "come_in") return "Opened the door";
  if (response === "later") return "Be right there";
  if (response === "busy") return "Busy right now";
  return null;
}

/** One line describing a knock, for the thread card. */
export function knockStatusLine(knock: Knock, mine: boolean): string {
  const answer = knockResponseLabel(knock.response);
  if (answer) return answer;
  if (!mine) return "Waiting for you";
  return knock.seen ? "Seen 👀" : "Knocked";
}

// ---------------------------------------------------------------------------
// Telling the truth about delivery: a knock is worth sending even when the door
// is shut, but the sender deserves to know which of the two just happened.
// ---------------------------------------------------------------------------
export function knockSentMessage(mood: KnockMood, name: string): string {
  if (mood.verdict === "live") return `Knocked · @${name} is live right now`;
  if (mood.verdict === "dnd") return `Knocked softly · @${name} is focusing`;
  if (mood.verdict === "away") return `Knocked · @${name} has the app open`;
  return `Knock left at the door · @${name} will see it on their next Rizz`;
}

// ---------------------------------------------------------------------------
// One realtime subscription per session, shared by everything that cares about
// knocks (the thread, the doorbell, the list badges).
// ---------------------------------------------------------------------------
type KnockListener = (knock: Knock, event: "INSERT" | "UPDATE") => void;
const knockListeners = new Set<KnockListener>();
let knockChannel: ReturnType<typeof supabase.channel> | null = null;

function subscribeToKnocks(listener: KnockListener) {
  knockListeners.add(listener);
  if (!knockChannel) {
    const channel = supabase
      .channel("user-knocks")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "knocks" }, ({ new: row }) => {
        knockListeners.forEach((entry) => entry(row as unknown as Knock, "INSERT"));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "knocks" }, ({ new: row }) => {
        knockListeners.forEach((entry) => entry(row as unknown as Knock, "UPDATE"));
      });
    subscribeSafely(channel);
    knockChannel = channel;
  }
  return () => {
    knockListeners.delete(listener);
    if (!knockListeners.size && knockChannel) {
      supabase.removeChannel(knockChannel);
      knockChannel = null;
    }
  };
}

// ------------------------------------------------------------------ write path
export async function sendKnock(to: string, note?: string | null): Promise<Knock> {
  const { data, error } = await (supabase.rpc as any)("send_knock", {
    _to: to,
    _note: note?.trim() ? note.trim() : null,
  });
  if (error) throw new Error(friendlyKnockError(error.message));
  return data as Knock;
}

export async function respondKnock(knockId: string, response: KnockResponse): Promise<void> {
  const { error } = await (supabase.rpc as any)("respond_knock", {
    _knock_id: knockId,
    _response: response,
  });
  if (error) throw new Error(friendlyKnockError(error.message));
}

export async function markKnocksSeen(peerId: string): Promise<void> {
  const { error } = await (supabase.rpc as any)("mark_knocks_seen", { _peer: peerId });
  if (error) console.debug("Knock seen marker failed", error.message);
}

/** The RPC speaks in friendly sentences; only translation is branding. */
function friendlyKnockError(message: string): string {
  const text = String(message ?? "");
  if (/does not exist|schema cache/i.test(text)) {
    return "Knock Knock needs the latest backend migration (20261106000000_knock_knock.sql).";
  }
  return text || "Couldn't knock right now";
}

// ----------------------------------------------------------------- heartbeat
/**
 * Keeps `last_seen_at` honest for as long as the tab is open, whether or not the
 * person is at the keyboard. Without this, "app open but away" and "app closed
 * an hour ago" look identical — which is the exact question a knock asks.
 */
export function usePresenceHeartbeat(enabled = true) {
  const { user } = useAuth();
  useEffect(() => {
    if (!enabled || !user?.id) return;

    let cancelled = false;
    const ping = () => {
      if (cancelled) return;
      void (supabase.rpc as any)("ping_presence", {}).then(
        () => {},
        () => {},
      );
    };

    ping();
    const timer = window.setInterval(ping, PRESENCE_PING_MS);
    // Coming back to a tab is the moment the answer matters most: ping at once
    // instead of waiting out the interval.
    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, user?.id]);
}

// -------------------------------------------------------------------- readers
/** The mood of one person, kept fresh enough that "live now" can expire. */
export function useKnockMood(userId: string | null | undefined) {
  const row = usePresence(userId, { refetchInterval: 60_000 });
  const [now, setNow] = useState(() => Date.now());

  // The verdict is derived from a timestamp, so a tick keeps it honest even when
  // nothing new arrives from the server.
  useEffect(() => {
    if (!userId) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [userId]);

  return useMemo(() => knockMood(row, now), [row, now]);
}

/** Every knock between me and one peer, oldest first, live. */
export function useKnockThread(peerId: string | null | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["knocks", user?.id, peerId],
    enabled: !!user?.id && !!peerId,
    staleTime: 15_000,
    queryFn: async (): Promise<Knock[]> => {
      if (!user?.id || !peerId) return [];
      const { data, error } = await knocksTable()
        .select("*")
        .or(
          `and(from_user.eq.${user.id},to_user.eq.${peerId}),and(from_user.eq.${peerId},to_user.eq.${user.id})`,
        )
        .order("created_at", { ascending: true })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as Knock[];
    },
  });

  useEffect(() => {
    if (!user?.id || !peerId) return;
    return subscribeToKnocks((knock) => {
      const mine = knock.from_user === user.id && knock.to_user === peerId;
      const theirs = knock.from_user === peerId && knock.to_user === user.id;
      if (!mine && !theirs) return;
      qc.setQueryData<Knock[]>(["knocks", user.id, peerId], (current = []) => {
        const index = current.findIndex((item) => item.id === knock.id);
        if (index === -1) return [...current, knock];
        return current.map((item) => (item.id === knock.id ? { ...item, ...knock } : item));
      });
    });
  }, [user?.id, peerId, qc]);

  return query.data ?? [];
}

export type DoorbellKnock = Knock & {
  from: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

const DISMISSED_KEY = "rizz:knocks-dismissed";

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as { ids?: string[] };
    return new Set(parsed.ids ?? []);
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    // Only the last few matter; the list is a nudge, not a ledger.
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify({ ids: [...ids].slice(-40) }));
  } catch {
    /* storage full or private mode: the doorbell just rings once per session */
  }
}

/**
 * The doorbell: the newest unanswered knock on my door, whether it arrived while
 * I was reading a thread or while the app was closed for the night.
 */
export function useDoorbell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());
  const [incoming, setIncoming] = useState<Knock | null>(null);
  const dismissedRef = useRef(dismissed);
  dismissedRef.current = dismissed;

  const query = useQuery({
    queryKey: ["knock-doorbell", user?.id],
    enabled: !!user?.id,
    staleTime: 20_000,
    queryFn: async (): Promise<Knock | null> => {
      if (!user?.id) return null;
      const { data, error } = await knocksTable()
        .select("*")
        .eq("to_user", user.id)
        .is("response", null)
        .gte("created_at", new Date(Date.now() - DOORBELL_WINDOW_MS).toISOString())
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return ((data ?? []) as Knock[])[0] ?? null;
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    return subscribeToKnocks((knock, event) => {
      if (event !== "INSERT" || knock.to_user !== user.id) return;
      if (dismissedRef.current.has(knock.id)) return;
      setIncoming(knock);
      void qc.invalidateQueries({ queryKey: ["knock-doorbell", user.id] });
      void qc.invalidateQueries({ queryKey: ["knocks"] });
      void qc.invalidateQueries({ queryKey: ["unread-notifs"] });
    });
  }, [user?.id, qc]);

  const candidates = [incoming, query.data ?? null].filter(Boolean) as Knock[];
  const knock = candidates.find((item) => !item.response && !dismissed.has(item.id)) ?? null;

  const fromQuery = useQuery({
    queryKey: ["knock-doorbell-from", knock?.from_user],
    enabled: !!knock?.from_user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .eq("id", knock!.from_user)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const dismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    saveDismissed(next);
  };

  return {
    knock: knock ? ({ ...knock, from: fromQuery.data ?? null } as DoorbellKnock) : null,
    loading: query.isLoading,
    dismiss,
    async respond(response: KnockResponse) {
      if (!knock) return;
      await respondKnock(knock.id, response);
      dismiss(knock.id);
      void qc.invalidateQueries({ queryKey: ["knocks"] });
      void qc.invalidateQueries({ queryKey: ["knock-doorbell", user?.id] });
    },
  };
}
