import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export async function fetchChannelPermissions(realmId: string): Promise<ChannelPermission[]> {
  const { data, error } = await permissionsTable().select("*").eq("realm_id", realmId);
  if (error) throw error;
  return (data ?? []) as ChannelPermission[];
}

/** Every denial in a realm, kept fresh over realtime so mods and members agree. */
export function useChannelPermissions(realmId: string | null | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: channelPermissionsKey(realmId),
    enabled: !!realmId,
    staleTime: 30_000,
    queryFn: () => fetchChannelPermissions(realmId as string),
  });

  useEffect(() => {
    if (!realmId) return;
    const channel = supabase
      .channel(`realm-channel-permissions-${realmId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "realm_channel_permissions", filter: `realm_id=eq.${realmId}` },
        () => { void qc.invalidateQueries({ queryKey: ["realm-channel-permissions"] }); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [realmId, qc]);

  return { permissions: query.data ?? [], isLoading: query.isLoading, refetch: query.refetch };
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
