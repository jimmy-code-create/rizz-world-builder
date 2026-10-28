import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { subscribeSafely } from "@/lib/realtime";

/**
 * Reel Party — an ephemeral watch-together room for the reels feed.
 *
 * There is no table and no server: a six-character code names a Supabase
 * Realtime channel, presence says who is in the room and who is the host, and
 * the host broadcasts the active reel plus its playhead every couple of
 * seconds. Guests follow. A stranger with the link can join without an invite
 * row, and when the last tab closes the room simply disappears.
 *
 * The room is deliberately best-effort: if Realtime is unreachable, the host
 * still watches reels and the guest sees "waiting for the host" rather than a
 * broken player.
 */

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const REEL_PARTY_CODE_LENGTH = 6;

export type ReelPartySnapshot = {
  /** Index into the reels list. */
  index: number;
  /** Playhead of that reel, in seconds. */
  position: number;
  /** False while the host has the reel paused. */
  playing: boolean;
};

export type ReelPartySync = ReelPartySnapshot & {
  /** Host clock at send time, so guests can advance the playhead. */
  at: number;
};

export type ReelParty = {
  code: string | null;
  isHost: boolean;
  watching: number;
  hostPresent: boolean;
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

export function useReelParty({
  userId,
  onSync,
  readSnapshot,
}: {
  userId: string | null | undefined;
  onSync: (sync: ReelPartySync) => void;
  /** Host-only reader for the reel currently on screen. */
  readSnapshot: () => ReelPartySnapshot | null;
}): ReelParty {
  const [code, setCode] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [watching, setWatching] = useState(1);
  const [hostPresent, setHostPresent] = useState(true);

  const hostRef = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;
  const readSnapshotRef = useRef(readSnapshot);
  readSnapshotRef.current = readSnapshot;

  const create = useCallback(() => {
    const next = makeReelPartyCode();
    hostRef.current = true;
    setIsHost(true);
    setCode(next);
    setWatching(1);
    setHostPresent(true);
    return next;
  }, []);

  const join = useCallback((raw: string) => {
    const next = normalizeReelPartyCode(raw);
    if (!next) return null;
    hostRef.current = false;
    setIsHost(false);
    setCode(next);
    setWatching(1);
    setHostPresent(false);
    return next;
  }, []);

  const leave = useCallback(() => {
    hostRef.current = false;
    setIsHost(false);
    setCode(null);
    setWatching(1);
    setHostPresent(true);
  }, []);

  const publish = useCallback((snapshot: ReelPartySnapshot) => {
    if (!hostRef.current) return;
    sendSync(channelRef.current, snapshot);
  }, []);

  useEffect(() => {
    if (!code || !userId) return;

    const channel = supabase.channel(`reel-party-${code}`, {
      config: { presence: { key: userId } },
    });
    channelRef.current = channel;

    channel.on("broadcast", { event: "sync" }, ({ payload }) => {
      if (hostRef.current) return;
      const sync = payload as Partial<ReelPartySync> | null;
      if (!sync || typeof sync.index !== "number" || typeof sync.at !== "number") return;
      onSyncRef.current({
        index: sync.index,
        position: typeof sync.position === "number" ? sync.position : 0,
        playing: sync.playing !== false,
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
      const people = Object.values(
        channel.presenceState() as Record<string, Array<{ host?: boolean }>>,
      ).flat();
      setWatching(Math.max(1, people.length));
      if (hostRef.current) setHostPresent(true);
      else setHostPresent(people.some((person) => person.host === true));
    });

    subscribeSafely(channel, (status) => {
      if (status !== "SUBSCRIBED") return;
      void channel.track({ host: hostRef.current, at: Date.now() });
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

    return () => {
      if (heartbeat !== null) window.clearInterval(heartbeat);
      try {
        supabase.removeChannel(channel);
      } catch {
        /* already gone */
      }
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [code, userId]);

  return { code, isHost, watching, hostPresent, create, join, leave, publish };
}
