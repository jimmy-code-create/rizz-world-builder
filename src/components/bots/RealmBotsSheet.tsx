import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot as BotIcon, Hash, Megaphone, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { RealmRoom } from "@/lib/realms";
import {
  botDirectoryKey,
  fetchBotDirectory,
  fetchRealmBots,
  installRealmBot,
  realmBotsKey,
  setBotCommandChannelEnabled,
  setRealmAllowMemberBots,
  setRealmBotEnabled,
  uninstallRealmBot,
} from "@/lib/bots";
import { WebhookBotsSection } from "@/components/bots/WebhookBotsSection";

/**
 * Realm → Bots.
 *
 * The house bot and any installed custom bot are listed here, each with an on/off
 * switch and, once a channel is picked, the per-channel command switches. Every
 * button below is re-checked server-side by the RPC it calls, so this screen can
 * safely offer itself to anyone and simply grey out what they cannot change.
 */
export function RealmBotsSheet({
  open,
  onOpenChange,
  realmId,
  realmName,
  rooms,
  isOwner,
  canModerate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  realmId: string;
  realmName: string;
  rooms: RealmRoom[];
  isOwner: boolean;
  canModerate?: boolean;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [channelKey, setChannelKey] = useState<string>(realmId);

  const bots = useQuery({
    queryKey: realmBotsKey(realmId),
    enabled: open && !!realmId,
    queryFn: () => fetchRealmBots(realmId),
  });

  const directory = useQuery({
    queryKey: botDirectoryKey(""),
    enabled: open && !!realmId,
    queryFn: () => fetchBotDirectory(""),
  });

  const textRooms = rooms.filter((room) => room.kind !== "voice");
  const channels = [
    { key: realmId, roomId: null as string | null, label: `#${realmName}`, announcement: false },
    ...textRooms.map((room) => ({
      key: room.id,
      roomId: room.id,
      label: `#${room.name}`,
      announcement: room.kind === "announcement",
    })),
  ];
  const channel = channels.find((entry) => entry.key === channelKey) ?? channels[0];

  const canManage = isOwner || Boolean(canModerate) || (bots.data?.can_manage ?? false) || (bots.data?.allow_member_bots ?? false);
  const installedIds = new Set((bots.data?.bots ?? []).map((bot) => bot.bot_id));
  const installable = useMemo(
    () => (directory.data ?? []).filter((bot) => !installedIds.has(bot.bot_id)),
    [directory.data, installedIds],
  );

  const denied = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const row of bots.data?.channel_settings ?? []) {
      const key = `${row.realm_room_id ?? realmId}:${row.command_id}`;
      map.set(key, row.enabled);
    }
    return map;
  }, [bots.data?.channel_settings, realmId]);

  const commandAllowed = (commandId: string) => denied.get(`${channel?.roomId ?? realmId}:${commandId}`) ?? true;

  const run = async (key: string, action: () => Promise<void>, success: string) => {
    setBusy(key);
    try {
      await action();
      await qc.invalidateQueries({ queryKey: realmBotsKey(realmId) });
      await qc.invalidateQueries({ queryKey: ["realm-slash-commands", realmId] });
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update that");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="glass-strong z-[110] max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-3xl border-white/10 pb-[max(env(safe-area-inset-bottom),1rem)]"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-xl break-words">
            <span className="flex items-center gap-2">
              <BotIcon className="h-5 w-5 text-muted-foreground" /> Bots
            </span>
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Bots answer slash commands in this realm's text channels. They never appear in DMs or
            groups.
          </p>
        </SheetHeader>

        {bots.isLoading ? (
          <div className="mt-5 space-y-2" aria-busy="true">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-14 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : bots.isError ? (
          <div role="alert" className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="h-4 w-4" /> Couldn&apos;t load this realm&apos;s bots
            </p>
            <p className="mt-1 text-amber-100/85">
              {(bots.error instanceof Error && bots.error.message) ||
                "Apply the latest Supabase migration, then try again."}
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-3 h-11 w-full border-amber-300/40 bg-transparent text-amber-100 hover:bg-amber-300/10"
              onClick={() => void bots.refetch()}
            >
              Retry
            </Button>
          </div>
        ) : (
          <>
            {/* Installed bots */}
            <section className="mt-5 space-y-2">
              {(bots.data?.bots ?? []).length === 0 && (
                <p className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-muted-foreground">
                  No bots in this realm yet.
                </p>
              )}
              {(bots.data?.bots ?? []).map((bot) => (
                <div
                  key={bot.bot_id}
                  className="flex min-h-14 items-center gap-3 rounded-2xl border border-white/10 glass p-3"
                >
                  <Avatar className="h-9 w-9 shrink-0 ring-1 ring-white/10">
                    <AvatarImage src={bot.avatar_url ?? undefined} alt="" />
                    <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-bold text-primary-foreground">
                      {bot.is_builtin ? <BotIcon className="h-4 w-4" aria-hidden="true" /> : bot.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{bot.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {bot.enabled ? bot.description || "Installed" : "Switched off"}
                    </p>
                  </div>
                  <Switch
                    checked={bot.enabled}
                    disabled={!canManage || busy === `enabled:${bot.bot_id}`}
                    aria-label={`${bot.name} enabled`}
                    onCheckedChange={(next) =>
                      void run(
                        `enabled:${bot.bot_id}`,
                        () => setRealmBotEnabled(realmId, bot.bot_id, next),
                        next ? `${bot.name} is on` : `${bot.name} is off`,
                      )
                    }
                  />
                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 px-2 text-rose-300"
                      aria-label={`Remove ${bot.name} from this realm`}
                      disabled={busy === `remove:${bot.bot_id}`}
                      onClick={() =>
                        void run(
                          `remove:${bot.bot_id}`,
                          () => uninstallRealmBot(realmId, bot.bot_id),
                          `${bot.name} removed`,
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </section>

            {/* Add a bot */}
            {canManage && (
              <section className="mt-5">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full gap-2 glass border-white/10"
                  onClick={() => setAdding((current) => !current)}
                >
                  <Plus className="h-4 w-4" /> {adding ? "Close the directory" : "Add a bot"}
                </Button>
                {adding && (
                  <div className="mt-2 space-y-2">
                    {installable.length === 0 && (
                      <p className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-muted-foreground">
                        Every available bot is already here.
                      </p>
                    )}
                    {installable.map((bot) => (
                      <div
                        key={bot.bot_id}
                        className="flex min-h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                      >
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage src={bot.avatar_url ?? undefined} alt="" />
                          <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-bold text-primary-foreground">
                            {bot.is_builtin ? <BotIcon className="h-4 w-4" aria-hidden="true" /> : bot.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{bot.name}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{bot.description}</p>
                        </div>
                        <Button
                          size="sm"
                          className="h-9 shrink-0 border-0 bg-primary text-primary-foreground"
                          disabled={busy === `install:${bot.bot_id}`}
                          onClick={() =>
                            void run(
                              `install:${bot.bot_id}`,
                              () => installRealmBot(realmId, bot.bot_id),
                              `${bot.name} added`,
                            )
                          }
                        >
                          Add
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Owner-only: let everyone add bots */}
            {isOwner && (
              <section className="mt-5 flex min-h-14 items-center gap-3 rounded-2xl border border-white/10 glass p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Allow all members to add bots</p>
                  <p className="text-[11px] text-muted-foreground">
                    Off by default: only you, moderators and members you grant it to can manage bots.
                  </p>
                </div>
                <Switch
                  checked={bots.data?.allow_member_bots ?? false}
                  disabled={busy === "allow-member-bots"}
                  aria-label="Allow all members to add bots"
                  onCheckedChange={(next) =>
                    void run(
                      "allow-member-bots",
                      () => setRealmAllowMemberBots(realmId, next),
                      next ? "Members can add bots" : "Only mods can add bots",
                    )
                  }
                />
              </section>
            )}

            {/* Webhook posting bots (owners/admins) */}
            <WebhookBotsSection
              realmId={realmId}
              realmName={realmName}
              rooms={rooms}
              canManage={isOwner || Boolean(canModerate)}
            />

            {/* Per-channel command switches */}
            {(bots.data?.bots ?? []).some((bot) => bot.commands.length > 0) && (
              <section className="mt-6">
                <h3 className="text-sm font-semibold">Commands in a channel</h3>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Pick a channel, then switch individual commands on or off there.
                </p>
                <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
                  {channels.map((entry) => {
                    const active = entry.key === channel?.key;
                    const Icon = entry.announcement ? Megaphone : Hash;
                    return (
                      <button
                        key={entry.key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setChannelKey(entry.key)}
                        className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors ${
                          active
                            ? "border-primary/50 bg-primary/15 text-foreground"
                            : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {entry.label.replace(/^#/, "")}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 space-y-3">
                  {(bots.data?.bots ?? []).map((bot) =>
                    bot.commands.length ? (
                      <div key={bot.bot_id}>
                        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          <BotIcon className="h-3 w-3" /> {bot.name}
                        </p>
                        <div className="mt-1.5 space-y-1.5">
                          {bot.commands.map((command) => {
                            const allowed = commandAllowed(command.id);
                            const key = `cmd:${command.id}`;
                            return (
                              <div
                                key={command.id}
                                className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-mono text-xs font-semibold">/{command.name}</p>
                                  <p className="truncate text-[11px] text-muted-foreground">{command.description}</p>
                                </div>
                                <Switch
                                  checked={allowed}
                                  disabled={!canManage || busy === key || !bot.enabled}
                                  aria-label={`/${command.name} in this channel`}
                                  onCheckedChange={(next) =>
                                    void run(
                                      key,
                                      () =>
                                        setBotCommandChannelEnabled({
                                          realmId,
                                          roomId: channel?.roomId ?? null,
                                          commandId: command.id,
                                          enabled: next,
                                        }),
                                      next ? `/${command.name} is on here` : `/${command.name} is off here`,
                                    )
                                  }
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null,
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default RealmBotsSheet;
