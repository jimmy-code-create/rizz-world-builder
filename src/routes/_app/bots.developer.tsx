import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Bot as BotIcon,
  Check,
  Copy,
  KeyRound,
  Link2,
  Plus,
  RefreshCw,
  Trash2,
  Webhook,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import {
  createCustomBot,
  deleteBotCommand,
  deleteCustomBot,
  fetchMyBots,
  myBotsKey,
  regenerateBotToken,
  registerBotCommand,
  setBotPublic,
  updateCustomBot,
  type BotDelivery,
  type OwnedBot,
} from "@/lib/bots";
import type { SlashCommandOption, SlashCommandOptionType } from "@/lib/bot-commands";

/**
 * /bots/developer — build a custom bot.
 *
 * A bot is created here, then installed into a realm with the Manage Bots
 * permission (see +Bots inside a realm, or the Directory tab). Everything on this
 * page is owner-only: the RPCs behind it re-check `owner_id = auth.uid()`.
 *
 * Token handling: the browser generates the token, only its sha256 reaches the
 * database, and the plaintext value is shown exactly once — here, right after
 * creating or regenerating it.
 */
export const Route = createFileRoute("/_app/bots/developer")({
  head: () => ({ meta: [{ title: "Bot developer · RIZZ" }] }),
  component: BotDeveloperPage,
});

const DELIVERY_LABEL: Record<BotDelivery, string> = {
  webhook: "Webhook — RIZZ POSTs each interaction to your URL",
  gateway: "Gateway — your worker polls for interactions",
};

type Draft = {
  botId: string | null;
  name: string;
  description: string;
  avatarUrl: string;
  delivery: BotDelivery;
  webhookUrl: string;
};

const EMPTY_DRAFT: Draft = {
  botId: null,
  name: "",
  description: "",
  avatarUrl: "",
  delivery: "webhook",
  webhookUrl: "",
};

function BotDeveloperPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [freshToken, setFreshToken] = useState<{ name: string; token: string } | null>(null);
  const [commandFor, setCommandFor] = useState<OwnedBot | null>(null);

  const bots = useQuery({
    queryKey: myBotsKey,
    enabled: !!user,
    queryFn: fetchMyBots,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: myBotsKey });

  const saveDraft = async () => {
    if (!draft) return;
    if (draft.name.trim().length < 2) {
      toast.error("Give your bot a name of at least 2 characters");
      return;
    }
    if (draft.delivery === "webhook" && !/^https:\/\//.test(draft.webhookUrl.trim())) {
      toast.error("A webhook bot needs an https:// URL");
      return;
    }

    setSaving(true);
    try {
      if (draft.botId) {
        await updateCustomBot({
          botId: draft.botId,
          name: draft.name,
          description: draft.description,
          avatarUrl: draft.avatarUrl || null,
          delivery: draft.delivery,
          webhookUrl: draft.webhookUrl || null,
        });
        toast.success("Bot saved");
        setDraft(null);
      } else {
        const created = await createCustomBot({
          name: draft.name,
          description: draft.description,
          avatarUrl: draft.avatarUrl || null,
          delivery: draft.delivery,
          webhookUrl: draft.webhookUrl || null,
        });
        setDraft(null);
        // The token exists only in this browser and only for this render.
        setFreshToken({ name: draft.name.trim(), token: created.token });
      }
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save that bot");
    } finally {
      setSaving(false);
    }
  };

  const runBotAction = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    try {
      await action();
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That didn't work");
    } finally {
      setBusy(null);
    }
  };

  const onRegenerate = async (bot: OwnedBot) => {
    await runBotAction(`token:${bot.bot_id}`, async () => {
      const token = await regenerateBotToken(bot.bot_id);
      setFreshToken({ name: bot.name, token });
      toast.success("New token ready — copy it now");
    });
  };

  if (loading) {
    return <div className="h-32 animate-pulse rounded-3xl glass" aria-busy="true" />;
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-white/10 glass p-5 text-sm text-muted-foreground">
        <p className="font-display text-lg font-bold text-foreground">Sign in to build a bot</p>
        <p className="mt-1">Bots belong to an account, so you need one before you can create one.</p>
        <Button asChild className="mt-4 h-11 border-0 bg-gradient-primary text-primary-foreground">
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  const myBots = bots.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Your bots</h2>
          <p className="text-xs text-muted-foreground">
            {myBots.length}/10 created. Install one into a realm to bring it online.
          </p>
        </div>
        <Button
          type="button"
          className="h-11 shrink-0 gap-1.5 border-0 bg-gradient-primary text-primary-foreground"
          onClick={() => setDraft({ ...EMPTY_DRAFT })}
        >
          <Plus className="h-4 w-4" /> New bot
        </Button>
      </div>

      {bots.isLoading && (
        <div className="space-y-3" aria-busy="true">
          {[0, 1].map((row) => (
            <div key={row} className="h-28 animate-pulse rounded-3xl bg-white/5" />
          ))}
        </div>
      )}

      {bots.isError && (
        <div role="alert" className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
          <p className="font-semibold">Couldn&apos;t load your bots</p>
          <p className="mt-1 text-amber-100/85">
            {(bots.error instanceof Error && bots.error.message) ||
              "Apply the latest Supabase migration, then try again."}
          </p>
          <Button
            variant="outline"
            className="mt-3 h-11 w-full border-amber-300/40 bg-transparent text-amber-100 hover:bg-amber-300/10"
            onClick={() => void bots.refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      {!bots.isLoading && !bots.isError && myBots.length === 0 && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="font-display font-bold">No bots yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A bot answers slash commands inside realms where it is installed. Create one, register a
            command like /ping, and point it at a webhook — or poll for interactions if you run your
            own worker.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {myBots.map((bot, index) => (
          <motion.li
            key={bot.bot_id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.03, 0.2) }}
            className="rounded-3xl border border-white/10 glass p-4"
          >
            <div className="flex items-start gap-3">
              <Avatar className="h-12 w-12 shrink-0 ring-1 ring-white/10">
                <AvatarImage src={bot.avatar_url ?? undefined} alt="" />
                <AvatarFallback className="bg-gradient-primary font-bold text-primary-foreground">
                  {bot.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-display font-bold">
                  {bot.name}
                  {bot.is_public && (
                    <span className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wider text-emerald-200">
                      Listed
                    </span>
                  )}
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                  {bot.description || "No description yet."}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {bot.delivery === "webhook" ? "Webhook" : "Gateway"}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono">{bot.token_prefix}</span>
                  <span>
                    {bot.installs} {bot.installs === 1 ? "install" : "installs"}
                  </span>
                </p>
              </div>
            </div>

            {bot.commands.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {bot.commands.map((command) => (
                  <span
                    key={command.id}
                    title={command.description}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-foreground/80"
                  >
                    /{command.name}
                    <button
                      type="button"
                      aria-label={`Remove /${command.name}`}
                      disabled={busy === `cmd:${command.id}`}
                      onClick={() =>
                        void runBotAction(`cmd:${command.id}`, async () => {
                          await deleteBotCommand(bot.bot_id, command.id);
                          toast.success(`/${command.name} removed`);
                        })
                      }
                      className="text-muted-foreground transition-colors hover:text-destructive"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 border-white/10 bg-white/5"
                onClick={() => setCommandFor(bot)}
              >
                <Plus className="h-4 w-4" /> Command
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 border-white/10 bg-white/5"
                onClick={() =>
                  setDraft({
                    botId: bot.bot_id,
                    name: bot.name,
                    description: bot.description,
                    avatarUrl: bot.avatar_url ?? "",
                    delivery: bot.delivery,
                    webhookUrl: bot.webhook_url ?? "",
                  })
                }
              >
                Edit
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy === `token:${bot.bot_id}`}
                className="h-10 border-white/10 bg-white/5"
                onClick={() => void onRegenerate(bot)}
              >
                <RefreshCw className="h-4 w-4" /> New token
              </Button>

              <label className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
                List in directory
                <Switch
                  checked={bot.is_public}
                  disabled={busy === `public:${bot.bot_id}`}
                  aria-label={`List ${bot.name} in the bot directory`}
                  onCheckedChange={(next) =>
                    void runBotAction(`public:${bot.bot_id}`, async () => {
                      await setBotPublic(bot.bot_id, next);
                      toast.success(next ? "Anyone can find it now" : "Hidden from the directory");
                    })
                  }
                />
              </label>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy === `delete:${bot.bot_id}`}
                className="h-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() =>
                  void runBotAction(`delete:${bot.bot_id}`, async () => {
                    await deleteCustomBot(bot.bot_id);
                    toast.success(`${bot.name} deleted`);
                  })
                }
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </div>
          </motion.li>
        ))}
      </ul>

      <ApiDocsCard />

      <BotFormDialog
        draft={draft}
        saving={saving}
        onChange={setDraft}
        onClose={() => setDraft(null)}
        onSave={() => void saveDraft()}
      />

      <CommandDialog
        bot={commandFor}
        onClose={() => setCommandFor(null)}
        onSave={async (input) => {
          if (!commandFor) return;
          await registerBotCommand({ botId: commandFor.bot_id, ...input });
          await refresh();
          toast.success(`/${input.name} registered`);
          setCommandFor(null);
        }}
      />

      <TokenDialog token={freshToken} onClose={() => setFreshToken(null)} />
    </div>
  );
}

// ------------------------------------------------------------------ dialogs

function BotFormDialog({
  draft,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  draft: Draft | null;
  saving: boolean;
  onChange: (draft: Draft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const update = (patch: Partial<Draft>) => onChange({ ...(draft as Draft), ...patch });

  return (
    <Dialog open={!!draft} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="glass-strong max-h-[88dvh] overflow-y-auto border-white/10">
        <DialogHeader>
          <DialogTitle className="font-display">
            {draft?.botId ? "Edit bot" : "Create a bot"}
          </DialogTitle>
        </DialogHeader>

        {draft && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="bot-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Name
              </label>
              <Input
                id="bot-name"
                value={draft.name}
                maxLength={32}
                onChange={(event) => update({ name: event.target.value })}
                placeholder="Ping Bot"
                className="glass border-white/10"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="bot-description" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Description
              </label>
              <Textarea
                id="bot-description"
                value={draft.description}
                maxLength={200}
                rows={2}
                onChange={(event) => update({ description: event.target.value })}
                placeholder="What does it do?"
                className="glass border-white/10"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="bot-avatar" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Avatar URL (optional)
              </label>
              <Input
                id="bot-avatar"
                value={draft.avatarUrl}
                onChange={(event) => update({ avatarUrl: event.target.value })}
                placeholder="https://…"
                className="glass border-white/10"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Delivery
              </span>
              <Select
                value={draft.delivery}
                onValueChange={(value) => update({ delivery: value as BotDelivery })}
              >
                <SelectTrigger className="glass h-11 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DELIVERY_LABEL) as BotDelivery[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {DELIVERY_LABEL[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="bot-webhook" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {draft.delivery === "webhook" ? "Webhook URL" : "Webhook URL (optional)"}
              </label>
              <Input
                id="bot-webhook"
                value={draft.webhookUrl}
                onChange={(event) => update({ webhookUrl: event.target.value })}
                placeholder="https://your-bot.example.com/rizz"
                className="glass border-white/10"
              />
              <p className="text-[11px] text-muted-foreground">
                Only https URLs are accepted, and the URL is never exposed to other members.
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1 border-white/10 bg-white/5"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="h-11 flex-1 border-0 bg-gradient-primary text-primary-foreground"
                onClick={onSave}
                disabled={saving}
              >
                {saving ? "Saving…" : draft.botId ? "Save changes" : "Create bot"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

type OptionDraft = SlashCommandOption & { type: SlashCommandOptionType };

function CommandDialog({
  bot,
  onClose,
  onSave,
}: {
  bot: OwnedBot | null;
  onClose: () => void;
  onSave: (input: { name: string; description: string; options: SlashCommandOption[] }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState<OptionDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName("");
    setDescription("");
    setOptions([]);
  };

  const submit = async () => {
    const clean = name.trim().toLowerCase().replace(/^\//, "");
    if (!/^[a-z0-9_-]{1,32}$/.test(clean)) {
      toast.error("Command names are 1-32 characters: a-z, 0-9, _ and -");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: clean,
        description: description.trim(),
        options: options
          .filter((option) => option.name.trim())
          .map((option) => ({
            name: option.name.trim().toLowerCase(),
            description: option.description?.trim() || undefined,
            type: option.type,
            required: option.required !== false,
          })),
      });
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't register that command");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={!!bot}
      onOpenChange={(open) => {
        if (!open) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="glass-strong max-h-[88dvh] overflow-y-auto border-white/10">
        <DialogHeader>
          <DialogTitle className="font-display">New command for {bot?.name ?? "bot"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="cmd-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Command
            </label>
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg text-[var(--rizz-pink)]">/</span>
              <Input
                id="cmd-name"
                value={name}
                maxLength={32}
                onChange={(event) => setName(event.target.value)}
                placeholder="ping"
                className="glass border-white/10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cmd-description" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Description
            </label>
            <Input
              id="cmd-description"
              value={description}
              maxLength={160}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Pong and a little attitude"
              className="glass border-white/10"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Arguments
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 border-white/10 bg-white/5"
                onClick={() =>
                  setOptions((current) => [...current, { name: "", type: "string", required: true }])
                }
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>

            {options.length === 0 && (
              <p className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[11px] text-muted-foreground">
                No arguments. Members can still type extra words after the command — they arrive as
                the raw argument string.
              </p>
            )}

            {options.map((option, index) => (
              <div key={index} className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={option.name}
                    maxLength={32}
                    placeholder="argument name"
                    aria-label={`Argument ${index + 1} name`}
                    onChange={(event) =>
                      setOptions((current) =>
                        current.map((entry, i) => (i === index ? { ...entry, name: event.target.value } : entry)),
                      )
                    }
                    className="glass h-10 border-white/10"
                  />
                  <Select
                    value={option.type ?? "string"}
                    onValueChange={(value) =>
                      setOptions((current) =>
                        current.map((entry, i) =>
                          i === index ? { ...entry, type: value as SlashCommandOptionType } : entry,
                        ),
                      )
                    }
                  >
                    <SelectTrigger className="glass h-10 w-32 border-white/10" aria-label="Argument type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">text</SelectItem>
                      <SelectItem value="user">member</SelectItem>
                      <SelectItem value="number">number</SelectItem>
                      <SelectItem value="boolean">yes/no</SelectItem>
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    aria-label={`Remove argument ${index + 1}`}
                    onClick={() => setOptions((current) => current.filter((_, i) => i !== index))}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    value={option.description ?? ""}
                    maxLength={100}
                    placeholder="Shown under the command"
                    aria-label={`Argument ${index + 1} description`}
                    onChange={(event) =>
                      setOptions((current) =>
                        current.map((entry, i) =>
                          i === index ? { ...entry, description: event.target.value } : entry,
                        ),
                      )
                    }
                    className="glass h-10 border-white/10"
                  />
                  <label className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
                    Required
                    <Switch
                      checked={option.required !== false}
                      aria-label={`Argument ${index + 1} is required`}
                      onCheckedChange={(next) =>
                        setOptions((current) =>
                          current.map((entry, i) => (i === index ? { ...entry, required: next } : entry)),
                        )
                      }
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 border-white/10 bg-white/5"
              onClick={() => { reset(); onClose(); }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-11 flex-1 border-0 bg-gradient-primary text-primary-foreground"
              onClick={() => void submit()}
              disabled={saving}
            >
              {saving ? "Saving…" : "Register command"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TokenDialog({
  token,
  onClose,
}: {
  token: { name: string; token: string } | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Dialog open={!!token} onOpenChange={(open) => { if (!open) { setCopied(false); onClose(); } }}>
      <DialogContent className="glass-strong border-white/10">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-[var(--rizz-pink)]" /> {token?.name} token
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Copy this now. It is hashed in the database and cannot be shown again — if you lose it,
          generate a new one.
        </p>

        <code className="block break-all rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs text-foreground">
          {token?.token}
        </code>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 border-white/10 bg-white/5"
            onClick={() => {
              if (!token) return;
              void navigator.clipboard.writeText(token.token).then(
                () => { setCopied(true); toast.success("Token copied"); },
                () => toast.error("Couldn't copy — select it manually"),
              );
            }}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy
          </Button>
          <Button
            type="button"
            className="h-11 flex-1 border-0 bg-gradient-primary text-primary-foreground"
            onClick={() => { setCopied(false); onClose(); }}
          >
            I saved it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- api docs

const ACTIONS: { action: string; detail: string }[] = [
  { action: "list_commands", detail: "Everything you registered, so you can sync your handler." },
  { action: "send_message", detail: "{ realm_id, realm_room_id?, body } — post in a channel." },
  { action: "edit_message", detail: "{ message_id, body } — only messages this bot sent." },
  { action: "delete_message", detail: "{ message_id } — only messages this bot sent." },
  { action: "add_reaction", detail: "{ message_id, emoji }" },
  { action: "remove_reaction", detail: "{ message_id, emoji }" },
  { action: "respond", detail: "{ interaction_id, body } — answer a slash command." },
  { action: "poll_interactions", detail: "Gateway bots only: pull the pending queue." },
];

function ApiDocsCard() {
  const [action, setAction] = useState<string>("respond");
  const sample = `curl -X POST ${"https://rizzapp.onrender.com"}/api/bot \\
  -H "Authorization: Bearer $RIZZ_BOT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({ action, payload: payloadFor(action) }, null, 0)}'`;

  return (
    <section className="rounded-3xl border border-white/10 glass p-4">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <Webhook className="h-5 w-5 text-[var(--rizz-violet)]" /> Talking to RIZZ
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        One endpoint, one header. Everything else lives in your bot.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {ACTIONS.map((entry) => (
          <button
            key={entry.action}
            type="button"
            aria-pressed={action === entry.action}
            onClick={() => setAction(entry.action)}
            className={`rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors ${
              action === entry.action
                ? "border-[var(--rizz-pink)]/50 bg-[var(--rizz-pink)]/15 text-foreground"
                : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
            }`}
          >
            {entry.action}
          </button>
        ))}
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        {ACTIONS.find((entry) => entry.action === action)?.detail}
      </p>

      <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-foreground/85">
        {sample}
      </pre>

      <div className="mt-3 space-y-2 text-[11px] text-muted-foreground">
        <p className="flex items-start gap-2">
          <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          A webhook interaction arrives as
          <code className="font-mono">{"{ type, interaction_id, command, args, realm_id, realm_room_id, user_id }"}</code>
          . Answer it with <code className="font-mono">respond</code> within 15 minutes.
        </p>
        <p className="flex items-start gap-2">
          <BotIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Your bot only works in realms where it is installed and enabled, and it is rate limited
          per token — 60 calls a minute.
        </p>
      </div>
    </section>
  );
}

function payloadFor(action: string): Record<string, unknown> {
  switch (action) {
    case "send_message":
      return { realm_id: "<realm id>", body: "Hello from my bot" };
    case "edit_message":
      return { message_id: "<message id>", body: "Edited" };
    case "delete_message":
      return { message_id: "<message id>" };
    case "add_reaction":
    case "remove_reaction":
      return { message_id: "<message id>", emoji: "🔥" };
    case "respond":
      return { interaction_id: "<interaction id>", body: "Pong 🏓" };
    case "list_commands":
    case "poll_interactions":
      return {};
    default:
      return {};
  }
}
