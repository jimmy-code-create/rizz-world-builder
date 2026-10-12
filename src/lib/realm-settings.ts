import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Realm settings and moderation.
 *
 * Every call below is a SECURITY DEFINER RPC that re-checks the caller's role and
 * permission server-side, so this module is a typed client and never a gate.
 * Role settings, reports and the audit log also arrive over realtime, so two
 * moderators working in the same realm see each other's changes.
 */

export type RealmPermission =
  | "manage_realm"
  | "manage_roles"
  | "manage_channels"
  | "manage_members"
  | "manage_bots"
  | "moderate_messages"
  | "manage_automod"
  | "view_audit"
  | "pin_messages"
  | "bypass_slowmode"
  | "bypass_link_filter"
  | "view_private_channels";

export const PERMISSION_LABELS: { key: RealmPermission; label: string; hint: string }[] = [
  { key: "manage_realm", label: "Manage realm", hint: "Rename it, change its icon and description" },
  { key: "manage_roles", label: "Manage roles", hint: "Edit role colours and permissions" },
  { key: "manage_channels", label: "Manage channels", hint: "Create, rename, reorder and lock channels" },
  { key: "manage_members", label: "Manage members", hint: "Kick, ban, time out and warn" },
  { key: "manage_bots", label: "Manage bots", hint: "Install, enable and remove bots" },
  { key: "moderate_messages", label: "Moderate messages", hint: "Delete messages and work the reports queue" },
  { key: "manage_automod", label: "Manage AutoMod", hint: "Filters, raid mode and verification level" },
  { key: "view_audit", label: "View audit log", hint: "Read the moderation history" },
  { key: "pin_messages", label: "Pin messages", hint: "Pin and unpin in any channel" },
  { key: "bypass_slowmode", label: "Bypass slowmode", hint: "Post freely in slow channels" },
  { key: "bypass_link_filter", label: "Bypass link filter", hint: "Post links even when they are filtered" },
  { key: "view_private_channels", label: "View private channels", hint: "See and post in private channels" },
];

export type RealmRoleSetting = {
  role: "mod" | "member";
  color: string | null;
  permissions: string[];
};

export type RealmAutomod = {
  banned_words: string[];
  block_links: boolean;
  mention_limit: number;
  raid_mode: boolean;
  min_account_age_days: number;
};

export type RealmSettingsPayload = {
  ok: boolean;
  error?: string;
  realm: {
    id: string;
    slug: string;
    name: string;
    topic: string | null;
    icon_url: string | null;
    accent_color: string | null;
    owner_id: string;
    member_count: number;
    mod_log_room_id: string | null;
    verification_level: number;
    warn_threshold: number;
    warn_timeout_minutes: number;
  };
  my_role: "owner" | "mod" | "member" | null;
  permissions: RealmPermission[];
  roles: RealmRoleSetting[];
  automod: RealmAutomod;
  counts: { open_reports: number; bans: number; invites: number; installed_bots: number };
};

export type RealmBan = {
  user_id: string;
  reason: string | null;
  created_at: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type RealmInviteRow = {
  id: string;
  code: string;
  expires_at: string | null;
  max_uses: number | null;
  uses: number;
  is_active: boolean;
  created_at: string;
};

export type RealmReport = {
  id: string;
  status: string;
  reason: string | null;
  created_at: string;
  message_id: string | null;
  body: string | null;
  deleted: boolean;
  reporter: string | null;
  author_id: string | null;
  author: string | null;
};

export type RealmAuditEntry = {
  id: string;
  action: string;
  detail: string | null;
  created_at: string;
  actor: string | null;
  target: string | null;
};

export type RealmMemberStatus = {
  user_id: string;
  warn_points: number;
  timeout_until: string | null;
};

/** RPCs answer `{ ok, error }`; this turns a refusal into a sentence. */
function unwrap(data: unknown, fallback: string): Record<string, unknown> {
  const payload = (data ?? {}) as Record<string, unknown>;
  if (payload.ok === false) {
    throw new Error(typeof payload.error === "string" ? payload.error : fallback);
  }
  return payload;
}

async function call(name: string, args: Record<string, unknown>, fallback: string) {
  const { data, error } = await (supabase.rpc as any)(name, args);
  if (error) throw new Error(error.message || fallback);
  return unwrap(data, fallback);
}

export const realmSettingsKey = (realmId: string | null | undefined) =>
  ["realm-settings", realmId ?? ""] as const;
export const realmBansKey = (realmId: string | null | undefined) => ["realm-bans", realmId ?? ""] as const;
export const realmInvitesKey = (realmId: string | null | undefined) => ["realm-invites", realmId ?? ""] as const;
export const realmReportsKey = (realmId: string | null | undefined) => ["realm-reports", realmId ?? ""] as const;
export const realmAuditKey = (realmId: string | null | undefined) => ["realm-audit", realmId ?? ""] as const;
export const realmMemberStatusKey = (realmId: string | null | undefined) =>
  ["realm-member-status", realmId ?? ""] as const;

// --------------------------------------------------------------- reads
export async function fetchRealmSettings(realmId: string): Promise<RealmSettingsPayload> {
  const payload = await call("realm_settings", { _realm_id: realmId }, "Couldn't load these settings");
  return payload as unknown as RealmSettingsPayload;
}

export async function fetchRealmBans(realmId: string): Promise<RealmBan[]> {
  const { data, error } = await (supabase.rpc as any)("list_realm_bans", { _realm_id: realmId });
  if (error) throw new Error(error.message);
  return (data ?? []) as RealmBan[];
}

export async function fetchRealmInvites(realmId: string): Promise<RealmInviteRow[]> {
  const { data, error } = await (supabase.rpc as any)("list_realm_invites", { _realm_id: realmId });
  if (error) throw new Error(error.message);
  return (data ?? []) as RealmInviteRow[];
}

export async function fetchRealmReports(realmId: string): Promise<RealmReport[]> {
  const { data, error } = await (supabase.rpc as any)("list_realm_reports", { _realm_id: realmId });
  if (error) throw new Error(error.message);
  return (data ?? []) as RealmReport[];
}

export async function fetchRealmAudit(realmId: string, limit = 100): Promise<RealmAuditEntry[]> {
  const { data, error } = await (supabase.rpc as any)("realm_audit_log", {
    _realm_id: realmId,
    _limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as RealmAuditEntry[];
}

export async function fetchRealmMemberStatus(realmId: string): Promise<RealmMemberStatus[]> {
  const { data, error } = await (supabase.rpc as any)("realm_member_status", { _realm_id: realmId });
  if (error) throw new Error(error.message);
  return (data ?? []) as RealmMemberStatus[];
}

/**
 * The settings page is live: role changes, new reports and audit entries land
 * without a refresh.
 */
export function useRealmSettings(realmId: string | null | undefined, enabled = true) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: realmSettingsKey(realmId),
    enabled: enabled && !!realmId,
    queryFn: () => fetchRealmSettings(realmId!),
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!realmId) return;
    const channel = supabase
      .channel(`realm-settings-${realmId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "realm_reports", filter: `realm_id=eq.${realmId}` },
        () => {
          void qc.invalidateQueries({ queryKey: realmReportsKey(realmId) });
          void qc.invalidateQueries({ queryKey: realmSettingsKey(realmId) });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "realm_role_settings", filter: `realm_id=eq.${realmId}` },
        () => { void qc.invalidateQueries({ queryKey: realmSettingsKey(realmId) }); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "realm_audit_log", filter: `realm_id=eq.${realmId}` },
        () => { void qc.invalidateQueries({ queryKey: realmAuditKey(realmId) }); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [realmId, qc]);

  return query;
}

export function realmCan(settings: RealmSettingsPayload | undefined, permission: RealmPermission): boolean {
  return !!settings?.permissions?.includes(permission);
}

// --------------------------------------------------------------- writes
export async function updateRealmOverview(input: {
  realmId: string;
  name: string;
  topic: string;
  iconUrl: string;
  accentColor: string;
}) {
  await call(
    "update_realm_overview",
    {
      _realm_id: input.realmId,
      _name: input.name,
      _topic: input.topic || null,
      _icon_url: input.iconUrl || null,
      _accent_color: input.accentColor || null,
    },
    "Couldn't save the realm details",
  );
}

export async function setRealmRoleSettings(input: {
  realmId: string;
  role: "mod" | "member";
  color?: string | null;
  permissions: string[];
}) {
  await call(
    "set_realm_role_settings",
    {
      _realm_id: input.realmId,
      _role: input.role,
      _color: input.color ?? null,
      _permissions: input.permissions,
    },
    "Couldn't save that role",
  );
}

export async function setRealmAutomod(input: {
  realmId: string;
  bannedWords: string[];
  blockLinks: boolean;
  mentionLimit: number;
  raidMode: boolean;
  minAccountAgeDays: number;
  verificationLevel: number;
  modLogRoomId: string | null;
  warnThreshold: number;
  warnTimeoutMinutes: number;
}) {
  await call(
    "set_realm_automod",
    {
      _realm_id: input.realmId,
      _banned_words: input.bannedWords,
      _block_links: input.blockLinks,
      _mention_limit: input.mentionLimit,
      _raid_mode: input.raidMode,
      _min_account_age_days: input.minAccountAgeDays,
      _verification_level: input.verificationLevel,
      _mod_log_room_id: input.modLogRoomId,
      _warn_threshold: input.warnThreshold,
      _warn_timeout_minutes: input.warnTimeoutMinutes,
    },
    "Couldn't save AutoMod",
  );
}

export async function updateRealmRoomSettings(input: {
  roomId: string;
  name: string;
  topic: string;
  slowmodeSeconds: number;
  isPrivate: boolean;
}) {
  await call(
    "update_realm_room_settings",
    {
      _room_id: input.roomId,
      _name: input.name,
      _topic: input.topic || null,
      _slowmode_seconds: input.slowmodeSeconds,
      _is_private: input.isPrivate,
    },
    "Couldn't save that channel",
  );
}

export async function reorderRealmRooms(realmId: string, roomIds: string[]) {
  await call("reorder_realm_rooms", { _realm_id: realmId, _room_ids: roomIds }, "Couldn't reorder channels");
}

export async function warnRealmMember(input: {
  realmId: string;
  userId: string;
  reason: string;
  points?: number;
}): Promise<{ message?: string; timed_out?: boolean }> {
  const payload = await call(
    "warn_realm_member",
    {
      _realm_id: input.realmId,
      _user_id: input.userId,
      _reason: input.reason || null,
      _points: input.points ?? 1,
    },
    "Couldn't warn that member",
  );
  return { message: payload.message as string | undefined, timed_out: payload.timed_out as boolean | undefined };
}

export async function clearRealmWarns(realmId: string, userId: string) {
  await call("clear_realm_warns", { _realm_id: realmId, _user_id: userId }, "Couldn't clear those warns");
}

export async function timeoutRealmMember(realmId: string, userId: string, minutes: number, reason?: string) {
  await call(
    "timeout_realm_member",
    { _realm_id: realmId, _user_id: userId, _minutes: minutes, _reason: reason ?? null },
    "Couldn't time that member out",
  );
}

export async function reportRealmMessage(messageId: string, reason?: string) {
  await call(
    "report_realm_message",
    { _message_id: messageId, _reason: reason ?? null },
    "Couldn't send that report",
  );
}

export async function moderateDeleteMessage(messageId: string, reason?: string) {
  await call(
    "moderate_delete_message",
    { _message_id: messageId, _reason: reason ?? null },
    "Couldn't remove that message",
  );
}

export async function resolveRealmReport(reportId: string, resolution: "actioned" | "dismissed") {
  await call(
    "resolve_realm_report",
    { _report_id: reportId, _resolution: resolution },
    "Couldn't close that report",
  );
}

export async function transferRealmOwnership(realmId: string, userId: string) {
  await call(
    "transfer_realm_ownership",
    { _realm_id: realmId, _user_id: userId },
    "Couldn't transfer this realm",
  );
}

export async function revokeRealmInviteById(inviteId: string) {
  const { error } = await supabase.rpc("revoke_realm_invite", { _invite_id: inviteId });
  if (error) throw new Error(error.message);
}

export function inviteState(invite: RealmInviteRow): { label: string; tone: "live" | "used" | "expired" } {
  if (!invite.is_active) return { label: "Revoked", tone: "expired" };
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
    return { label: "Expired", tone: "expired" };
  }
  if (invite.max_uses != null && invite.uses >= invite.max_uses) return { label: "Used up", tone: "used" };
  return { label: "Active", tone: "live" };
}
