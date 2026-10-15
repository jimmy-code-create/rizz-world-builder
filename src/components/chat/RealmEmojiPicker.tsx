import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Smile, Sticker, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { toast } from "@/lib/toast";

type RealmEmojiPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  realmId: string;
  /** Inserts `:name:` or emoji char into the composer. */
  onPick: (token: string) => void;
  /** Moderators may add and remove emoji for the whole realm. */
  canManage: boolean;
};

const STANDARD_EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🥹", "😊", "😇", "🙂", "🙃", "😉",
  "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐",
  "🤓", "😎", "🥸", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣",
  "😖", "😫", "😩", "🥺", "😢", "😭", "😮‍💨", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵",
  "🥶", "😱", "😨", "😰", "😥", "😓", "🫣", "🤗", "🫡", "🤔", "🫢", "🤭", "🤫", "🤥",
  "😶", "😐", "😑", "😬", "🫠", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤",
  "😪", "😵", "😵‍💫", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "😈",
  "👿", "👹", "👺", "🤡", "💩", "👻", "💀", "☠️", "👽", "👾", "🤖", "🎃",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕",
  "💞", "💓", "💗", "💖", "💘", "💝", "💟", "🔥", "✨", "🌟", "💫", "💥", "💯", "💢",
  "👍", "👎", "👊", "✊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💪",
  "👑", "💎", "🎉", "🎊", "🎈", "🎁", "🏆", "🥇", "🥈", "🥉", "🍕", "🍔", "🍟", "🍻"
];

/**
 * The realm's emoji picker with comfortable medium-sized emojis and custom realm stickers.
 */
export function RealmEmojiPicker({ open, onOpenChange, realmId, onPick, canManage }: RealmEmojiPickerProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [tab, setTab] = useState<"standard" | "custom">("standard");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const emoji = useQuery({
    queryKey: realmEmojiKey(realmId),
    enabled: open && !!realmId,
    queryFn: () => fetchRealmEmoji(realmId),
  });

  useEffect(() => {
    if (!open) { setName(""); setAdding(false); }
  }, [open]);

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="glass-strong max-h-[72dvh] rounded-t-3xl border-white/10 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:max-w-md sm:mx-auto"
      >
        <SheetHeader className="px-1 text-left">
          <SheetTitle className="flex items-center justify-between font-display text-base">
            <span className="flex items-center gap-2">
              <Smile className="h-4 w-4 text-primary" /> Emojis
            </span>
            <div className="flex gap-1 rounded-xl bg-white/[0.06] p-1 border border-white/10">
              <button
                type="button"
                onClick={() => setTab("standard")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  tab === "standard" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-white"
                }`}
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => setTab("custom")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                  tab === "custom" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-white"
                }`}
              >
                <Sticker className="h-3 w-3" /> Custom ({rows.length})
              </button>
            </div>
          </SheetTitle>
        </SheetHeader>

        {tab === "standard" && (
          <div className="mt-3 grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-[50dvh] overflow-y-auto p-1">
            {STANDARD_EMOJIS.map((char) => (
              <button
                key={char}
                type="button"
                onClick={() => { onPick(char); onOpenChange(false); }}
                className="grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-2xl transition-transform hover:scale-115 active:scale-95 hover:bg-white/10"
                aria-label={`Emoji ${char}`}
              >
                <span className="leading-none">{char}</span>
              </button>
            ))}
          </div>
        )}

        {tab === "custom" && (
          <div className="mt-3 space-y-3">
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
                    onClick={() => { onPick(`:${entry.name}:`); onOpenChange(false); }}
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
        )}
      </SheetContent>
    </Sheet>
  );
}
