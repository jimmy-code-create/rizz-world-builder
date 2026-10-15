import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot as BotIcon, Check, Copy, Eye, EyeOff, RotateCw, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { RealmRoom } from "@/lib/realms";
import {
  createWebhookBot,
  fetchWebhookBots,
  regenerateWebhookSecret,
  revokeWebhookBot,
  setWebhookBotChannel,
  webhookBotsKey,
  webhookUrlFor,
} from "@/lib/webhook-bots";
import { EmbedBuilder } from "@/components/bots/EmbedBuilder";

/**
 * Realm → Bots → Webhook bots (owners/admins).
 *
 * Create a posting bot, pick its channel, copy the webhook URL once,
 * regenerate or revoke the secret, and open the embed builder for live
 * previews + test sends. Every write is re-checked by RLS; failures surface
 * as small glass toasts with the reason.
 */
export function WebhookBotsSection({
  realmId,
  realmName,
  rooms,
  canManage,
}: {
  realmId: string;
  realmName: string;
  rooms: RealmRoom[];
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [builderFor, setBuilderFor] = useState<string | null>(null);

  const list = useQuery({
    queryKey: webhookBotsKey(realmId),
    queryFn: () => fetchWebhookBots(realmId),
  });

  const textRooms = rooms.filter((room) => room.kind !== "voice");
  const refresh = () => qc.invalidateQueries({ queryKey: webhookBotsKey(realmId) });

  const create = async () => {
    setBusy("create");
    try {
      const { bot, secret } = await createWebhookBot({ realmId, name, avatarUrl: avatar || null });
      setRevealed((r) => ({ ...r, [bot.id]: secret }));
      setName("");
      setAvatar("");
      await refresh();
      toast.success(`${bot.name} created — copy the webhook URL now`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't create that bot");
    } finally {
      setBusy(null);
    }
  };

  const regenerate = async (botId: string, botName: string) => {
    if (!window.confirm(`New secret for ${botName}? The old webhook URL stops working.`)) return;
    setBusy(`regen:${botId}`);
    try {
      const secret = await regenerateWebhookSecret(botId);
      setRevealed((r) => ({ ...r, [botId]: secret }));
      toast.success("New secret issued — copy it now");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't regenerate that secret");
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (botId: string, botName: string) => {
    if (!window.confirm(`Revoke ${botName}? It stops posting immediately.`)) return;
    setBusy(`revoke:${botId}`);
    try {
      await revokeWebhookBot(botId);
      setRevealed((r) => {
        const next = { ...r };
        delete next[botId];
        return next;
      });
      await refresh();
      toast.success(`${botName} revoked`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't revoke that bot");
    } finally {
      setBusy(null);
    }
  };

  if (!canManage) return null;

  return (
    <section className="mt-6">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <BotIcon className="h-4 w-4 text-primary" /> Webhook bots
      </h3>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Posting bots for announcements and feeds. They send rich embeds through a webhook URL.
      </p>

      {/* Create */}
      <div className="mt-2 space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={32}
            placeholder="Bot name"
            aria-label="Bot name"
            className="h-11"
          />
          <Input
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            placeholder="Avatar image URL (https, optional)"
            aria-label="Bot avatar URL"
            className="h-11"
            inputMode="url"
          />
        </div>
        <Button
          type="button"
          onClick={() => void create()}
          disabled={busy === "create" || name.trim().length < 2}
          className="h-11 w-full bg-primary text-primary-foreground"
        >
          {busy === "create" ? "Creating…" : "Create bot"}
        </Button>
      </div>

      {/* List */}
      <div className="mt-2 space-y-2">
        {(list.data ?? []).map((bot) => {
          const secret = revealed[bot.id];
          const url = secret ? webhookUrlFor(bot.id, secret) : null;
          return (
            <div key={bot.id} className="rounded-2xl border border-white/10 glass space-y-2 p-3">
              <div className="flex min-h-11 items-center gap-3">
                <Avatar className="h-9 w-9 shrink-0 ring-1 ring-white/10">
                  <AvatarImage src={bot.avatar_url ?? undefined} alt="" />
                  <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-bold">
                    {bot.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{bot.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    Posts to {bot.default_room_id ? `#${textRooms.find((r) => r.id === bot.default_room_id)?.name ?? "channel"}` : `#${realmName}`}
                  </p>
                </div>
                <Button
                  type="button" size="sm" variant="outline"
                  onClick={() => setBuilderFor(bot.id)}
                  className="h-9 shrink-0"
                >
                  Embeds
                </Button>
              </div>

              {/* Channel picker */}
              <label className="flex min-h-[44px] items-center gap-2 text-xs text-muted-foreground">
                <span className="shrink-0 font-semibold">Channel</span>
                <select
                  value={bot.default_room_id ?? ""}
                  onChange={(e) => {
                    const roomId = e.target.value || null;
                    void setWebhookBotChannel(bot.id, roomId)
                      .then(() => {
                        void refresh();
                        toast.success("Channel saved");
                      })
                      .catch((error: Error) => toast.error(error.message));
                  }}
                  aria-label={`Channel for ${bot.name}`}
                  className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-transparent px-2 text-sm text-foreground"
                >
                  <option value="">#{realmName} (main)</option>
                  {textRooms.map((room) => (
                    <option key={room.id} value={room.id}>#{room.name}</option>
                  ))}
                </select>
              </label>

              {/* One-time secret */}
              {url ? (
                <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-2.5">
                  <p className="flex items-start gap-1.5 text-[11px] font-semibold text-amber-100">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Copy it now — this URL is shown once. Keep it secret.
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <code className="min-w-0 flex-1 truncate rounded-lg bg-black/40 px-2 py-2 font-mono text-[11px] text-foreground">
                      {url}
                    </code>
                    <Button
                      type="button" size="icon" variant="outline" aria-label="Copy webhook URL"
                      className="h-11 w-11 shrink-0"
                      onClick={() => {
                        void navigator.clipboard.writeText(url).then(
                          () => toast.success("Webhook URL copied"),
                          () => toast.error("Couldn't copy — long-press to copy"),
                        );
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <EyeOff className="h-3.5 w-3.5" /> The secret is hidden. Regenerate to get a new URL.
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  type="button" size="sm" variant="outline"
                  disabled={busy === `regen:${bot.id}`}
                  onClick={() => void regenerate(bot.id, bot.name)}
                  className="h-11 flex-1 gap-1.5"
                >
                  <RotateCw className="h-3.5 w-3.5" /> Regenerate secret
                </Button>
                <Button
                  type="button" size="sm" variant="ghost"
                  disabled={busy === `revoke:${bot.id}`}
                  onClick={() => void revoke(bot.id, bot.name)}
                  aria-label={`Revoke ${bot.name}`}
                  className="h-11 gap-1.5 text-rose-300 hover:text-rose-200"
                >
                  <Trash2 className="h-4 w-4" /> Revoke
                </Button>
              </div>

              {builderFor === bot.id && secret && (
                <EmbedBuilder
                  webhookUrl={webhookUrlFor(bot.id, secret)}
                  rooms={textRooms}
                  defaultRoomId={bot.default_room_id}
                  onClose={() => setBuilderFor(null)}
                />
              )}
              {builderFor === bot.id && !secret && (
                <p className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-[11px] text-muted-foreground">
                  <Eye className="h-3.5 w-3.5" /> Regenerate the secret first — test sends need the webhook URL.
                </p>
              )}
            </div>
          );
        })}
      </div>
      {list.isSuccess && (list.data ?? []).length === 0 && (
        <p className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-muted-foreground">
          No webhook bots yet. Create one above to post embeds.
        </p>
      )}
      {list.data?.some((b) => revealed[b.id]) && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Check className="h-3.5 w-3.5 text-[#c8ff3d]" /> URLs stay visible until you leave this screen.
        </p>
      )}
    </section>
  );
}
