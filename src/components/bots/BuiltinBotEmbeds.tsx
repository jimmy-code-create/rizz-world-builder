import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot as BotIcon, Eye, RotateCcw, Save, ShieldAlert } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Embed } from "@/components/chat/Embed";
import { EmbedForm } from "@/components/bots/EmbedBuilder";
import { supabase } from "@/integrations/supabase/client";
import { emptyEmbed, type EmbedData } from "@/lib/embeds";
import type { RealmRoom } from "@/lib/realms";
import {
  botTemplatesKey,
  fetchBotDefaultEmbed,
  fetchBotTemplates,
  renderEmbedPreview,
  resetBotEmbedTemplate,
  saveBotEmbedTemplate,
  sendBotEmbedTest,
  templateVarsFor,
  type TemplatePreviewVars,
} from "@/lib/bot-templates";

/**
 * Realm settings → Bots → built-in bot embeds.
 *
 * One row per built-in bot with an inline editor: the same form as webhook
 * embeds, the real variables chips, a live preview rendered by the very
 * <Embed> the chat shows, "Send test" to a picked channel, and "Reset to
 * default". Owners/admins only (the RPCs re-check server-side).
 */
export function BuiltinBotEmbeds({
  realmId,
  realmName,
  rooms,
  defaultRoomId,
  canManage,
  bots,
}: {
  realmId: string;
  realmName: string;
  rooms: RealmRoom[];
  defaultRoomId: string | null;
  canManage: boolean;
  bots: { bot_id: string; name: string }[];
}) {
  const qc = useQueryClient();
  const textRooms = useMemo(() => rooms.filter((room) => room.kind !== "voice"), [rooms]);
  const templates = useQuery({
    queryKey: botTemplatesKey(realmId),
    queryFn: () => fetchBotTemplates(realmId),
    staleTime: 30_000,
  });

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<EmbedData | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string>(defaultRoomId ?? "");
  const [me, setMe] = useState<{ display_name?: string | null; username?: string | null; avatar_url?: string | null } | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);

  // Preview context: the caller as "the user", real realm/channel/count where
  // possible, so the card looks exactly like what the bot will post.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const id = auth.user?.id;
        if (id) {
          const { data } = await supabase
            .from("profiles")
            .select("display_name, username, avatar_url")
            .eq("id", id)
            .maybeSingle();
          if (alive) setMe((data as typeof me) ?? null);
        }
      } catch {
        // Preview falls back to samples.
      }
      try {
        const { count } = await supabase
          .from("realm_members")
          .select("id", { count: "exact", head: true })
          .eq("realm_id", realmId);
        if (alive) setMemberCount(typeof count === "number" ? count : null);
      } catch {
        // Count is decorative in the preview.
      }
    })();
    return () => {
      alive = false;
    };
  }, [realmId]);

  const previewVars = useMemo<TemplatePreviewVars>(() => {
    const room = textRooms.find((r) => r.id === roomId) ?? textRooms.find((r) => r.id === defaultRoomId) ?? textRooms[0];
    return {
      user: me?.display_name || me?.username || "A new face",
      username: me?.username || "newmember",
      userAvatar: me?.avatar_url ?? "",
      realm: realmName,
      memberCount: String(memberCount ?? 1),
      date: new Date().toISOString(),
      channel: room?.name ?? "general",
    };
  }, [textRooms, roomId, defaultRoomId, me, memberCount, realmName]);

  const preview = useMemo(() => (draft ? renderEmbedPreview(draft, previewVars) : null), [draft, previewVars]);

  const templateFor = (botId: string) => templates.data?.find((row) => row.bot_id === botId) ?? null;

  async function openEditor(bot: { bot_id: string; name: string }) {
    setEditing(bot.bot_id);
    setLoadingDraft(true);
    setDraft(null);
    const row = templateFor(bot.bot_id);
    const initial = row?.embed ?? (await fetchBotDefaultEmbed(bot.bot_id)) ?? emptyEmbed();
    setDraft(initial);
    setLoadingDraft(false);
  }

  function closeEditor() {
    setEditing(null);
    setDraft(null);
  }

  async function saveEditor(bot: { bot_id: string; name: string }) {
    if (!draft) return;
    setBusy("save");
    try {
      await saveBotEmbedTemplate(bot.bot_id, realmId, draft);
      await qc.invalidateQueries({ queryKey: botTemplatesKey(realmId) });
      toast.success(`${bot.name}'s embed saved`);
      closeEditor();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save this embed");
    } finally {
      setBusy(null);
    }
  }

  async function resetEditor(bot: { bot_id: string; name: string }) {
    setBusy("reset");
    try {
      const fallback = await resetBotEmbedTemplate(bot.bot_id, realmId);
      await qc.invalidateQueries({ queryKey: botTemplatesKey(realmId) });
      setDraft(fallback ?? emptyEmbed());
      toast.success(fallback ? `${bot.name} is back to the default card` : `${bot.name} posts plain text again`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't reset this embed");
    } finally {
      setBusy(null);
    }
  }

  async function sendTest(bot: { bot_id: string; name: string }) {
    const target = roomId || defaultRoomId || textRooms[0]?.id;
    if (!target) {
      toast.error("Pick a channel for the test message");
      return;
    }
    setBusy("test");
    try {
      await sendBotEmbedTest(bot.bot_id, realmId, target);
      const room = textRooms.find((r) => r.id === target);
      toast.success(room ? `Test sent to #${room.name}` : "Test sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send the test message");
    } finally {
      setBusy(null);
    }
  }

  if (bots.length === 0) return null;

  return (
    <section className="mt-5">
      <h3 className="text-sm font-semibold">Bot message embeds</h3>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Give the built-in bots a signature card in this realm. WELCOME already greets new members
        with their avatar, a “Member #” footer and a “Say hi” button.
      </p>

      {templates.isLoading ? (
        <div className="mt-2 space-y-2" aria-busy="true">
          {[0, 1].map((row) => (
            <div key={row} className="h-14 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : templates.data === null ? (
        <p className="mt-2 flex items-start gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-[11px] text-amber-100">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Embeds for existing bots need the latest Supabase migration (bot_templates), then this
          section comes alive.
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          {bots.map((bot) => {
            const row = templateFor(bot.bot_id);
            const isEditing = editing === bot.bot_id;
            const status = row
              ? "Custom embed"
              : bot.name.trim().toUpperCase() === "WELCOME"
                ? "Default welcome card"
                : "Plain text";
            return (
              <div key={bot.bot_id} className="rounded-2xl border border-white/10 glass p-3">
                <div className="flex min-h-11 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/5 text-[#c8ff3d]">
                    <BotIcon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{bot.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{status}</p>
                  </div>
                  {canManage && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-11 shrink-0 border-white/10"
                      aria-expanded={isEditing}
                      onClick={() => {
                        if (isEditing) closeEditor();
                        else void openEditor(bot);
                      }}
                    >
                      {isEditing ? "Close" : "Edit embed"}
                    </Button>
                  )}
                </div>

                {isEditing && (
                  <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
                    {loadingDraft || !draft ? (
                      <div className="space-y-2" aria-busy="true">
                        {[0, 1, 2].map((index) => (
                          <div key={index} className="h-11 animate-pulse rounded-xl bg-white/5" />
                        ))}
                      </div>
                    ) : (
                      <>
                        <EmbedForm index={0} label={`${bot.name} card`} embed={draft} onPatch={setDraft} />

                        <div className="space-y-1.5">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Fills in when the bot posts
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {templateVarsFor(bot.name).map((token) => (
                              <code
                                key={token}
                                className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-muted-foreground"
                              >
                                {token}
                              </code>
                            ))}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Anything else stays exactly as typed. Text is plain, images must be https.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Live preview
                          </p>
                          {preview ? (
                            <Embed embed={preview} />
                          ) : (
                            <p className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-muted-foreground">
                              Add a title, description or field to see the card.
                            </p>
                          )}
                        </div>

                        <label className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
                          <span className="shrink-0 font-semibold">Send test to</span>
                          <select
                            value={roomId || defaultRoomId || textRooms[0]?.id || ""}
                            onChange={(event) => setRoomId(event.target.value)}
                            aria-label="Test channel"
                            className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-transparent px-2 text-sm text-foreground"
                          >
                            {textRooms.map((room) => (
                              <option key={room.id} value={room.id}>
                                #{room.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            className="h-11 min-w-[9rem] flex-1 gap-1.5 bg-primary text-primary-foreground"
                            disabled={busy === "save"}
                            onClick={() => void saveEditor(bot)}
                          >
                            <Save className="h-4 w-4" /> {busy === "save" ? "Saving…" : "Save embed"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-11 gap-1.5 border-white/10"
                            disabled={busy === "test"}
                            onClick={() => void sendTest(bot)}
                          >
                            <Eye className="h-4 w-4" /> {busy === "test" ? "Sending…" : "Send test"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-11 gap-1.5 text-muted-foreground"
                            disabled={busy === "reset"}
                            aria-label={`Reset ${bot.name} to the default`}
                            onClick={() => void resetEditor(bot)}
                          >
                            <RotateCcw className="h-4 w-4" /> Reset
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
