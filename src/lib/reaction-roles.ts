import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { realmRpc, unwrapRpc, type RpcOutcome } from "@/lib/realm-rpc";

/**
 * Reaction roles: reacting with the chosen emoji grants the role, and
 * un-reacting takes exactly that role back — never from the owner, never from
 * someone who already holds a higher one. The rules live in the
 * `apply_reaction_roles` trigger; this module configures them and reads them.
 */

export type ReactionRole = {
  id: string;
  realm_id: string;
  message_id: string;
  emoji: string;
  role: "mod" | "member";
  created_by: string | null;
  created_at: string;
};

export const reactionRolesKey = (realmId: string | null | undefined) => ["realm-reaction-roles", realmId ?? ""] as const;

export async function fetchReactionRoles(realmId: string): Promise<ReactionRole[]> {
  const { data, error } = await (supabase.from as any)("realm_reaction_roles")
    .select("*")
    .eq("realm_id", realmId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ReactionRole[];
}

export function useReactionRoles(realmId: string | null | undefined, enabled = true) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: reactionRolesKey(realmId),
    enabled: enabled && !!realmId,
    staleTime: 30_000,
    queryFn: () => fetchReactionRoles(realmId!),
  });

  useEffect(() => {
    if (!realmId || !enabled) return;
    const channel = supabase
      .channel(`realm-reaction-roles-${realmId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "realm_reaction_roles", filter: `realm_id=eq.${realmId}` },
        () => void qc.invalidateQueries({ queryKey: reactionRolesKey(realmId) }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [realmId, enabled, qc]);

  return query;
}

export async function setReactionRole(input: {
  messageId: string;
  emoji: string;
  role: "mod" | "member";
}): Promise<void> {
  unwrapRpc(
    await realmRpc<RpcOutcome>("set_realm_reaction_role", {
      _message_id: input.messageId,
      _emoji: input.emoji,
      _role: input.role,
    }),
    "Couldn't set that reaction role",
  );
}

export async function deleteReactionRole(id: string): Promise<void> {
  unwrapRpc(
    await realmRpc<RpcOutcome>("delete_realm_reaction_role", { _id: id }),
    "Couldn't remove that reaction role",
  );
}

/** Roles configured on one message (for the message's own dialog). */
export function rolesForMessage(roles: ReactionRole[], messageId: string): ReactionRole[] {
  return roles.filter((role) => role.message_id === messageId);
}
