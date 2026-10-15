import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import {
  deleteRealmEmoji,
  fetchRealmEmoji,
  realmEmojiKey,
  saveRealmEmoji,
  uploadRealmEmoji,
} from "@/lib/realm-emoji";
import { toast } from "sonner";

/**
 * The realm's custom emoji grid, rendered as the "Realm" tab inside the
 * shared GifPicker — one picker for standard emoji, GIFs, stickers and
 * realm custom emoji instead of two overlapping emoji buttons.
 */
export function RealmCustomEmojiTab({
  realmId,
  onPick,
  canManage,
}: {
  realmId: string;
  /** Inserts the `:name:` token into the composer (caller closes the sheet). */
  onPick: (token: string) => void;
  /** Moderators may add and remove emoji for the whole realm. */
  canManage: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const emoji = useQuery({
    queryKey: realmEmojiKey(realmId),
    enabled: !!realmId,
    queryFn: () => fetchRealmEmoji(realmId),
  });

  const rows = emoji.data ?? [];

  const addFrom = async (file: File) => {
    const clean = name.trim().toLowerCase();
    if (!/^[a-z0-9_]{2,32}$/.test(clean)) {
      toast.error("Names use a-z, 0-9 and _ (2 to 32 characters)");
      return;
    }
    if (!user) return;
    setBusy(true);
    try {
      const url = await uploadRealmEmoji(file, user.id, clean);
      await saveRealmEmoji({ realmId, name: clean, url });
      toast.success(`:${clean}: added`);
      setName("");
      setAdding(false);
      if (fileRef.current) fileRef.current.value = "";
      await qc.invalidateQueries({ queryKey: realmEmojiKey(realmId) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't add that emoji");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string, emojiName: string) => {
    try {
      await deleteRealmEmoji(id);
      await qc.invalidateQueries({ queryKey: realmEmojiKey(realmId) });
      toast.success(`:${emojiName}: removed`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't remove that emoji");
    }
  };

  return (
    <div className="space-y-3">
      {emoji.isLoading && (
        <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      )}
      {!emoji.isLoading && rows.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {canManage ? "No custom realm emoji yet — add the first one below." : "This realm has no custom emoji yet."}
        </p>
      )}

      <div className="flex flex-wrap gap-2.5 max-h-[42dvh] overflow-y-auto p-1">
        {rows.map((entry) => (
          <span key={entry.id} className="group relative">
            <button
              type="button"
              onClick={() => onPick(`:${entry.name}:`)}
              className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition-all hover:bg-white/10 hover:scale-105"
              title={`:${entry.name}:`}
            >
              <img src={entry.url} alt={`:${entry.name}:`} loading="lazy" className="h-10 w-10 object-contain" />
            </button>
            {canManage && (
              <button
                type="button"
                onClick={() => void remove(entry.id, entry.name)}
                aria-label={`Remove :${entry.name}:`}
                className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 place-items-center rounded-full border border-white/10 bg-background text-destructive group-hover:grid"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
      </div>

      {canManage && !adding && (
        <Button
          variant="outline"
          size="sm"
          className="glass mt-2 border-white/10"
          onClick={() => setAdding(true)}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add custom emoji
        </Button>
      )}

      {canManage && adding && (
        <div className="mt-2 space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="name (a-z, 0-9, _)"
              maxLength={32}
              className="glass border-white/10"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/webp,image/jpeg,image/gif"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void addFrom(file);
              }}
            />
            <Button
              size="sm"
              disabled={busy}
              className="bg-primary text-primary-foreground border-0 shadow-md"
              onClick={() => fileRef.current?.click()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Choose image"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            PNG, WebP, JPG or GIF up to 3 MB. The name is what people type between colons.
          </p>
        </div>
      )}
    </div>
  );
}
