import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Hash, Megaphone, ShieldCheck, SmilePlus, AlertTriangle, RefreshCw } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { listRealmMembers, type RealmMember as RealmMemberRow, type RealmRoom } from "@/lib/realms";
import { canModerateRealm } from "@/lib/realm-roles";
import {
  channelPermissionsKey,
  describePermissionError,
  permissionChannelKey,
  setChannelReactionsMode,
  setChannelWritePermission,
  useChannelPermissions,
  type ReactionsMode,
} from "@/lib/realm-permissions";

type ChannelOption = {
  /** Room id, or null for the realm's own channel. */
  roomId: string | null;
  key: string;
  label: string;
  desc: string;
  announcement?: boolean;
};

/**
 * Moderation → Channels → permissions.
 *
 * One channel is picked first, then every member gets a "can send messages"
 * switch for that channel, plus "who can add reactions". The database enforces
 * both rules (set_channel_write_permission / set_channel_reactions_mode and the
 * guards they manage), so this screen is the moderation UI for a server rule
 * rather than the rule itself.
 *
 * The screen always resolves to one of four visible states: skeleton, members,
 * empty, or an error with Retry. It never silently does nothing.
 */
export function ChannelPermissionsSheet({
  open,
  onOpenChange,
  realmId,
  realmName,
  rooms,
  canModerate,
  realmReactionsMode = "everyone",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  realmId: string;
  realmName: string;
  rooms: RealmRoom[];
  canModerate: boolean;
  realmReactionsMode?: ReactionsMode;
}) {
  const qc = useQueryClient();
  const permissions = useChannelPermissions(open ? realmId : null);
  const members = useQuery({
    queryKey: ["realm-members", realmId],
    enabled: open && !!realmId,
    queryFn: () => listRealmMembers(realmId),
  });

  const channels: ChannelOption[] = [
    { roomId: null, key: realmId, label: `#${realmName}`, desc: "The realm's main channel" },
    ...rooms
      .filter((room) => room.kind !== "voice")
      .map((room) => ({
        roomId: room.id,
        key: room.id,
        label: `#${room.name}`,
        desc: room.topic?.trim() || (room.kind === "announcement" ? "Announcement channel" : "Text channel"),
        announcement: room.kind === "announcement",
      })),
  ];

  const [channelKey, setChannelKey] = useState<string>(realmId);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [modeBusy, setModeBusy] = useState(false);

  // Keep the picked channel valid when rooms finish loading or change.
  useEffect(() => {
    if (!channels.some((channel) => channel.key === channelKey)) setChannelKey(realmId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realmId, channels.map((channel) => channel.key).join("|")]);

  const channel = channels.find((entry) => entry.key === channelKey) ?? channels[0];
  const membersLoading = members.isLoading || permissions.isLoading;
  const loadError = permissions.error ?? members.error;
  const loadFailed = permissions.isError || members.isError;

  const rows: RealmMemberRow[] = (members.data ?? []) as RealmMemberRow[];
  const denied = new Set(
    permissions.permissions
      .filter((row) => !row.can_write && row.realm_id === realmId)
      .map(permissionChannelKey),
  );

  const reactionsMode: ReactionsMode =
    channel?.roomId == null
      ? realmReactionsMode
      : ((rooms.find((room) => room.id === channel.roomId) as { reactions_mode?: ReactionsMode } | undefined)
          ?.reactions_mode ?? "everyone");

  const toggleMember = async (member: RealmMemberRow, canWrite: boolean) => {
    if (!channel) return;
    const key = `${channel.key}:${member.user_id}`;
    setBusyKey(key);
    try {
      await setChannelWritePermission({
        realmId,
        roomId: channel.roomId,
        userId: member.user_id,
        canWrite,
      });
      await qc.invalidateQueries({ queryKey: channelPermissionsKey(realmId) });
      const name = member.profile?.display_name || member.profile?.username || "Member";
      toast.success(
        canWrite ? `${name} can send messages in ${channel.label}` : `${name} can no longer send messages in ${channel.label}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't change that permission");
    } finally {
      setBusyKey(null);
    }
  };

  const changeReactionsMode = async (mode: ReactionsMode) => {
    if (!channel || mode === reactionsMode) return;
    setModeBusy(true);
    try {
      await setChannelReactionsMode({ realmId, roomId: channel.roomId, mode });
      await qc.invalidateQueries({ queryKey: ["realm-rooms", realmId] });
      await qc.invalidateQueries({ queryKey: ["realm", realmId] });
      toast.success(
        mode === "mods"
          ? `Only moderators can add reactions in ${channel.label}`
          : `Everyone can add reactions in ${channel.label}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't change who can react here");
    } finally {
      setModeBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        // Above any dialog/overlay so the sheet can never mount behind one.
        className="glass-strong z-[70] max-h-[88dvh] overflow-y-auto rounded-t-3xl border-white/10 pb-[max(env(safe-area-inset-bottom),1rem)]"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-xl break-words">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[var(--rizz-pink)]" />
              Channels &amp; permissions
            </span>
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Pick a channel, then choose who may send messages and who may add reactions there. The
            server enforces both rules; owners and moderators always keep full access.
          </p>
        </SheetHeader>

        {/* 1. Channel picker: always visible, always tappable (48px targets). */}
        <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
          {channels.map((entry) => {
            const active = entry.key === channel?.key;
            const Icon = entry.announcement ? Megaphone : Hash;
            return (
              <button
                key={entry.key}
                type="button"
                aria-pressed={active}
                onClick={() => setChannelKey(entry.key)}
                className={`flex min-h-12 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)] ${
                  active
                    ? "border-[var(--rizz-pink)]/50 bg-[var(--rizz-pink)]/15 text-foreground"
                    : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {entry.label.replace(/^#/, "")}
              </button>
            );
          })}
        </div>

        {channel && <p className="mt-2 text-[11px] text-muted-foreground">{channel.desc}</p>}

        {loadFailed ? (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100"
          >
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Couldn&apos;t load channel permissions
            </p>
            <p className="mt-1 text-amber-100/85">{describePermissionError(loadError)}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-3 h-12 w-full border-amber-300/40 bg-transparent text-amber-100 hover:bg-amber-300/10"
              onClick={() => {
                void permissions.refetch();
                void members.refetch();
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : membersLoading ? (
          <div className="mt-5 space-y-2" aria-busy="true" aria-live="polite">
            <span className="sr-only">Loading channel permissions…</span>
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="h-12 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : (
          <>
            {!canModerate && (
              <p className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-muted-foreground">
                You can see these settings, but only realm owners and moderators can change them.
              </p>
            )}

            {/* 2. Who can add reactions (server-enforced switch). */}
            <section className="mt-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <SmilePlus className="h-4 w-4 text-[var(--rizz-violet)]" />
                Who can add reactions
              </h3>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["everyone", "mods"] as const).map((mode) => {
                  const active = reactionsMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={active}
                      disabled={!canModerate || modeBusy}
                      onClick={() => void changeReactionsMode(mode)}
                      className={`min-h-12 rounded-2xl border px-3 text-sm font-medium transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)] ${
                        active
                          ? "border-[var(--rizz-pink)]/50 bg-[var(--rizz-pink)]/15 text-foreground"
                          : "border-white/10 bg-white/5 text-muted-foreground"
                      }`}
                    >
                      {mode === "everyone" ? "Everyone" : "Owner & mods"}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {reactionsMode === "mods"
                  ? "Members can still see reactions, but only owners and moderators can add them here."
                  : "Anyone in this realm who can read the channel can react."}
              </p>
            </section>

            {/* 3. Who can send messages, one row per member. */}
            <section className="mt-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Hash className="h-4 w-4 text-[var(--rizz-pink)]" />
                Who can send messages
              </h3>
              <div className="mt-2 space-y-2">
                {rows.length === 0 && (
                  <p className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-muted-foreground">
                    No members to set permissions for yet.
                  </p>
                )}
                {rows.map((member) => {
                  const name = member.profile?.display_name || member.profile?.username || "Member";
                  const isMod = canModerateRealm(member.role as never);
                  const allowed = isMod || !denied.has(channel?.key ?? realmId);
                  const busy = busyKey === `${channel?.key}:${member.user_id}`;
                  return (
                    <div
                      key={member.user_id}
                      className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 glass px-3 py-2"
                    >
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={member.profile?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-gradient-primary text-xs font-bold">
                          {name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {isMod
                            ? "Owner or moderator · always allowed"
                            : busy
                              ? "Saving…"
                              : allowed
                                ? "Can send messages"
                                : "Read only"}
                        </p>
                      </div>
                      <Switch
                        checked={allowed}
                        disabled={!canModerate || isMod || busy || !channel}
                        aria-label={`${name} can send messages in ${channel?.label ?? "this channel"}`}
                        onCheckedChange={(next) => void toggleMember(member, next)}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
