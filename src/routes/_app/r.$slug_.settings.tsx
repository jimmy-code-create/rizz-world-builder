import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Bot as BotIcon, Crown, Flag,
  Gauge, Hash, ListOrdered, Lock, MessageSquareWarning, ScrollText, Search, Shield, ShieldCheck,
  Sparkles, Trash2, UserMinus, UserX, X,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RealmBotsSheet } from "@/components/bots/RealmBotsSheet";
import { ChannelPermissionsSheet } from "@/components/realms/ChannelPermissionsSheet";
import {
  banRealmMember, createRealmInvite, createRealmRoom, deleteRealm, fetchRealmBySlug, fetchRealmRooms,
  kickRealmMember, listRealmMembers, setRealmMemberRole, unbanRealmMember, type RealmRoom,
} from "@/lib/realms";
import {
  PERMISSION_LABELS, clearRealmWarns, fetchRealmAudit, fetchRealmBans, fetchRealmInvites,
  fetchRealmMemberStatus, fetchRealmReports, inviteState, realmAuditKey, realmBansKey, realmCan,
  realmInvitesKey, realmMemberStatusKey, realmReportsKey, realmSettingsKey, moderateDeleteMessage,
  reorderRealmRooms, resolveRealmReport, revokeRealmInviteById, setRealmAutomod,
  setRealmRoleSettings, timeoutRealmMember, transferRealmOwnership, updateRealmOverview,
  updateRealmRoomSettings, useRealmSettings, warnRealmMember, type RealmMemberStatus,
  type RealmPermission,
} from "@/lib/realm-settings";
import { useAuth } from "@/lib/auth";

/**
 * /r/$slug/settings — the full realm settings page.
 *
 * Phones get a scrolling list of sections, wide screens a sticky sidebar. Every
 * control calls a SECURITY DEFINER RPC that re-checks the caller, and the page
 * simply greys out what the server would refuse.
 */
export const Route = createFileRoute("/_app/r/$slug_/settings")({
  head: ({ params }) => ({ meta: [{ title: `Settings · ${params.slug} · RIZZ` }] }),
  component: RealmSettingsPage,
});

const SECTIONS = [
  { key: "overview", label: "Overview", icon: Sparkles },
  { key: "roles", label: "Roles & permissions", icon: ShieldCheck },
  { key: "members", label: "Members", icon: Shield },
  { key: "channels", label: "Channels", icon: Hash },
  { key: "automod", label: "Moderation", icon: Gauge },
  { key: "reports", label: "Reports", icon: Flag },
  { key: "bans", label: "Bans", icon: UserX },
  { key: "invites", label: "Invites", icon: ListOrdered },
  { key: "bots", label: "Bots & integrations", icon: BotIcon },
  { key: "audit", label: "Audit log", icon: ScrollText },
  { key: "danger", label: "Danger zone", icon: AlertTriangle },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

function RealmSettingsPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [section, setSection] = useState<SectionKey>("overview");

  const realm = useQuery({ queryKey: ["realm", slug], queryFn: () => fetchRealmBySlug(slug) });
  const realmId = realm.data?.id ?? null;
  const settings = useRealmSettings(realmId);
  const can = (permission: RealmPermission) => realmCan(settings.data, permission);

  if (realm.isLoading) return <div className="mx-auto mt-6 h-64 w-full max-w-5xl animate-pulse rounded-3xl glass" />;
  if (!realm.data) {
    return (
      <div className="mx-auto mt-16 max-w-md text-center">
        <h1 className="font-display text-2xl font-bold">Realm not found</h1>
        <Button asChild className="mt-4 h-11 border-0 bg-gradient-primary text-primary-foreground">
          <Link to="/realms">Browse realms</Link>
        </Button>
      </div>
    );
  }

  const payload = settings.data;
  const myRole = payload?.my_role ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-4 sm:px-6">
      <div className="mb-4 flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-muted-foreground">
          <Link to="/r/$slug" params={{ slug }} aria-label="Back to the realm">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-bold tracking-tight">{realm.data.name}</h1>
          <p className="text-xs capitalize text-muted-foreground">
            Realm settings · you are {myRole ?? "a member"}
          </p>
        </div>
      </div>

      {settings.isError && (
        <div role="alert" className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
          <p className="font-semibold">Couldn&apos;t load these settings</p>
          <p className="mt-1 text-amber-100/85">
            {(settings.error instanceof Error && settings.error.message) || "Try again in a moment."}
          </p>
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[15rem_1fr] lg:gap-6">
        {/* Phone: a scrollable rail. Desktop: a sticky sidebar. */}
        <nav
          aria-label="Settings sections"
          className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:mb-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 lg:pb-0"
        >
          <div className="flex gap-2 lg:sticky lg:top-4 lg:flex-col">
            {SECTIONS.map((entry) => {
              const Icon = entry.icon;
              const active = section === entry.key;
              const badge =
                entry.key === "reports" && payload?.counts.open_reports
                  ? payload.counts.open_reports
                  : entry.key === "bans" && payload?.counts.bans
                    ? payload.counts.bans
                    : null;
              return (
                <button
                  key={entry.key}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => setSection(entry.key)}
                  className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors lg:w-full ${
                    active
                      ? "bg-[var(--rizz-pink)]/15 text-foreground ring-1 ring-[var(--rizz-pink)]/40"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span className="whitespace-nowrap lg:whitespace-normal">{entry.label}</span>
                  {badge ? (
                    <span className="ml-auto rounded-full bg-[var(--rizz-pink)]/25 px-1.5 text-[10px] font-bold text-foreground">
                      {badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </nav>

        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="min-w-0">
          {!payload ? (
            <div className="h-40 animate-pulse rounded-3xl glass" />
          ) : section === "overview" ? (
            <OverviewSection realmId={payload.realm.id} realm={payload.realm} canManage={can("manage_realm")} />
          ) : section === "roles" ? (
            <RolesSection realmId={payload.realm.id} roles={payload.roles} canManage={can("manage_roles")} />
          ) : section === "members" ? (
            <MembersSection realmId={payload.realm.id} ownerId={payload.realm.owner_id} canManage={can("manage_members")} />
          ) : section === "channels" ? (
            <ChannelsSection realmId={payload.realm.id} canManage={can("manage_channels")} />
          ) : section === "automod" ? (
            <AutomodSection realmId={payload.realm.id} payload={payload} canManage={can("manage_automod")} />
          ) : section === "reports" ? (
            <ReportsSection realmId={payload.realm.id} canModerate={can("moderate_messages")} />
          ) : section === "bans" ? (
            <BansSection realmId={payload.realm.id} canManage={can("moderate_messages")} />
          ) : section === "invites" ? (
            <InvitesSection realmId={payload.realm.id} canManage={can("manage_members")} />
          ) : section === "bots" ? (
            <BotsSection realmId={payload.realm.id} realmName={payload.realm.name} installed={payload.counts.installed_bots} />
          ) : section === "audit" ? (
            <AuditSection realmId={payload.realm.id} canView={can("view_audit")} />
          ) : (
            <DangerSection
              realmId={payload.realm.id}
              realmName={payload.realm.name}
              isOwner={payload.realm.owner_id === user?.id}
              onDeleted={() => {
                void qc.invalidateQueries({ queryKey: ["realms"] });
                nav({ to: "/realms" });
              }}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- shells

function Panel({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 glass p-4 sm:p-5">
      <header className="mb-4 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} disabled={disabled} aria-label={label} onCheckedChange={onChange} />
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">{children}</p>
  );
}

function useInvalidate(realmId: string) {
  const qc = useQueryClient();
  return async (...keys: readonly (readonly unknown[])[]) => {
    for (const key of keys) await qc.invalidateQueries({ queryKey: key as unknown[] });
    await qc.invalidateQueries({ queryKey: realmSettingsKey(realmId) });
  };
}

// ---------------------------------------------------------------- overview

function OverviewSection({
  realmId,
  realm,
  canManage,
}: {
  realmId: string;
  realm: { name: string; topic: string | null; icon_url: string | null; accent_color: string | null };
  canManage: boolean;
}) {
  const invalidate = useInvalidate(realmId);
  const qc = useQueryClient();
  const [name, setName] = useState(realm.name);
  const [topic, setTopic] = useState(realm.topic ?? "");
  const [iconUrl, setIconUrl] = useState(realm.icon_url ?? "");
  const [accent, setAccent] = useState(realm.accent_color ?? "#ff2d92");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await updateRealmOverview({ realmId, name, topic, iconUrl, accentColor: accent });
      await invalidate(["realms"], ["realm"]);
      await qc.invalidateQueries({ queryKey: ["realm"] });
      toast.success("Realm updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save that");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Overview" description="The name, icon and description everyone sees.">
      <div className="space-y-3">
        <Field label="Realm name">
          <Input value={name} maxLength={40} disabled={!canManage} onChange={(e) => setName(e.target.value)} className="glass border-white/10" />
        </Field>
        <Field label="Description">
          <Textarea value={topic} maxLength={160} rows={3} disabled={!canManage} onChange={(e) => setTopic(e.target.value)} className="glass border-white/10" placeholder="What is this realm about?" />
        </Field>
        <Field label="Icon URL" hint="https:// link to an image">
          <Input value={iconUrl} disabled={!canManage} onChange={(e) => setIconUrl(e.target.value)} className="glass border-white/10" placeholder="https://…" />
        </Field>
        <Field label="Accent colour">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={accent}
              disabled={!canManage}
              aria-label="Accent colour"
              onChange={(e) => setAccent(e.target.value)}
              className="h-11 w-14 cursor-pointer rounded-xl border border-white/10 bg-transparent"
            />
            <Input value={accent} disabled={!canManage} onChange={(e) => setAccent(e.target.value)} className="glass border-white/10 font-mono" />
          </div>
        </Field>
        <Button
          type="button"
          disabled={!canManage || busy}
          onClick={() => void save()}
          className="h-11 w-full border-0 bg-gradient-primary text-primary-foreground"
        >
          {busy ? "Saving…" : canManage ? "Save changes" : "Only the owner can edit this"}
        </Button>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------- roles

function RolesSection({
  realmId,
  roles,
  canManage,
}: {
  realmId: string;
  roles: { role: "mod" | "member"; color: string | null; permissions: string[] }[];
  canManage: boolean;
}) {
  const invalidate = useInvalidate(realmId);
  const rooms = useQuery({ queryKey: ["realm-rooms", realmId], queryFn: () => fetchRealmRooms(realmId) });
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, { color: string; permissions: string[] }>>(() =>
    Object.fromEntries(
      roles.map((entry) => [
        entry.role,
        { color: entry.color ?? "", permissions: entry.permissions ?? [] },
      ]),
    ),
  );
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = (role: string, permission: string, next: boolean) => {
    setDraft((current) => {
      const entry = current[role] ?? { color: "", permissions: [] };
      return {
        ...current,
        [role]: {
          ...entry,
          permissions: next
            ? [...new Set([...entry.permissions, permission])]
            : entry.permissions.filter((p) => p !== permission),
        },
      };
    });
  };

  const save = async (role: "mod" | "member") => {
    setBusy(role);
    try {
      await setRealmRoleSettings({
        realmId,
        role,
        color: draft[role]?.color ?? null,
        permissions: draft[role]?.permissions ?? [],
      });
      await invalidate([]);
      toast.success(`${role === "mod" ? "Moderator" : "Member"} role saved`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save that role");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Roles & permissions"
        description="Owner always has everything. These switches decide what moderators and members may do."
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 shrink-0 border-white/10 bg-white/5"
            onClick={() => setPermissionsOpen(true)}
          >
            <Lock className="h-4 w-4" /> Per-channel
          </Button>
        }
      >
        <div className="space-y-4">
          {(["mod", "member"] as const).map((role) => (
            <div key={role} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="mb-3 flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="grid h-9 w-9 place-items-center rounded-xl text-xs font-bold"
                  style={{ background: `${draft[role]?.color || "#ff2d92"}33`, color: draft[role]?.color || undefined }}
                >
                  {role === "mod" ? <ShieldCheck className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold capitalize">{role === "mod" ? "Moderator" : "Member"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {draft[role]?.permissions.length ?? 0} permission(s)
                  </p>
                </div>
                <input
                  type="color"
                  value={draft[role]?.color || "#ff2d92"}
                  disabled={!canManage}
                  aria-label={`${role} colour`}
                  onChange={(e) =>
                    setDraft((current) => ({ ...current, [role]: { ...current[role], color: e.target.value } }))
                  }
                  className="h-10 w-12 cursor-pointer rounded-xl border border-white/10 bg-transparent"
                />
              </div>

              <div className="space-y-1.5">
                {PERMISSION_LABELS.map((permission) => (
                  <label
                    key={permission.key}
                    className="flex min-h-11 items-center gap-3 rounded-xl px-2 transition-colors hover:bg-white/5"
                  >
                    <input
                      type="checkbox"
                      checked={draft[role]?.permissions.includes(permission.key) ?? false}
                      disabled={!canManage || busy === role}
                      onChange={(e) => toggle(role, permission.key, e.target.checked)}
                      className="h-4 w-4 accent-[var(--rizz-pink)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">{permission.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{permission.hint}</span>
                    </span>
                  </label>
                ))}
              </div>

              <Button
                type="button"
                disabled={!canManage || busy === role}
                onClick={() => void save(role)}
                className="mt-3 h-11 w-full border-0 bg-gradient-primary text-primary-foreground"
              >
                {busy === role ? "Saving…" : `Save ${role === "mod" ? "moderator" : "member"} role`}
              </Button>
            </div>
          ))}
        </div>
      </Panel>

      <ChannelPermissionsSheet
        open={permissionsOpen}
        onOpenChange={setPermissionsOpen}
        realmId={realmId}
        realmName="this realm"
        rooms={(rooms.data ?? []) as RealmRoom[]}
        canModerate={canManage}
        realmReactionsMode="everyone"
      />
    </div>
  );
}

// ---------------------------------------------------------------- members

function MembersSection({
  realmId,
  ownerId,
  canManage,
}: {
  realmId: string;
  ownerId: string;
  canManage: boolean;
}) {
  const invalidate = useInvalidate(realmId);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<{ id: string; name: string } | null>(null);

  const members = useQuery({
    queryKey: ["realm-members", realmId],
    queryFn: () => listRealmMembers(realmId),
  });
  const status = useQuery({
    queryKey: realmMemberStatusKey(realmId),
    queryFn: () => fetchRealmMemberStatus(realmId),
    enabled: canManage,
  });

  const statusById = useMemo(() => {
    const map = new Map<string, RealmMemberStatus>();
    for (const row of status.data ?? []) map.set(row.user_id, row);
    return map;
  }, [status.data]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = members.data ?? [];
    if (!needle) return list;
    return list.filter((member) =>
      `${member.profile?.display_name ?? ""} ${member.profile?.username ?? ""}`.toLowerCase().includes(needle),
    );
  }, [members.data, search]);

  const run = async (key: string, action: () => Promise<void>, success: string) => {
    setBusy(key);
    try {
      await action();
      await invalidate(["realm-members", realmId], realmMemberStatusKey(realmId), realmAuditKey(realmId), realmBansKey(realmId));
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That didn't work");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel
      title="Members"
      description={`${members.data?.length ?? 0} member(s). Warnings, timeouts, kicks and bans all land in the audit log.`}
    >
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members…"
          className="h-11 border-white/10 glass pl-9"
        />
      </div>

      <ul className="space-y-2">
        {rows.map((member) => {
          const name = member.profile?.display_name || member.profile?.username || "Member";
          const state = statusById.get(member.user_id);
          const isOwner = member.user_id === ownerId;
          const timedOut = state?.timeout_until ? new Date(state.timeout_until).getTime() > Date.now() : false;
          const key = `m:${member.user_id}`;
          return (
            <li key={member.user_id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 shrink-0 ring-1 ring-white/10">
                  <AvatarImage src={member.profile?.avatar_url ?? undefined} alt="" />
                  <AvatarFallback className="bg-gradient-primary text-xs font-bold">
                    {name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {name} {isOwner && <Crown className="ml-1 inline h-3.5 w-3.5 text-amber-300" aria-label="Owner" />}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {isOwner ? "Owner" : member.role}
                    {state?.warn_points ? ` · ${state.warn_points} warn point(s)` : ""}
                    {timedOut ? " · timed out" : ""}
                  </p>
                </div>
              </div>

              {canManage && !isOwner && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Select
                    value={member.role}
                    onValueChange={(value) =>
                      void run(
                        `role:${member.user_id}`,
                        () => setRealmMemberRole(realmId, member.user_id, value as "member" | "mod"),
                        `${name} is now a ${value}`,
                      )
                    }
                  >
                    <SelectTrigger className="glass h-10 w-32 border-white/10" aria-label={`Role for ${name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="mod">Moderator</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy === key}
                    className="h-10 border-white/10 bg-white/5"
                    onClick={() =>
                      void run(
                        key,
                        async () => {
                          const result = await warnRealmMember({ realmId, userId: member.user_id, reason: "From realm settings" });
                          if (result.message) toast.info(result.message);
                        },
                        `Warned ${name}`,
                      )
                    }
                  >
                    <MessageSquareWarning className="h-4 w-4" /> Warn
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy === key}
                    className="h-10 border-white/10 bg-white/5"
                    onClick={() =>
                      void run(key, () => timeoutRealmMember(realmId, member.user_id, 10, "From realm settings"), `${name} timed out for 10 minutes`)
                    }
                  >
                    <Gauge className="h-4 w-4" /> Timeout 10m
                  </Button>

                  {(state?.warn_points || timedOut) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy === key}
                      className="h-10 border-white/10 bg-white/5"
                      onClick={() => void run(key, () => clearRealmWarns(realmId, member.user_id), `Cleared ${name}'s warns`)}
                    >
                      <X className="h-4 w-4" /> Clear
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy === key}
                    className="h-10 border-white/10 bg-white/5"
                    onClick={() => void run(key, () => kickRealmMember(realmId, member.user_id), `${name} was kicked`)}
                  >
                    <UserMinus className="h-4 w-4" /> Kick
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setBanTarget({ id: member.user_id, name })}
                  >
                    <UserX className="h-4 w-4" /> Ban
                  </Button>
                </div>
              )}
            </li>
          );
        })}
        {rows.length === 0 && <EmptyState>Nobody matches that search.</EmptyState>}
      </ul>

      <AlertDialog open={!!banTarget} onOpenChange={(open) => { if (!open) setBanTarget(null); }}>
        <AlertDialogContent className="glass-strong border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Ban {banTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They are removed from the realm and cannot rejoin until you unban them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                const target = banTarget;
                setBanTarget(null);
                if (target) {
                  void run(
                    `ban:${target.id}`,
                    () => banRealmMember(realmId, target.id, "From realm settings"),
                    `${target.name} was banned`,
                  );
                }
              }}
            >
              Ban member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}

// ---------------------------------------------------------------- channels

function ChannelsSection({ realmId, canManage }: { realmId: string; canManage: boolean }) {
  const invalidate = useInvalidate(realmId);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [draft, setDraft] = useState<Record<string, { name: string; topic: string; slowmode: number; isPrivate: boolean }>>({});

  const rooms = useQuery({ queryKey: ["realm-rooms", realmId], queryFn: () => fetchRealmRooms(realmId) });

  const entryOf = (room: RealmRoom) =>
    draft[room.id] ?? {
      name: room.name,
      topic: room.topic ?? "",
      slowmode: room.slowmode_seconds ?? 0,
      isPrivate: room.is_private ?? false,
    };

  const update = (roomId: string, patch: Partial<{ name: string; topic: string; slowmode: number; isPrivate: boolean }>) =>
    setDraft((current) => {
      const room = (rooms.data ?? []).find((r) => r.id === roomId);
      const base = current[roomId] ??
        (room
          ? { name: room.name, topic: room.topic ?? "", slowmode: room.slowmode_seconds ?? 0, isPrivate: room.is_private ?? false }
          : { name: "", topic: "", slowmode: 0, isPrivate: false });
      return { ...current, [roomId]: { ...base, ...patch } };
    });

  const save = async (room: RealmRoom) => {
    const entry = entryOf(room);
    setBusy(room.id);
    try {
      await updateRealmRoomSettings({
        roomId: room.id,
        name: entry.name,
        topic: entry.topic,
        slowmodeSeconds: entry.slowmode,
        isPrivate: entry.isPrivate,
      });
      await invalidate(["realm-rooms", realmId]);
      await qc.invalidateQueries({ queryKey: ["realm-rooms", realmId] });
      toast.success(`#${entry.name} saved`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save that channel");
    } finally {
      setBusy(null);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const list = [...(rooms.data ?? [])].sort((a, b) => a.position - b.position);
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const reordered = [...list];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    setBusy("order");
    try {
      await reorderRealmRooms(realmId, reordered.map((room) => room.id));
      await invalidate(["realm-rooms", realmId]);
      await qc.invalidateQueries({ queryKey: ["realm-rooms", realmId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't reorder channels");
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    if (!newName.trim()) return;
    setBusy("create");
    try {
      await createRealmRoom({ realmId, name: newName.trim(), kind: "text" });
      setNewName("");
      await qc.invalidateQueries({ queryKey: ["realm-rooms", realmId] });
      toast.success("Channel created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't create that channel");
    } finally {
      setBusy(null);
    }
  };

  const ordered = [...(rooms.data ?? [])].sort((a, b) => a.position - b.position);

  return (
    <Panel title="Channels" description="Rename, reorder, slow down or hide a channel. Private channels are visible to moderators only (plus anyone you grant the permission to).">
      <div className="space-y-3">
        {ordered.map((room, index) => {
          const entry = entryOf(room);
          const key = `r:${room.id}`;
          return (
            <div key={room.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5">
                  <Hash className="h-4 w-4" />
                </span>
                <Input
                  value={entry.name}
                  maxLength={40}
                  disabled={!canManage}
                  onChange={(e) => update(room.id, { name: e.target.value })}
                  className="glass h-10 border-white/10"
                />
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    aria-label={`Move ${room.name} up`}
                    disabled={!canManage || index === 0 || busy === "order"}
                    onClick={() => void move(index, -1)}
                    className="grid h-5 w-6 place-items-center rounded border border-white/10 text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${room.name} down`}
                    disabled={!canManage || index === ordered.length - 1 || busy === "order"}
                    onClick={() => void move(index, 1)}
                    className="grid h-5 w-6 place-items-center rounded border border-white/10 text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Input
                  value={entry.topic}
                  maxLength={160}
                  placeholder="Channel topic"
                  disabled={!canManage}
                  onChange={(e) => update(room.id, { topic: e.target.value })}
                  className="glass h-10 border-white/10"
                />
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={21600}
                    value={entry.slowmode}
                    disabled={!canManage}
                    aria-label={`Slowmode for ${room.name}`}
                    onChange={(e) => update(room.id, { slowmode: Number(e.target.value) || 0 })}
                    className="glass h-10 border-white/10"
                  />
                  <span className="shrink-0 text-[11px] text-muted-foreground">s slowmode</span>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-3">
                <label className="flex min-h-10 flex-1 items-center gap-2 text-xs text-muted-foreground">
                  <Switch
                    checked={entry.isPrivate}
                    disabled={!canManage}
                    aria-label={`${room.name} is private`}
                    onCheckedChange={(next) => update(room.id, { isPrivate: next })}
                  />
                  Private channel
                </label>
                <Button
                  type="button"
                  size="sm"
                  disabled={!canManage || busy === room.id}
                  onClick={() => void save(room)}
                  className="h-10 border-0 bg-gradient-primary text-primary-foreground"
                >
                  {busy === room.id ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          );
        })}
        {ordered.length === 0 && <EmptyState>No channels yet.</EmptyState>}

        {canManage && (
          <div className="flex gap-2">
            <Input
              value={newName}
              maxLength={40}
              placeholder="New channel name"
              onChange={(e) => setNewName(e.target.value)}
              className="glass h-11 border-white/10"
            />
            <Button
              type="button"
              disabled={busy === "create" || !newName.trim()}
              onClick={() => void create()}
              className="h-11 shrink-0 border-0 bg-gradient-primary text-primary-foreground"
            >
              Create
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------- automod

const VERIFICATION_LEVELS = [
  { value: "0", label: "None", hint: "Everyone can post" },
  { value: "1", label: "Low", hint: "Account older than a few minutes" },
  { value: "2", label: "Medium", hint: "Member for 5 minutes" },
  { value: "3", label: "High", hint: "Member for 10 minutes" },
  { value: "4", label: "Highest", hint: "Account older than a day" },
];

function AutomodSection({
  realmId,
  payload,
  canManage,
}: {
  realmId: string;
  payload: {
    realm: { mod_log_room_id: string | null; verification_level: number; warn_threshold: number; warn_timeout_minutes: number };
    automod: { banned_words: string[]; block_links: boolean; mention_limit: number; raid_mode: boolean; min_account_age_days: number };
  };
  canManage: boolean;
}) {
  const invalidate = useInvalidate(realmId);
  const [words, setWords] = useState((payload.automod.banned_words ?? []).join(", "));
  const [blockLinks, setBlockLinks] = useState(payload.automod.block_links);
  const [mentionLimit, setMentionLimit] = useState(payload.automod.mention_limit);
  const [raidMode, setRaidMode] = useState(payload.automod.raid_mode);
  const [minAge, setMinAge] = useState(payload.automod.min_account_age_days);
  const [level, setLevel] = useState(String(payload.realm.verification_level));
  const [modLog, setModLog] = useState(payload.realm.mod_log_room_id ?? "none");
  const [threshold, setThreshold] = useState(payload.realm.warn_threshold);
  const [timeoutMinutes, setTimeoutMinutes] = useState(payload.realm.warn_timeout_minutes);
  const [busy, setBusy] = useState(false);

  const rooms = useQuery({ queryKey: ["realm-rooms", realmId], queryFn: () => fetchRealmRooms(realmId) });
  const textRooms = (rooms.data ?? []).filter((room) => room.kind !== "voice");

  const save = async () => {
    setBusy(true);
    try {
      await setRealmAutomod({
        realmId,
        bannedWords: words.split(/[,\n]/).map((word) => word.trim()).filter(Boolean),
        blockLinks,
        mentionLimit,
        raidMode,
        minAccountAgeDays: minAge,
        verificationLevel: Number(level),
        modLogRoomId: modLog === "none" ? null : modLog,
        warnThreshold: threshold,
        warnTimeoutMinutes: timeoutMinutes,
      });
      await invalidate(["realm-rooms", realmId]);
      toast.success("AutoMod saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save AutoMod");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Moderation & AutoMod" description="Filters and gates run inside Postgres on every message, so they apply to the app and to any client.">
      <div className="space-y-3">
        <Field label="Banned words" hint="Comma or line separated. Matched as whole words, case-insensitively.">
          <Textarea
            value={words}
            rows={3}
            disabled={!canManage}
            onChange={(e) => setWords(e.target.value)}
            placeholder="slur, scam, …"
            className="glass border-white/10"
          />
        </Field>

        <ToggleRow
          label="Block links"
          hint="Moderators still bypass this."
          checked={blockLinks}
          disabled={!canManage}
          onChange={setBlockLinks}
        />

        <Field label="Mention limit" hint="0 turns the limit off. Counts @mentions per message.">
          <Input
            type="number"
            min={0}
            max={50}
            value={mentionLimit}
            disabled={!canManage}
            onChange={(e) => setMentionLimit(Number(e.target.value) || 0)}
            className="glass h-11 border-white/10"
          />
        </Field>

        <ToggleRow
          label="Raid mode"
          hint="Blocks accounts younger than a day and caps everyone at 5 messages a minute."
          checked={raidMode}
          disabled={!canManage}
          onChange={setRaidMode}
        />

        <Field label="Minimum account age" hint="Days. 0 turns the gate off.">
          <Input
            type="number"
            min={0}
            max={3650}
            value={minAge}
            disabled={!canManage}
            onChange={(e) => setMinAge(Number(e.target.value) || 0)}
            className="glass h-11 border-white/10"
          />
        </Field>

        <Field label="Verification level">
          <Select value={level} onValueChange={setLevel} disabled={!canManage}>
            <SelectTrigger className="glass h-11 border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VERIFICATION_LEVELS.map((entry) => (
                <SelectItem key={entry.value} value={entry.value}>
                  {entry.label} — {entry.hint}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Mod log channel" hint="Every moderation action is posted here as a system line.">
          <Select value={modLog} onValueChange={setModLog} disabled={!canManage}>
            <SelectTrigger className="glass h-11 border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No mod log</SelectItem>
              {textRooms.map((room) => (
                <SelectItem key={room.id} value={room.id}>
                  #{room.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Warns before a timeout">
            <Input
              type="number"
              min={0}
              max={20}
              value={threshold}
              disabled={!canManage}
              onChange={(e) => setThreshold(Number(e.target.value) || 0)}
              className="glass h-11 border-white/10"
            />
          </Field>
          <Field label="Auto-timeout length" hint="Minutes">
            <Input
              type="number"
              min={0}
              max={40320}
              value={timeoutMinutes}
              disabled={!canManage}
              onChange={(e) => setTimeoutMinutes(Number(e.target.value) || 0)}
              className="glass h-11 border-white/10"
            />
          </Field>
        </div>

        <Button
          type="button"
          disabled={!canManage || busy}
          onClick={() => void save()}
          className="h-11 w-full border-0 bg-gradient-primary text-primary-foreground"
        >
          {busy ? "Saving…" : "Save AutoMod"}
        </Button>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------- reports

function ReportsSection({ realmId, canModerate }: { realmId: string; canModerate: boolean }) {
  const invalidate = useInvalidate(realmId);
  const [busy, setBusy] = useState<string | null>(null);
  const reports = useQuery({
    queryKey: realmReportsKey(realmId),
    queryFn: () => fetchRealmReports(realmId),
    enabled: canModerate,
  });

  const run = async (key: string, action: () => Promise<void>, success: string) => {
    setBusy(key);
    try {
      await action();
      await invalidate(realmReportsKey(realmId), realmAuditKey(realmId));
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That didn't work");
    } finally {
      setBusy(null);
    }
  };

  if (!canModerate) {
    return (
      <Panel title="Reports" description="Only moderators can work the reports queue.">
        <EmptyState>You don&apos;t have permission to moderate messages here.</EmptyState>
      </Panel>
    );
  }

  return (
    <Panel title="Reports" description="Reports members filed. Remove the message and mark it actioned, or dismiss it.">
      <ul className="space-y-2">
        {(reports.data ?? []).map((report) => (
          <li key={report.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {report.reporter ?? "someone"} reported {report.author ?? "a message"}
              {report.deleted ? " · message already deleted" : ""}
            </p>
            <p className="mt-1 rounded-xl border border-white/10 bg-black/30 p-2 text-sm">
              {report.body || "(no longer available)"}
            </p>
            {report.reason && <p className="mt-1 text-[11px] text-muted-foreground">Reason: {report.reason}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy === report.id || report.deleted || !report.message_id}
                className="h-10 border-white/10 bg-white/5"
                onClick={() =>
                  void run(
                    report.id,
                    () => moderateDeleteMessage(report.message_id!, "From the reports queue"),
                    "Message removed",
                  )
                }
              >
                <Trash2 className="h-4 w-4" /> Delete message
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy === report.id}
                className="h-10 border-0 bg-gradient-primary text-primary-foreground"
                onClick={() => void run(report.id, () => resolveRealmReport(report.id, "actioned"), "Report actioned")}
              >
                Actioned
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy === report.id}
                className="h-10"
                onClick={() => void run(report.id, () => resolveRealmReport(report.id, "dismissed"), "Report dismissed")}
              >
                Dismiss
              </Button>
            </div>
          </li>
        ))}
        {(reports.data ?? []).length === 0 && <EmptyState>The queue is empty. Nice.</EmptyState>}
      </ul>
    </Panel>
  );
}

// ---------------------------------------------------------------- bans

function BansSection({ realmId, canManage }: { realmId: string; canManage: boolean }) {
  const invalidate = useInvalidate(realmId);
  const [busy, setBusy] = useState<string | null>(null);
  const bans = useQuery({ queryKey: realmBansKey(realmId), queryFn: () => fetchRealmBans(realmId) });

  return (
    <Panel title="Bans" description="Banned people cannot rejoin until you unban them.">
      <ul className="space-y-2">
        {(bans.data ?? []).map((ban) => (
          <li key={ban.user_id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <Avatar className="h-9 w-9 shrink-0 ring-1 ring-white/10">
              <AvatarImage src={ban.avatar_url ?? undefined} alt="" />
              <AvatarFallback className="bg-gradient-primary text-xs font-bold">
                {(ban.display_name || ban.username || "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{ban.display_name || ban.username || "Member"}</p>
              <p className="text-[11px] text-muted-foreground">
                {ban.reason ? `“${ban.reason}” · ` : ""}
                {new Date(ban.created_at).toLocaleDateString()}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canManage || busy === ban.user_id}
              className="h-10 shrink-0 border-white/10 bg-white/5"
              onClick={() => {
                setBusy(ban.user_id);
                void unbanRealmMember(realmId, ban.user_id)
                  .then(async () => {
                    await invalidate(realmBansKey(realmId), ["realm-members", realmId]);
                    toast.success("Unbanned");
                  })
                  .catch((error: unknown) =>
                    toast.error(error instanceof Error ? error.message : "Couldn't unban them"),
                  )
                  .finally(() => setBusy(null));
              }}
            >
              Unban
            </Button>
          </li>
        ))}
        {(bans.data ?? []).length === 0 && <EmptyState>Nobody is banned.</EmptyState>}
      </ul>
    </Panel>
  );
}

// ---------------------------------------------------------------- invites

function InvitesSection({ realmId, canManage }: { realmId: string; canManage: boolean }) {
  const invalidate = useInvalidate(realmId);
  const [days, setDays] = useState(7);
  const [uses, setUses] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const invites = useQuery({ queryKey: realmInvitesKey(realmId), queryFn: () => fetchRealmInvites(realmId) });

  const create = async () => {
    setBusy("create");
    try {
      await createRealmInvite({ realmId, expiresInDays: days || null, maxUses: uses || null });
      await invalidate(realmInvitesKey(realmId));
      toast.success("Invite created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't create that invite");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel title="Invites" description="Expiry and use limits are enforced when someone opens the link.">
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Field label="Expires in (days)" hint="0 = never">
          <Input
            type="number"
            min={0}
            value={days}
            disabled={!canManage}
            onChange={(e) => setDays(Number(e.target.value) || 0)}
            className="glass h-11 border-white/10"
          />
        </Field>
        <Field label="Max uses" hint="0 = unlimited">
          <Input
            type="number"
            min={0}
            value={uses}
            disabled={!canManage}
            onChange={(e) => setUses(Number(e.target.value) || 0)}
            className="glass h-11 border-white/10"
          />
        </Field>
        <div className="flex items-end">
          <Button
            type="button"
            disabled={!canManage || busy === "create"}
            onClick={() => void create()}
            className="h-11 w-full border-0 bg-gradient-primary text-primary-foreground"
          >
            New invite
          </Button>
        </div>
      </div>

      <ul className="space-y-2">
        {(invites.data ?? []).map((invite) => {
          const state = inviteState(invite);
          return (
            <li key={invite.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm">{invite.code}</p>
                <p className="text-[11px] text-muted-foreground">
                  {state.label} · {invite.uses}
                  {invite.max_uses ? `/${invite.max_uses}` : ""} uses
                  {invite.expires_at ? ` · expires ${new Date(invite.expires_at).toLocaleDateString()}` : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 shrink-0 border-white/10 bg-white/5"
                onClick={() => {
                  const link = `${window.location.origin}/join-realm/${invite.code}`;
                  void navigator.clipboard.writeText(link).then(
                    () => toast.success("Invite link copied"),
                    () => toast.error("Couldn't copy that link"),
                  );
                }}
              >
                Copy link
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!canManage || busy === invite.id || !invite.is_active}
                className="h-10 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  setBusy(invite.id);
                  void revokeRealmInviteById(invite.id)
                    .then(async () => {
                      await invalidate(realmInvitesKey(realmId));
                      toast.success("Invite revoked");
                    })
                    .catch((error: unknown) =>
                      toast.error(error instanceof Error ? error.message : "Couldn't revoke that invite"),
                    )
                    .finally(() => setBusy(null));
                }}
              >
                Revoke
              </Button>
            </li>
          );
        })}
        {(invites.data ?? []).length === 0 && <EmptyState>No invites yet.</EmptyState>}
      </ul>
    </Panel>
  );
}

// ---------------------------------------------------------------- bots

function BotsSection({ realmId, realmName, installed }: { realmId: string; realmName: string; installed: number }) {
  const [open, setOpen] = useState(false);
  const rooms = useQuery({ queryKey: ["realm-rooms", realmId], queryFn: () => fetchRealmRooms(realmId) });

  return (
    <Panel title="Bots & integrations" description={`${installed} bot(s) installed. Bots only work inside realms.`}>
      <Button
        type="button"
        className="h-11 w-full border-0 bg-gradient-primary text-primary-foreground"
        onClick={() => setOpen(true)}
      >
        <BotIcon className="h-4 w-4" /> Manage bots
      </Button>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Want a bot of your own? Build one on the{" "}
        <Link to="/bots/developer" className="text-[var(--rizz-pink)] hover:underline">
          developer page
        </Link>
        .
      </p>
      <RealmBotsSheet
        open={open}
        onOpenChange={setOpen}
        realmId={realmId}
        realmName={realmName}
        rooms={(rooms.data ?? []) as RealmRoom[]}
        isOwner={false}
      />
    </Panel>
  );
}

// ---------------------------------------------------------------- audit

const AUDIT_TONES: Record<string, string> = {
  "member.warn": "text-amber-200",
  "member.timeout": "text-orange-300",
  "message.delete": "text-rose-300",
  "report.resolved": "text-emerald-300",
  "report.dismissed": "text-muted-foreground",
};

function AuditSection({ realmId, canView }: { realmId: string; canView: boolean }) {
  const audit = useQuery({
    queryKey: realmAuditKey(realmId),
    queryFn: () => fetchRealmAudit(realmId, 150),
    enabled: canView,
  });

  if (!canView) {
    return (
      <Panel title="Audit log" description="Moderators only.">
        <EmptyState>You don&apos;t have permission to read the audit log.</EmptyState>
      </Panel>
    );
  }

  return (
    <Panel title="Audit log" description="Every moderation action, newest first. The mod-log channel gets the same lines live.">
      <ul className="space-y-1.5">
        {(audit.data ?? []).map((entry) => (
          <li key={entry.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <p className={`text-sm ${AUDIT_TONES[entry.action] ?? "text-foreground"}`}>
              {entry.detail || entry.action}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {entry.action} · {entry.actor ?? "system"} · {new Date(entry.created_at).toLocaleString()}
            </p>
          </li>
        ))}
        {(audit.data ?? []).length === 0 && <EmptyState>Nothing logged yet.</EmptyState>}
      </ul>
    </Panel>
  );
}

// ---------------------------------------------------------------- danger

function DangerSection({
  realmId,
  realmName,
  isOwner,
  onDeleted,
}: {
  realmId: string;
  realmName: string;
  isOwner: boolean;
  onDeleted: () => void;
}) {
  const invalidate = useInvalidate(realmId);
  const [transferTo, setTransferTo] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const members = useQuery({
    queryKey: ["realm-members", realmId],
    queryFn: () => listRealmMembers(realmId),
    enabled: isOwner,
  });

  return (
    <div className="space-y-4">
      <Panel title="Transfer ownership" description="The new owner takes over instantly and you become a member.">
        {isOwner ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={transferTo} onValueChange={setTransferTo}>
              <SelectTrigger className="glass h-11 border-white/10">
                <SelectValue placeholder="Choose a member" />
              </SelectTrigger>
              <SelectContent>
                {(members.data ?? []).map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.profile?.display_name || member.profile?.username || "Member"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              disabled={!transferTo || busy === "transfer"}
              className="h-11 shrink-0 border-0 bg-gradient-primary text-primary-foreground"
              onClick={() => {
                setBusy("transfer");
                void transferRealmOwnership(realmId, transferTo)
                  .then(async () => {
                    await invalidate(["realm-members", realmId]);
                    toast.success("Ownership transferred");
                  })
                  .catch((error: unknown) =>
                    toast.error(error instanceof Error ? error.message : "Couldn't transfer this realm"),
                  )
                  .finally(() => setBusy(null));
              }}
            >
              Transfer
            </Button>
          </div>
        ) : (
          <EmptyState>Only the current owner can transfer this realm.</EmptyState>
        )}
      </Panel>

      <Panel title="Delete this realm" description="Channels, messages, invites and voice rooms go with it. There is no undo.">
        {isOwner ? (
          <Button
            type="button"
            className="h-11 w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" /> Delete “{realmName}”
          </Button>
        ) : (
          <EmptyState>Only the owner can delete this realm.</EmptyState>
        )}
      </Panel>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="glass-strong border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" /> Delete “{realmName}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the realm for everyone. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                setBusy("delete");
                void deleteRealm(realmId)
                  .then(() => {
                    toast.success("Realm deleted");
                    setDeleteOpen(false);
                    onDeleted();
                  })
                  .catch((error: unknown) =>
                    toast.error(error instanceof Error ? error.message : "Couldn't delete this realm"),
                  )
                  .finally(() => setBusy(null));
              }}
            >
              {busy === "delete" ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
