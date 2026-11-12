import { useEffect, useId } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subscribeSafely } from "@/lib/realtime";
import { useAuth } from "@/lib/auth";
import {
  publicCustomStatus,
  publicStatusOf,
  type PresenceRow,
  type PublicPresence,
} from "@/lib/presence";
import { loadPrefs, PREFS_EVENT } from "@/lib/prefs";

/**
 * LIVE & VIBING — one read model for the chip and its sheet.
 *
 * Existing data only:
 *  - `voice_rooms` + `voice_participants` for live rooms and realm voice calls;
 *  - `user_presence` for status, custom status and "app open" (`last_seen_at`);
 *  - `follows` for friends (mutual follows);
 *  - `blocks` for both-way hiding;
 *  - `music_queue` for "Listening: …" in a channel where MUSIC BOT is playing;
 *  - `realm_rooms` + `realms` for channel labels.
 *
 * Privacy is enforced by the database before it reaches this module:
 * RLS hides an invisible presence row from everyone but its owner, hides
 * private channels from members without `view_private_channels`, and hides a
 * private realm's rooms from non-members. The client only adds the block
 * filter, which RLS makes readable in both directions.
 *
 * The "Show me in Live & vibing" setting lives in the existing per-device
 * prefs store because there is no `user_settings` table. It removes the
 * viewer's own row from their list; calls are untouched.
 *
 * Reel watch parties are ephemeral Realtime channels with no table, so they
 * cannot be discovered from another account. `parties` stays empty until a
 * discoverable source exists; the sheet hides the section when it is empty.
 */

const PROFILE_SELECT = "username,display_name,avatar_url";

type ProfileLite = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type PresenceJoin = PresenceRow & {
  updated_at?: string | null;
  profile?: ProfileLite | null;
};

type RoomRow = {
  id: string;
  title: string | null;
  host_id: string;
  started_at: string;
  realm_id: string | null;
  realm_room_id: string | null;
  topic: string | null;
  listener_count: number | null;
  host: ProfileLite | null;
  realm_room: { id: string; name: string; realm_id: string } | null;
  participants: Array<{ user_id: string; joined_at: string; user: ProfileLite | null }> | null;
};

export type LivePerson = {
  id: string;
  username: string | null;
  name: string;
  avatarUrl: string | null;
  presence: PublicPresence;
  statusEmoji: string | null;
  statusText: string | null;
  activityLine: string | null;
  voiceRoomId: string | null;
  friend: boolean;
  updatedAt: string | null;
};

export type LiveStream = {
  roomId: string;
  title: string;
  host: LivePerson;
  viewers: number;
  startedAt: string;
};

export type VoiceGroup = {
  key: string;
  realmId: string;
  realmName: string | null;
  channelId: string;
  channelName: string;
  people: LivePerson[];
  count: number;
};

export type WatchParty = {
  id: string;
  title: string;
  host: LivePerson;
  people: number;
};

export type LiveAndVibing = {
  streams: LiveStream[];
  voiceGroups: VoiceGroup[];
  parties: WatchParty[];
  vibing: LivePerson[];
  counts: {
    live: number;
    voice: number;
    party: number;
    people: number;
    vibing: number;
  };
};

export const EMPTY_LIVE_AND_VIBING: LiveAndVibing = {
  streams: [],
  voiceGroups: [],
  parties: [],
  vibing: [],
  counts: { live: 0, voice: 0, party: 0, people: 0, vibing: 0 },
};

/** "App open" window for the Vibing list, tolerant of a missed heartbeat. */
const PRESENT_WINDOW_MS = 12 * 60_000;

export const liveAndVibingKey = (userId: string | null | undefined) =>
  ["live-and-vibing", userId ?? "anon"] as const;

function nameOf(profile: ProfileLite | null | undefined, fallback = "Someone") {
  return profile?.display_name?.trim() || profile?.username?.trim() || fallback;
}

function toPerson(
  profile: ProfileLite | null | undefined,
  id: string,
  row: PresenceJoin | null | undefined,
  friend: boolean,
  activityLine: string | null,
): LivePerson {
  const status = publicStatusOf(row ?? null, false);
  const custom = publicCustomStatus(row ?? null, false);
  return {
    id,
    username: profile?.username ?? null,
    name: nameOf(profile),
    avatarUrl: profile?.avatar_url ?? null,
    presence: status,
    statusEmoji: custom?.emoji ?? null,
    statusText: custom?.text ?? null,
    activityLine,
    voiceRoomId: null,
    friend,
    updatedAt: row?.updated_at ?? null,
  };
}

function byFriendThenNewest(a: LivePerson, b: LivePerson) {
  if (a.friend !== b.friend) return a.friend ? -1 : 1;
  const at = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
  const bt = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
  return bt - at;
}

/**
 * Everything the Live chip and the Live & vibing sheet render.
 * `viewerId` scopes friendships, blocks and the "hide me" preference.
 */
export async function fetchLiveAndVibing(viewerId: string): Promise<LiveAndVibing> {
  const showMe = loadPrefs().showInLiveAndVibing !== false;

  const [roomsResult, presenceResult, followingResult, followersResult, blocksResult] =
    await Promise.all([
      supabase
        .from("voice_rooms")
        .select(
          `id,title,host_id,started_at,realm_id,realm_room_id,topic,listener_count,
           host:profiles!voice_rooms_host_id_fkey(${PROFILE_SELECT}),
           realm_room:realm_rooms(id,name,realm_id),
           participants:voice_participants(user_id,joined_at,user:profiles!voice_participants_user_id_fkey(${PROFILE_SELECT}))`,
        )
        .eq("is_live", true)
        .order("started_at", { ascending: false })
        .limit(60),
      supabase
        .from("user_presence")
        .select(
          `user_id,status,manual,custom_status_emoji,custom_status_text,custom_status_expires_at,last_seen_at,updated_at,
           profile:profiles!user_presence_user_id_fkey(${PROFILE_SELECT})`,
        )
        .limit(500),
      supabase.from("follows").select("following_id").eq("follower_id", viewerId),
      supabase.from("follows").select("follower_id").eq("following_id", viewerId),
      supabase
        .from("blocks")
        .select("blocker_id,blocked_id")
        .or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`),
    ]);

  // A missing table or a permission error should not take the feed down: the
  // sheet degrades to the empty state the same way it does when nobody is on.
  const rooms = (roomsResult.error ? [] : (roomsResult.data ?? [])) as RoomRow[];
  const presenceRows = (presenceResult.error ? [] : (presenceResult.data ?? [])) as PresenceJoin[];
  // If the block list cannot be read, fail closed: showing a blocked person is
  // worse than showing an error with a retry.
  if (blocksResult.error) throw blocksResult.error;
  const following = new Set((followingResult.data ?? []).map((row) => row.following_id));
  const followers = new Set((followersResult.data ?? []).map((row) => row.follower_id));
  const friends = new Set([...following].filter((id) => followers.has(id)));
  const blocked = new Set<string>();
  for (const row of blocksResult.data ?? []) {
    blocked.add(row.blocker_id === viewerId ? row.blocked_id : row.blocker_id);
  }

  const presenceById = new Map<string, PresenceJoin>();
  for (const row of presenceRows) {
    if (row.user_id === viewerId && !showMe) continue;
    presenceById.set(row.user_id, row);
  }

  // Realm names for channel labels. Private realms the viewer cannot read are
  // already absent because realm_rooms RLS hides their channels.
  const realmIds = [
    ...new Set(rooms.map((room) => room.realm_id).filter((id): id is string => !!id)),
  ];
  const realmNames = new Map<string, string>();
  if (realmIds.length) {
    const { data: realmRows } = await supabase.from("realms").select("id,name").in("id", realmIds);
    for (const row of realmRows ?? []) realmNames.set(row.id, row.name);
  }

  // Current track per channel, so "Listening: …" is real.
  const musicByChannel = new Map<string, string>();
  if (realmIds.length) {
    const { data: tracks } = await supabase
      .from("music_queue")
      .select("realm_id,realm_room_id,title,artist,position")
      .eq("status", "queued")
      .in("realm_id", realmIds)
      .order("position", { ascending: true })
      .limit(120);
    for (const track of (tracks ?? []) as Array<{
      realm_id: string;
      realm_room_id: string | null;
      title: string;
      artist: string | null;
    }>) {
      const key = `${track.realm_id}:${track.realm_room_id ?? ""}`;
      if (musicByChannel.has(key)) continue;
      musicByChannel.set(key, track.artist ? `${track.title} — ${track.artist}` : track.title);
    }
  }

  // ---- Live now (public rooms) and In voice (realm channels) -------------
  const streams: LiveStream[] = [];
  const groupMap = new Map<string, VoiceGroup>();
  const voicePeopleById = new Map<string, LivePerson>();

  for (const room of rooms) {
    if (blocked.has(room.host_id)) continue;

    if (!room.realm_room_id) {
      const hostRow = presenceById.get(room.host_id);
      // No readable presence row means the host is invisible (or the row is not
      // present); a stream nobody can see the host of is not shown.
      if (!hostRow || hostRow.status === "invisible") continue;
      const viewers =
        new Set(
          (room.participants ?? [])
            .filter(
              (participant) =>
                participant.user_id !== room.host_id &&
                !blocked.has(participant.user_id) &&
                presenceById.has(participant.user_id),
            )
            .map((participant) => participant.user_id),
        ).size + (room.listener_count ?? 0);
      streams.push({
        roomId: room.id,
        title: room.title || "Live room",
        host: toPerson(room.host, room.host_id, hostRow, friends.has(room.host_id), null),
        viewers,
        startedAt: room.started_at,
      });
      continue;
    }

    // A realm channel row the viewer may not see comes back as null from RLS.
    if (!room.realm_room) continue;

    const key = `${room.realm_id ?? ""}:${room.realm_room_id}`;
    let group = groupMap.get(key);
    if (!group) {
      group = {
        key,
        realmId: room.realm_id ?? room.realm_room.realm_id,
        realmName: realmNames.get(room.realm_id ?? room.realm_room.realm_id) ?? null,
        channelId: room.realm_room_id,
        channelName: room.realm_room.name,
        people: [],
        count: 0,
      };
      groupMap.set(key, group);
    }

    const music =
      musicByChannel.get(`${room.realm_id ?? ""}:${room.realm_room_id}`) ??
      musicByChannel.get(`${room.realm_id ?? ""}:`) ??
      null;

    const candidates = [
      { id: room.host_id, profile: room.host, joinedAt: room.started_at },
      ...(room.participants ?? []).map((participant) => ({
        id: participant.user_id,
        profile: participant.user,
        joinedAt: participant.joined_at,
      })),
    ];
    for (const candidate of candidates) {
      if (blocked.has(candidate.id)) continue;
      if (group.people.some((person) => person.id === candidate.id)) continue;
      const row = presenceById.get(candidate.id);
      if (!row || row.status === "invisible") continue; // invisible / not in the app
      const person = toPerson(
        candidate.profile,
        candidate.id,
        row,
        friends.has(candidate.id),
        music ? `Listening: ${music}` : null,
      );
      person.voiceRoomId = room.id;
      group.people.push(person);
      voicePeopleById.set(candidate.id, person);
    }
  }

  for (const group of groupMap.values()) {
    group.people.sort(byFriendThenNewest);
    group.count = group.people.length;
  }

  streams.sort((a, b) => {
    if (a.host.friend !== b.host.friend) return a.host.friend ? -1 : 1;
    return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
  });

  const newestOf = (group: VoiceGroup) =>
    group.people.reduce((newest, person) => {
      const at = person.updatedAt ? new Date(person.updatedAt).getTime() : 0;
      return Math.max(newest, at);
    }, 0);

  const voiceGroups = [...groupMap.values()]
    .filter((group) => group.count > 0)
    .sort((a, b) => {
      const af = a.people.some((person) => person.friend) ? 1 : 0;
      const bf = b.people.some((person) => person.friend) ? 1 : 0;
      if (af !== bf) return bf - af;
      const an = newestOf(a);
      const bn = newestOf(b);
      if (an !== bn) return bn - an;
      return b.count - a.count;
    });

  // ---- Vibing now -------------------------------------------------------
  // Friends and mutuals only: this is the social surface, not a public list
  // of every account's status. Games are announced on an ephemeral
  // per-channel channel, so voice + music + custom status are the durable
  // signals we can read from another account.
  const now = Date.now();
  const vibing: LivePerson[] = [];
  for (const row of presenceById.values()) {
    if (row.user_id === viewerId) continue;
    if (blocked.has(row.user_id)) continue;
    if (!friends.has(row.user_id)) continue;
    const status = publicStatusOf(row, false);
    if (status === "offline" || status === "invisible") continue;

    const voicePerson = voicePeopleById.get(row.user_id);
    const activityLine = voicePerson?.activityLine ?? null;
    const custom = publicCustomStatus(row, false);
    if (!custom && !activityLine) continue;

    const seen = row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
    if (!voicePerson && now - seen > PRESENT_WINDOW_MS) continue;

    vibing.push(toPerson(row.profile, row.user_id, row, true, activityLine));
  }
  vibing.sort(byFriendThenNewest);

  const voicePeople = new Set(
    voiceGroups.flatMap((group) => group.people.map((person) => person.id)),
  );
  const everyone = new Set<string>([...streams.map((stream) => stream.host.id), ...voicePeople]);

  return {
    streams,
    voiceGroups,
    parties: [],
    vibing,
    counts: {
      live: streams.length,
      voice: voicePeople.size,
      party: 0,
      people: everyone.size,
      vibing: vibing.length,
    },
  };
}

/**
 * The chip reads with `open: false` (30s poll, no realtime). The sheet reads
 * with `open: true`, which adds one realtime channel for every source and
 * cleans it up when the sheet closes. Both share one cache entry.
 */
export function useLiveAndVibing({ open = false }: { open?: boolean } = {}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ?? null;
  // Each hook instance gets its own topic, so a close/reopen race cannot grab
  // an already-subscribed channel that the previous effect is removing.
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, "");

  const query = useQuery({
    queryKey: liveAndVibingKey(userId),
    queryFn: () => fetchLiveAndVibing(userId as string),
    enabled: !!userId,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const onPrefs = () => {
      void qc.invalidateQueries({ queryKey: liveAndVibingKey(userId) });
    };
    window.addEventListener(PREFS_EVENT, onPrefs);
    return () => window.removeEventListener(PREFS_EVENT, onPrefs);
  }, [qc, userId]);

  useEffect(() => {
    if (!open || !userId) return;
    let timer: number | null = null;
    const schedule = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        void qc.invalidateQueries({ queryKey: liveAndVibingKey(userId) });
      }, 1_000);
    };

    const channel = supabase
      .channel(`live-and-vibing-${userId}-${instanceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "voice_rooms" }, schedule)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "voice_participants" },
        schedule,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "user_presence" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "music_queue" }, schedule);
    subscribeSafely(channel);

    return () => {
      if (timer) window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [open, userId, qc, instanceId]);

  return {
    data: query.data ?? EMPTY_LIVE_AND_VIBING,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
