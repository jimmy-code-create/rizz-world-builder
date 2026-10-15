import { useMemo, useState } from "react";
import { Minus, Paintbrush, Plus, Send, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RealmRoom } from "@/lib/realms";
import { EMBED_LIMITS, emptyEmbed, sanitizeEmbed, type EmbedData } from "@/lib/embeds";
import { Embed } from "@/components/chat/Embed";
import { sendWebhookTest } from "@/lib/webhook-bots";

/**
 * Embed builder with live preview: every embed part editable, hex color
 * picker, add/remove fields, character counters, and "Send test" to a picked
 * channel. Validation messages name the exact field; errors are small toasts.
 */
export function EmbedBuilder({
  webhookUrl,
  rooms,
  defaultRoomId,
  onClose,
}: {
  webhookUrl: string;
  rooms: RealmRoom[];
  defaultRoomId: string | null;
  onClose: () => void;
}) {
  const [content, setContent] = useState("");
  const [embeds, setEmbeds] = useState<EmbedData[]>([emptyEmbed()]);
  const [roomId, setRoomId] = useState<string>(defaultRoomId ?? "");
  const [sending, setSending] = useState(false);

  const patch = (index: number, next: EmbedData) => {
    setEmbeds((all) => all.map((e, i) => (i === index ? next : e)));
  };

  const preview = useMemo(
    () =>
      embeds.map((raw, i) => {
        const clean = sanitizeEmbed({ ...raw, fields: (raw.fields ?? []).filter((f) => f.name || f.value) });
        return { index: i, embed: clean.embed ?? null };
      }),
    [embeds],
  );

  const sendTest = async () => {
    setSending(true);
    try {
      const clean = embeds.flatMap((raw) => {
        const out = sanitizeEmbed({ ...raw, fields: (raw.fields ?? []).filter((f) => f.name || f.value) });
        if (out.error) throw new Error(out.error);
        return out.embed ? [out.embed] : [];
      });
      await sendWebhookTest({ webhookUrl, content, embeds: clean, roomId: roomId || null });
      toast.success("Test sent — check the channel");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The test message didn't go through");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-[#c8ff3d]/30 bg-black/30 p-3">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-sm font-bold">Embed builder</p>
        <Button type="button" size="sm" variant="ghost" onClick={onClose} aria-label="Close builder" className="h-9">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={EMBED_LIMITS.content}
        placeholder="Message text (optional)"
        aria-label="Test message text"
        className="h-11"
      />

      {embeds.map((embed, i) => (
        <EmbedForm
          key={i}
          index={i}
          embed={embed}
          onPatch={(next) => patch(i, next)}
          onRemove={embeds.length > 1 ? () => setEmbeds((all) => all.filter((_, j) => j !== i)) : undefined}
        />
      ))}
      {embeds.length < EMBED_LIMITS.perMessage && (
        <Button
          type="button" size="sm" variant="outline"
          onClick={() => setEmbeds((all) => [...all, emptyEmbed()])}
          className="h-11 w-full gap-1.5"
        >
          <Plus className="h-4 w-4" /> Add embed ({embeds.length}/{EMBED_LIMITS.perMessage})
        </Button>
      )}

      {/* Live preview */}
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Live preview</p>
        {preview.every((p) => !p.embed) && (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-muted-foreground">
            Fill in a title, description or field to see the card.
          </p>
        )}
        {preview.map((p) => (p.embed ? <Embed key={p.index} embed={p.embed} /> : null))}
      </div>

      <label className="flex min-h-[44px] items-center gap-2 text-xs text-muted-foreground">
        <span className="shrink-0 font-semibold">Send test to</span>
        <select
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          aria-label="Test channel"
          className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-transparent px-2 text-sm text-foreground"
        >
          <option value="">Main channel</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>#{room.name}</option>
          ))}
        </select>
      </label>
      <Button
        type="button" onClick={() => void sendTest()} disabled={sending}
        className="h-11 w-full gap-1.5 bg-primary text-primary-foreground"
      >
        <Send className="h-4 w-4" /> {sending ? "Sending…" : "Send test to channel"}
      </Button>
    </div>
  );
}

function EmbedForm({
  index,
  embed,
  onPatch,
  onRemove,
}: {
  index: number;
  embed: EmbedData;
  onPatch: (next: EmbedData) => void;
  onRemove?: () => void;
}) {
  const set = (part: Partial<EmbedData>) => onPatch({ ...embed, ...part });
  const fields = embed.fields ?? [];
  const setField = (fi: number, part: Partial<{ name: string; value: string; inline?: boolean }>) => {
    onPatch({ ...embed, fields: fields.map((f, j) => (j === fi ? { ...f, ...part } : f)) });
  };

  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-xs font-bold">Embed {index + 1}</p>
        {onRemove && (
          <Button type="button" size="sm" variant="ghost" onClick={onRemove} aria-label={`Remove embed ${index + 1}`} className="h-9 text-rose-300">
            <Minus className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Input value={embed.title ?? ""} onChange={(e) => set({ title: e.target.value })} maxLength={EMBED_LIMITS.title} placeholder="Title" aria-label="Embed title" className="h-11" />
      <Input value={embed.url ?? ""} onChange={(e) => set({ url: e.target.value })} placeholder="Title link (https, optional)" aria-label="Embed title link" className="h-11" inputMode="url" />
      <textarea
        value={embed.description ?? ""}
        onChange={(e) => set({ description: e.target.value })}
        maxLength={EMBED_LIMITS.description}
        placeholder="Description"
        aria-label="Embed description"
        rows={2}
        className="min-h-11 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <div className="flex items-center gap-2">
        <Paintbrush className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(embed.color ?? "") ? embed.color : "#c8ff3d"}
          onChange={(e) => set({ color: e.target.value })}
          aria-label="Embed bar color"
          className="h-11 w-12 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-transparent"
        />
        <Input
          value={embed.color ?? ""}
          onChange={(e) => set({ color: e.target.value })}
          placeholder="#c8ff3d"
          aria-label="Embed bar color hex"
          maxLength={7}
          className="h-11 font-mono"
        />
      </div>
      <Input value={embed.image?.url ?? ""} onChange={(e) => set({ image: e.target.value ? { url: e.target.value } : undefined })} placeholder="Big image URL (https, optional)" aria-label="Embed image URL" className="h-11" inputMode="url" />
      <div className="grid grid-cols-2 gap-2">
        <Input value={embed.thumbnail?.url ?? ""} onChange={(e) => set({ thumbnail: e.target.value ? { url: e.target.value } : undefined })} placeholder="Thumbnail (https)" aria-label="Embed thumbnail URL" className="h-11" inputMode="url" />
        <Input value={embed.footer?.text ?? ""} onChange={(e) => set({ footer: { ...embed.footer, text: e.target.value } })} maxLength={EMBED_LIMITS.footer} placeholder="Footer" aria-label="Embed footer" className="h-11" />
      </div>

      {/* Fields */}
      {fields.map((field, fi) => (
        <div key={fi} className="space-y-1.5 rounded-lg border border-white/5 p-2">
          <div className="flex items-center gap-1.5">
            <Input value={field.name} onChange={(e) => setField(fi, { name: e.target.value })} maxLength={EMBED_LIMITS.fieldName} placeholder="Field name" aria-label={`Field ${fi + 1} name`} className="h-10 flex-1" />
            <Button type="button" size="icon" variant="ghost" onClick={() => onPatch({ ...embed, fields: fields.filter((_, j) => j !== fi) })} aria-label={`Remove field ${fi + 1}`} className="h-10 w-10 shrink-0 text-rose-300">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Input value={field.value} onChange={(e) => setField(fi, { value: e.target.value })} maxLength={EMBED_LIMITS.fieldValue} placeholder="Field value" aria-label={`Field ${fi + 1} value`} className="h-10" />
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={!!field.inline} onChange={(e) => setField(fi, { inline: e.target.checked })} className="h-4 w-4 accent-[#c8ff3d]" />
            Inline (up to 3 per row)
          </label>
        </div>
      ))}
      {fields.length < EMBED_LIMITS.fields && (
        <Button
          type="button" size="sm" variant="ghost"
          onClick={() => onPatch({ ...embed, fields: [...fields, { name: "", value: "", inline: true }] })}
          className="h-11 w-full gap-1.5 text-muted-foreground"
        >
          <Plus className="h-4 w-4" /> Add field ({fields.length}/{EMBED_LIMITS.fields})
        </Button>
      )}
    </div>
  );
}
