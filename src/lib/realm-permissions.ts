import { useEffect, useId } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subscribeSafely } from "@/lib/realtime";
import { normalizeRealmRole, type RealmRole } from "@/lib/realm-roles";
import { useAuth } from "@/lib/auth";

/**
 * Per-member, per-channel write permission ("who may type here").
 *
 * Allowed is the default, so only denials are stored: a missing row means the
 * member can write. The database enforces the same rule on insert, so this
 * module is for the moderation UI and the composer hint, not for security.
 */
export type ChannelPermission = {
  id: string;
  realm_id: string;
  realm_room_id: string | null;
  user_id: string;
  can_write: boolean;
  updated_at: string;
};

/**
 * A channel is keyed by its room id, or by the realm id for the realm's own
 * channel (which has no room row) — matching how messages, pins and the
 * database function scope it.
 */
export function channelKey(realmId: string | null | undefined, roomId: string | null | undefined) {
  return roomId ?? realmId ?? "";
}

export function permissionChannelKey(row: Pick<ChannelPermission, "realm_id" | "realm_room_id">) {
  return row.realm_room_id ?? row.realm_id;
}

const permissionsTable = () =>
  (supabase as unknown as { from: (table: string) => any }).from("realm_channel_permissions");

export function channelPermissionsKey(realmId: string | null | undefined) {
  return ["realm-channel-permissions", realmId ?? ""] as const;
}

/**
 * Why the moderation screen could not load, in the user's words.
 *
 * The permissions table only exists once the migration has been applied, and
 * Postgres reports that as PGRST205/42P01. Saying so beats an empty sheet that
 * looks like a dead tap.
 */
export function describePermissionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/does not exist|schema cache|PGRST205|42P01/i.test(message)) {
    return "Channel permissions aren't set up on this server yet. Apply the latest Supabase migration, then tap Retry.";
  }
  if (/permission denied|JWT|401|403/i.test(message)) {
    return "You don't have access to this realm's channel permissions.";
  }
  return message.trim() || "Couldn't load channel permissions.";
}

// --------------------------------------------------------------- my own role
export function myRealmRoleKey(realmId: string | null | undefined) {
  return ["realm-role", realmId ?? ""] as const;
}

/**
 * The signed-in user's role in a realm, straight from the database.
 *
 * This is deliberately independent of the realm member list: that list only
 * loads while the Moderation sheet is open, which is exactly why the owner saw
 * the permission switches as read-only. Failure returns null instead of
 * throwing — ownership is still known from `realms.owner_id`.
 */
export function useMyRealmRole(realmId: string | null | undefined) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: myRealmRoleKey(realmId),
    enabled: !!realmId && !!user?.id,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<RealmRole | null> => {
      const { data, error } = await (supabase.rpc as any)("realm_role_of", {
        _realm: realmId,
        _user: user?.id,
      });
      if (error) throw error;
      return normalizeRealmRole(data);
    },
  });

  return {
    role: query.data ? normalizeRealmRole(query.data) : null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// -------------------------------------------------- "who can add reactions"
export type ReactionsMode = "everyone" | "mods";

export function reactionsModeKey(realmId: string | null | undefined) {
  return ["realm-reactions-mode", realmId ?? ""] as const;
}

/**
 * Turns reactions on for everybody or limits them to mods in one channel.
 * Enforced in the database by toggle_message_reaction().
 */
export async function setChannelReactionsMode(input: {
  realmId: string;
  roomId: string | null;
  mode: ReactionsMode;
}) {
  const { error } = await (supabase.rpc as any)("set_channel_reactions_mode", {
    _realm_id: input.realmId,
    _room_id: input.roomId,
    _mode: input.mode,
  });
  if (error) throw new Error(error.message || "Couldn't change who can react here");
}

export async function fetchChannelPermissions(realmId: string): Promise<ChannelPermission[]> {
  const { data, error } = await permissionsTable().select("*").eq("realm_id", realmId);
  if (error) throw error;
  return (data ?? []) as ChannelPermission[];
}

/**
 * Every denial in a realm, kept fresh over realtime so mods and members agree.
 *
 * Every consumer gets its OWN realtime topic. The realm page watches who may
 * write where (for the composer hint) and the Channels & permissions sheet
 * watches the same thing while it is open; a shared topic made the second
 * subscriber call `subscribe()` on the already-joined channel, which throws
 * inside an effect, and React escalated it to the route error boundary — the
 * page became "This page didn't load" the moment the sheet was opened.
 */
export function useChannelPermissions(realmId: string | null | undefined) {
  const qc = useQueryClient();
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const query = useQuery({
    queryKey: channelPermissionsKey(realmId),
    enabled: !!realmId,
    staleTime: 30_000,
    retry: false,
    queryFn: () => fetchChannelPermissions(realmId as string),
  });

  useEffect(() => {
    if (!realmId) return;
    const channel = supabase
      .channel(`realm-channel-permissions-${realmId}-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "realm_channel_permissions", filter: `realm_id=eq.${realmId}` },
        () => { void qc.invalidateQueries({ queryKey: ["realm-channel-permissions"] }); },
      );
    subscribeSafely(channel);
    return () => { void supabase.removeChannel(channel); };
  }, [realmId, qc, instanceId]);

  return {
    permissions: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Channel keys this member is blocked from writing in. */
export function deniedChannelsOf(
  permissions: ChannelPermission[],
  realmId: string | null | undefined,
  userId: string | null | undefined,
) {
  const denied = new Set<string>();
  if (!realmId || !userId) return denied;
  permissions.forEach((row) => {
    if (row.user_id === userId && row.realm_id === realmId && !row.can_write) {
      denied.add(permissionChannelKey(row));
    }
  });
  return denied;
}

/** True when nobody in this channel has been blocked (the common case). */
export function channelHasNoDenials(
  permissions: ChannelPermission[],
  realmId: string | null | undefined,
  roomId: string | null | undefined,
) {
  const key = channelKey(realmId, roomId);
  return !permissions.some((row) => !row.can_write && permissionChannelKey(row) === key);
}

/**
 * Allows or blocks one member's writing in one channel. Owners and moderators
 * only; the server re-checks and throws a readable message otherwise.
 */
export async function setChannelWritePermission(input: {
  realmId: string;
  roomId: string | null;
  userId: string;
  canWrite: boolean;
}) {
  const { error } = await (supabase.rpc as any)("set_channel_write_permission", {
    _realm_id: input.realmId,
    _room_id: input.roomId,
    _user_id: input.userId,
    _can_write: input.canWrite,
  });
  if (error) throw new Error(error.message || "Couldn't change that channel permission");
}
