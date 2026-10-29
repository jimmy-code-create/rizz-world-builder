import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { subscribeSafely } from "@/lib/realtime";

/**
 * Reel Party — an ephemeral watch-together room for the reels feed.
 *
 * There is no table and no server: a six-character code names a Supabase
 * Realtime channel, presence says who is watching and who is the host, and the
 * host broadcasts the active reel plus its playhead every couple of seconds.
 * Guests follow. A stranger with the link can join without an invite row, and
 * when the last tab closes the room simply disappears.
 *
 * Two details matter more than they look:
 *
 *  - The presence key is unique per *tab*, not per account. Two windows of the
 *    same account would otherwise share one key and the second one would
 *    silently overwrite the host's `host: true` flag, leaving every guest
 *    reading "waiting for the host" in a room that is very much alive.
 *  - A guest trusts a received sync as proof of life, so host liveness comes
 *    from the playhead heartbeat itself rather than only from presence.
 *
 * The room is deliberately best-effort: if Realtime is unreachable, the host
 * still watches reels and the guest sees "waiting for the host" rather than a
 * broken player.
 */

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const REEL_PARTY_CODE_LENGTH = 6;

/** Silence from the host longer than this means the host is gone. */
const HOST_ABSENCE_MS = 6500;

export type ReelPartySnapshot = {
  /** Index into the reels list. */
  index: number;
  /** Playhead of that reel, in seconds. */
  position: number;
  /** False while the host has the reel paused. */
  playing: boolean;
  /**
   * True while the host has the comments sheet open. Guests open the same
   * sheet on the same reel, so reading along is part of watching together
   * instead of something they have to guess at.
   */
  comments: boolean;
};

export type ReelPartySync = ReelPartySnapshot & {
  /** Host clock at send time, so guests can advance the playhead. */
  at: number;
};

/** What each watcher broadcasts about themselves, so the roster can draw it. */
export type ReelPartyIdentity = {
  name: string;
  avatar: string | null;
  username: string | null;
};

export type ReelPartyMember = ReelPartyIdentity & {
  /** Presence key: one per account *and* per tab. */
  key: string;
  /** Account this watcher is signed in as. */
  userId: string;
  host: boolean;
  /** True for this tab, so it can say "You". */
  self: boolean;
};

export type ReelParty = {
  code: string | null;
  isHost: boolean;
  watching: number;
  hostPresent: boolean;
  /** Who is in the room right now, in join order. */
  members: ReelPartyMember[];
  create: () => string;
  join: (raw: string) => string | null;
  leave: () => void;
  /** Host-only: publish this snapshot to the room. */
  publish: (snapshot: ReelPartySnapshot) => void;
};

export function makeReelPartyCode(): string {
  const bytes = new Uint8Array(REEL_PARTY_CODE_LENGTH);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

/** Accept `abc 234`, `ABC-234` and a pasted invite link; return null if unusable. */
export function normalizeReelPartyCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim().toUpperCase();
  const fromLink = raw.match(/[?&]party=([A-Z0-9]{6})/)?.[1];
  const code = (fromLink ?? raw).replace(/[^A-Z0-9]/g, "").slice(0, REEL_PARTY_CODE_LENGTH);
  return code.length === REEL_PARTY_CODE_LENGTH ? code : null;
}

export function reelPartyInviteUrl(code: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/reels?party=${encodeURIComponent(code)}`;
}

/** One identity per tab: presence keys are unique, so nothing overwrites. */
function makePresenceKey(userId: string): string {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : `${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
  return `${userId}#${suffix}`;
}

function sendSync(channel: RealtimeChannel | null, snapshot: ReelPartySnapshot) {
  if (!channel) return;
  try {
    void channel.send({
      type: "broadcast",
      event: "sync",
      payload: { ...snapshot, at: Date.now() } satisfies ReelPartySync,
    });
  } catch {
    /* Realtime is best-effort; the local player keeps working. */
  }
}

type PresenceMeta = {
  host?: boolean;
  userId?: string;
  name?: string;
  avatar?: string | null;
  username?: string | null;
};

export function useReelParty({
  userId,
  identity,
  onSync,
  readSnapshot,
}: {
  userId: string | null | undefined;
  /** Roster details this tab shows about itself (name, avatar). */
  identity?: ReelPartyIdentity | null;
  onSync: (sync: ReelPartySync) => void;
  /** Host-only reader for the reel currently on screen. */
  readSnapshot: () => ReelPartySnapshot | null;
}): ReelParty {
  const [code, setCode] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [watching, setWatching] = useState(1);
  const [hostPresent, setHostPresent] = useState(true);
  const [members, setMembers] = useState<ReelPartyMember[]>([]);

  const hostRef = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const presenceKeyRef = useRef<string | null>(null);
  const lastSyncAt = useRef(0);
  const joinedRef = useRef(false);
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;
  const readSnapshotRef = useRef(readSnapshot);
  readSnapshotRef.current = readSnapshot;
  const identityRef = useRef(identity);
  identityRef.current = identity;

  const identityKey = `${identity?.name ?? ""}|${identity?.avatar ?? ""}|${identity?.username ?? ""}`;

  const create = useCallback(() => {
    const next = makeReelPartyCode();
    hostRef.current = true;
    lastSyncAt.current = 0;
    setIsHost(true);
    setCode(next);
    setWatching(1);
    setHostPresent(true);
    setMembers([]);
    return next;
  }, []);

  const join = useCallback((raw: string) => {
    const next = normalizeReelPartyCode(raw);
    if (!next) return null;
    hostRef.current = false;
    lastSyncAt.current = 0;
    setIsHost(false);
    setCode(next);
    setWatching(1);
    // Nothing has arrived yet; the first sync flips this to true.
    setHostPresent(false);
    setMembers([]);
    return next;
  }, []);

  const leave = useCallback(() => {
    hostRef.current = false;
    lastSyncAt.current = 0;
    setIsHost(false);
    setCode(null);
    setWatching(1);
    setHostPresent(true);
    setMembers([]);
  }, []);

  const publish = useCallback((snapshot: ReelPartySnapshot) => {
    if (!hostRef.current) return;
    sendSync(channelRef.current, snapshot);
  }, []);

  // Announce this tab (name, avatar, host flag) — on join, and again once the
  // profile finishes loading so the roster never shows a blank row.
  const trackPresence = useCallback(() => {
    const channel = channelRef.current;
    const key = presenceKeyRef.current;
    if (!channel || !key || !joinedRef.current) return;
    const self = identityRef.current;
    try {
      void channel.track({
        host: hostRef.current,
        userId: key.split("#")[0],
        name: self?.name ?? "",
        avatar: self?.avatar ?? null,
        username: self?.username ?? null,
        at: Date.now(),
      }).catch(() => {
        /* presence is best-effort */
      });
    } catch {
      /* presence is best-effort */
    }
  }, []);

  useEffect(() => {
    if (!code || !userId) return;
    joinedRef.current = false;
    const presenceKey = makePresenceKey(userId);
    presenceKeyRef.current = presenceKey;

    const channel = supabase.channel(`reel-party-${code}`, {
      config: { presence: { key: presenceKey } },
    });
    channelRef.current = channel;

    channel.on("broadcast", { event: "sync" }, ({ payload }) => {
      if (hostRef.current) return;
      const sync = payload as Partial<ReelPartySync> | null;
      if (!sync || typeof sync.index !== "number" || typeof sync.at !== "number") return;
      // The host is alive as far as this guest can tell.
      lastSyncAt.current = Date.now();
      setHostPresent(true);
      onSyncRef.current({
        index: sync.index,
        position: typeof sync.position === "number" ? sync.position : 0,
        playing: sync.playing !== false,
        // Older hosts never sent this field; absence means "not reading".
        comments: sync.comments === true,
        at: sync.at,
      });
    });

    // A guest announces itself; the host answers with the current reel so a
    // late joiner lands exactly where everyone else is.
    channel.on("broadcast", { event: "hello" }, () => {
      if (!hostRef.current) return;
      const snapshot = readSnapshotRef.current();
      if (snapshot) sendSync(channel, snapshot);
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<string, PresenceMeta[]>;
      const roster: ReelPartyMember[] = Object.entries(state).map(([key, metas]) => {
        const meta = metas.find((entry) => entry?.host) ?? metas[0] ?? {};
        const account = typeof meta.userId === "string" && meta.userId ? meta.userId : key.split("#")[0];
        return {
          key,
          userId: account,
          name: typeof meta.name === "string" && meta.name ? meta.name : "Someone",
          avatar: typeof meta.avatar === "string" ? meta.avatar : null,
          username: typeof meta.username === "string" ? meta.username : null,
          host: meta.host === true,
          self: key === presenceKey,
        };
      });
      setMembers(roster);
      setWatching(Math.max(1, roster.length));
      if (hostRef.current) setHostPresent(true);
      else if (roster.some((member) => member.host)) setHostPresent(true);
    });

    subscribeSafely(channel, (status) => {
      if (status !== "SUBSCRIBED") return;
      joinedRef.current = true;
      trackPresence();
      if (hostRef.current) {
        const snapshot = readSnapshotRef.current();
        if (snapshot) sendSync(channel, snapshot);
      } else {
        try {
          void channel.send({ type: "broadcast", event: "hello", payload: { at: Date.now() } });
        } catch {
          /* the host may not be here yet */
        }
      }
    });

    // The host is the clock: a slow heartbeat keeps late joins and long pauses
    // honest without spending a message on every timeupdate.
    const heartbeat = hostRef.current
      ? window.setInterval(() => {
          const snapshot = readSnapshotRef.current();
          if (snapshot) sendSync(channelRef.current, snapshot);
        }, 2500)
      : null;

    // Guests stop trusting the host once the playhead goes quiet.
    const absence = hostRef.current
      ? null
      : window.setInterval(() => {
          if (lastSyncAt.current && Date.now() - lastSyncAt.current > HOST_ABSENCE_MS) {
            setHostPresent(false);
          }
        }, 2000);

    return () => {
      if (heartbeat !== null) window.clearInterval(heartbeat);
      if (absence !== null) window.clearInterval(absence);
      joinedRef.current = false;
      try {
        supabase.removeChannel(channel);
      } catch {
        /* already gone */
      }
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [code, userId, trackPresence]);

  // Re-announce once the profile arrives, and keep the roster honest.
  useEffect(() => {
    trackPresence();
  }, [identityKey, trackPresence]);

  return { code, isHost, watching, hostPresent, members, create, join, leave, publish };
}
