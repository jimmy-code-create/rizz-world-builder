import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type PresenceStatus = "online" | "idle" | "dnd" | "invisible";
/** What other people are allowed to see: invisible users read as offline. */
export type PublicPresence = PresenceStatus | "offline";

export type PresenceRow = {
  user_id: string;
  status: PresenceStatus;
  manual: boolean;
  custom_status_emoji: string | null;
  custom_status_text: string | null;
  custom_status_expires_at: string | null;
};

/** Idle after five minutes without activity, back to online on activity. */
export const IDLE_AFTER_MS = 5 * 60_000;
/** Never write presence more often than this, so activity can't flood the server. */
export const PRESENCE_WRITE_THROTTLE_MS = 45_000;

export const PRESENCE_STATUSES: Array<{
  value: PresenceStatus;
  label: string;
  hint: string;
  color: string;
}> = [
  { value: "online", label: "Online", hint: "Available to chat", color: "#22c55e" },
  { value: "idle", label: "Idle", hint: "Away for a moment", color: "#facc15" },
  { value: "dnd", label: "Do not disturb", hint: "Mutes sounds and calls", color: "#ef4444" },
  { value: "invisible", label: "Invisible", hint: "Appear offline to everyone", color: "#64748b" },
];

export function statusColor(status: PublicPresence) {
  return PRESENCE_STATUSES.find((entry) => entry.value === status)?.color ?? "#64748b";
}

export function statusLabel(status: PublicPresence) {
  if (status === "offline") return "Offline";
  return PRESENCE_STATUSES.find((entry) => entry.value === status)?.label ?? "Offline";
}

/**
 * The one-word version, for tight spots like the header pill where
 * "Do not disturb" would push the rest of the bar off a 390px screen.
 */
export function statusShortLabel(status: PublicPresence) {
  if (status === "dnd") return "DND";
  return statusLabel(status);
}

/** The custom status, or null when empty or already expired. */
export function customStatusOf(row: PresenceRow | undefined | null) {
  if (!row) return null;
  if (row.custom_status_expires_at && new Date(row.custom_status_expires_at).getTime() <= Date.now()) return null;
  const emoji = row.custom_status_emoji ?? null;
  const text = row.custom_status_text ?? null;
  if (!emoji && !text) return null;
  return { emoji, text };
}

/** Custom statuses for someone else are hidden while they are invisible. */
export function publicCustomStatus(row: PresenceRow | undefined | null, isSelf: boolean) {
  if (!row) return null;
  if (!isSelf && row.status === "invisible") return null;
  return customStatusOf(row);
}

export function publicStatusOf(row: PresenceRow | undefined | null, isSelf = false): PublicPresence {
  if (!row) return "offline";
  if (!isSelf && row.status === "invisible") return "offline";
  return row.status;
}

// ---------------------------------------------------------------------------
// A single shared realtime subscription: one channel for the whole app, no
// matter how many components are showing status dots.
// ---------------------------------------------------------------------------
type PresenceListener = () => void;
const presenceListeners = new Set<PresenceListener>();
let presenceChannel: ReturnType<typeof supabase.channel> | null = null;

function emitPresenceChange() {
  presenceListeners.forEach((listener) => listener());
}

function subscribeToPresence(listener: PresenceListener) {
  presenceListeners.add(listener);
  if (!presenceChannel) {
    presenceChannel = supabase
      .channel("user-presence")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_presence" }, () => {
        // Row level security applies here: an invisible status is never sent to
        // anyone but its owner.
        emitPresenceChange();
      })
      .subscribe();
  }
  return () => {
    presenceListeners.delete(listener);
    if (!presenceListeners.size && presenceChannel) {
      supabase.removeChannel(presenceChannel);
      presenceChannel = null;
    }
  };
}

const presenceTable = () => (supabase as unknown as { from: (table: string) => any }).from("user_presence");

export function presenceMapKey(userIds: string[]) {
  return ["presence-map", [...userIds].sort().join(",")] as const;
}

/** Presence rows for a set of users, kept fresh by the shared realtime channel. */
export function usePresenceMap(userIds: string[]) {
  const qc = useQueryClient();
  const ids = useMemo(() => [...new Set(userIds.filter(Boolean))], [userIds.join("|")]);
  const key = presenceMapKey(ids);

  const query = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Record<string, PresenceRow>> => {
      if (!ids.length) return {};
      const { data, error } = await presenceTable()
        .select("user_id,status,manual,custom_status_emoji,custom_status_text,custom_status_expires_at")
        .in("user_id", ids);
      if (error) throw error;
      return Object.fromEntries(((data ?? []) as PresenceRow[]).map((row) => [row.user_id, row]));
    },
    enabled: ids.length > 0,
    staleTime: 30_000,
  });

  useEffect(
    () =>
      subscribeToPresence(() => {
        void qc.invalidateQueries({ queryKey: ["presence-map"] });
        void qc.invalidateQueries({ queryKey: ["presence-self"] });
      }),
    [qc],
  );

  const rows = query.data ?? {};
  return {
    rows,
    statusOf: (userId: string | null | undefined): PublicPresence =>
      userId ? publicStatusOf(rows[userId], userId === selfId()) : "offline",
  };
}

/** One user's presence (used in chat headers and profiles). */
export function usePresence(userId: string | null | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["presence-user", userId ?? "none"],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<PresenceRow | null> => {
      if (!userId) return null;
      const { data, error } = await presenceTable()
        .select("user_id,status,manual,custom_status_emoji,custom_status_text,custom_status_expires_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as PresenceRow | null;
    },
  });

  useEffect(
    () =>
      subscribeToPresence(() => {
        void qc.invalidateQueries({ queryKey: ["presence-user"] });
      }),
    [qc],
  );

  return query.data ?? null;
}

// ------------------------------------------------- Do not disturb, synchronously
let selfStatus: PublicPresence = "offline";
let selfUserIdSet = false;

function selfId() {
  return currentUserId;
}
let currentUserId: string | null = null;

/** Read from anywhere (sounds, call ringers) without a query. */
export function isSelfDoNotDisturb() {
  return selfStatus === "dnd";
}

export function currentPresenceStatus() {
  return selfStatus;
}

export function setSelfPresenceCache(status: PublicPresence, userId?: string | null) {
  selfStatus = status;
  if (userId !== undefined) currentUserId = userId;
  selfUserIdSet = true;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("rizz:presence-changed"));
  }
}

export function hasPresenceCache() {
  return selfUserIdSet;
}

async function writePresence(status: PresenceStatus, manual: boolean) {
  const { error } = await supabase.rpc("set_presence_status" as never, { _status: status, _manual: manual } as never);
  if (error) throw error;
}

/** Loads and returns my own presence row (my real status, invisible included). */
export function useSelfPresence() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [rowsVersion, setRowsVersion] = useState(0);

  const query = useQuery({
    queryKey: ["presence-self", user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async (): Promise<PresenceRow | null> => {
      if (!user?.id) return null;
      const { data, error } = await presenceTable()
        .select("user_id,status,manual,custom_status_emoji,custom_status_text,custom_status_expires_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as PresenceRow | null;
    },
  });

  const row = query.data ?? null;

  // Mirror my real status for the synchronous DND checks, then keep it fresh.
  useEffect(() => {
    if (!user?.id || !row) return;
    setSelfPresenceCache(publicStatusOf(row, true), user.id);
  }, [user?.id, row]);

  useEffect(
    () =>
      subscribeToPresence(() => {
        void qc.invalidateQueries({ queryKey: ["presence-self"] });
        setRowsVersion((current) => current + 1);
      }),
    [qc],
  );

  const lastWrite = useRef<{ status: PresenceStatus | null; at: number }>({ status: null, at: 0 });
  const manualRef = useRef(false);
  const statusRef = useRef<PresenceStatus>("online");

  const apply = async (next: PresenceStatus, manual: boolean, force = false) => {
    const previous = { status: statusRef.current, manual: manualRef.current };
    // Throttle: skip identical repeats inside the window so activity stays cheap.
    if (!force && lastWrite.current.status === next && Date.now() - lastWrite.current.at < PRESENCE_WRITE_THROTTLE_MS) return;
    statusRef.current = next;
    manualRef.current = manual;
    lastWrite.current = { status: next, at: Date.now() };
    if (manual) setSelfPresenceCache(next);
    try {
      await writePresence(next, manual);
      if (manual) {
        qc.setQueryData<PresenceRow | null>(["presence-self", user?.id], (current) =>
          current ? { ...current, status: next, manual: true } : current,
        );
      }
    } catch (error) {
      statusRef.current = previous.status;
      manualRef.current = previous.manual;
      lastWrite.current = { status: previous.status, at: 0 };
      throw error;
    }
  };

  useEffect(() => {
    if (!user?.id) {
      setSelfPresenceCache("offline", null);
      return;
    }
    statusRef.current = publicStatusOf(row, true) === "offline" ? "online" : (publicStatusOf(row, true) as PresenceStatus);
    manualRef.current = row?.manual ?? false;
    currentUserId = user.id;
  }, [user?.id, row]);

  // Idle after five minutes of no activity, back to online on activity. Only
  // while the user hasn't picked a status by hand.
  useEffect(() => {
    if (!user?.id) return;

    let idleTimer = 0;
    const goIdle = () => {
      if (manualRef.current || statusRef.current === "invisible") return;
      if (statusRef.current === "idle") return;
      void apply("idle", false).catch(() => {});
    };
    const onActivity = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(goIdle, IDLE_AFTER_MS);
      if (manualRef.current) return;
      if (statusRef.current !== "idle") return;
      void apply("online", false).catch(() => {});
    };

    idleTimer = window.setTimeout(goIdle, IDLE_AFTER_MS);
    const events = ["pointerdown", "keydown", "focus", "visibilitychange"];
    events.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));

    // Announce presence once on load so last_seen_at (and my dot) are current.
    void apply("online", manualRef.current, true).catch(() => {});

    return () => {
      window.clearTimeout(idleTimer);
      events.forEach((event) => window.removeEventListener(event, onActivity));
    };
  }, [user?.id]);

  return {
    row,
    status: publicStatusOf(row, true) === "offline" ? ("online" as PresenceStatus) : (publicStatusOf(row, true) as PresenceStatus),
    manual: row?.manual ?? false,
    customStatus: customStatusOf(row),
    async chooseStatus(next: PresenceStatus) {
      await apply(next, true, true);
    },
    /** Write the custom status. Throws a friendly message on failure. */
    async saveCustomStatus(emoji: string | null, text: string | null, expiresAt: string | null) {
      const { error } = await supabase.rpc("set_custom_status" as never, {
        _emoji: emoji,
        _text: text,
        _expires_at: expiresAt,
      } as never);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["presence-self"] });
    },
    async clearCustomStatus() {
      const { error } = await supabase.rpc("clear_custom_status" as never, {} as never);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["presence-self"] });
    },
    refresh: query.refetch,
    version: rowsVersion,
  };
}

/** Expiry shortcuts offered in the custom status form. */
export function customStatusExpiry(option: "30m" | "1h" | "4h" | "today" | "never", now = new Date()) {
  const at = new Date(now.getTime());
  if (option === "30m") return new Date(at.getTime() + 30 * 60_000).toISOString();
  if (option === "1h") return new Date(at.getTime() + 60 * 60_000).toISOString();
  if (option === "4h") return new Date(at.getTime() + 4 * 60 * 60_000).toISOString();
  if (option === "today") {
    at.setHours(23, 59, 59, 999);
    return at.toISOString();
  }
  return null;
}
