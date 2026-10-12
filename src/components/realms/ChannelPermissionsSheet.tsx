import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Hash, Megaphone, ShieldCheck } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PrefRow } from "@/components/settings/PrefRow";
import { toast } from "sonner";
import type { RealmRoom } from "@/lib/realms";
import {
  channelPermissionsKey,
  permissionChannelKey,
  setChannelWritePermission,
  useChannelPermissions,
} from "@/lib/realm-permissions";

export type ChannelMember = {
  user_id: string;
  name: string;
};

/**
 * Moderation: pick the channels one member may type in.
 *
 * Allowed is the default, so every switch starts on and turning one off stores a
 * denial. The database enforces the same rule when the member sends a message,
 * and owners/moderators are always allowed everywhere.
 */
export function ChannelPermissionsSheet({
  open,
  onOpenChange,
  realmId,
  realmName,
  member,
  rooms,
  canModerate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  realmId: string;
  realmName: string;
  member: ChannelMember | null;
  rooms: RealmRoom[];
  canModerate: boolean;
}) {
  const qc = useQueryClient();
  const { permissions } = useChannelPermissions(open && member ? realmId : null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // The realm's own channel plus its text and announcement rooms. Voice rooms
  // carry no messages, so there is nothing to allow or block there.
  const channels: Array<{ key: string; roomId: string | null; label: string; desc: string; announcement?: boolean }> = [
    {
      key: realmId,
      roomId: null,
      label: `#${realmName}`,
      desc: "The realm's main channel",
    },
    ...rooms
      .filter((room) => room.kind !== "voice")
      .map((room) => ({
        key: room.id,
        roomId: room.id,
        label: `#${room.name}`,
        desc: room.topic?.trim() || (room.kind === "announcement" ? "Announcement channel" : "Text channel"),
        announcement: room.kind === "announcement",
      })),
  ];

  const denied = new Set(
    permissions
      .filter((row) => row.user_id === member?.user_id && row.realm_id === realmId && !row.can_write)
      .map(permissionChannelKey),
  );

  const toggle = async (key: string, roomId: string | null, canWrite: boolean) => {
    if (!member) return;
    setBusyKey(key);
    try {
      await setChannelWritePermission({ realmId, roomId, userId: member.user_id, canWrite });
      await qc.invalidateQueries({ queryKey: channelPermissionsKey(realmId) });
      toast.success(
        canWrite
          ? `${member.name} can write in ${key === realmId ? `#${realmName}` : `#${channels.find((c) => c.key === key)?.label.replace(/^#/, "") ?? "that channel"}`}`
          : `${member.name} can no longer write there`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't change that permission");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="glass-strong max-h-[85dvh] overflow-y-auto rounded-t-3xl border-white/10 pb-[max(env(safe-area-inset-bottom),1rem)]"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-xl break-words">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[var(--rizz-pink)]" />
              Channels for {member?.name ?? "this member"}
            </span>
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Choose where this member may type. Everything is allowed until you switch it off, and
            owners and moderators always keep full access.
          </p>
        </SheetHeader>

        {!canModerate ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Only realm owners and moderators can change channel permissions.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {channels.map((channel) => {
              const allowed = !denied.has(channel.key);
              return (
                <div key={channel.key} className="rounded-2xl border border-white/10 glass px-3 py-3">
                  <PrefRow
                    label={channel.label}
                    desc={allowed ? `${channel.desc} · Can write` : `${channel.desc} · Read only`}
                    checked={allowed}
                    onChange={(next) => void toggle(channel.key, channel.roomId, next)}
                    icon={channel.announcement ? <Megaphone className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
                  />
                  {busyKey === channel.key && (
                    <p className="mt-2 text-[11px] text-muted-foreground">Saving…</p>
                  )}
                </div>
              );
            })}
            {rooms.filter((room) => room.kind !== "voice").length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                This realm has no extra channels yet. Create one in Rooms to give it its own
                permission.
              </p>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
