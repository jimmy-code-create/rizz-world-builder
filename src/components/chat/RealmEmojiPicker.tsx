import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Smile, Sticker, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { deleteRealmEmoji } from "@/lib/realm-emoji";
import {
  invalidateAvailableEmojis,
  useAvailableEmojis,
  useUploadEmoji,
} from "@/lib/emoji-available";
import { RizzEmojiPanel } from "@/components/emoji/RizzEmojiPanel";
import { toast } from "@/lib/toast";

type RealmEmojiPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  realmId: string;
  /** Inserts the emoji token into the composer. */
  onPick: (token: string) => void;
  /** Moderators may add and remove emoji for the whole realm. */
  canManage: boolean;
};

/**
 * The realm's emoji sheet: the shared Fluent smiley panel plus this realm's
 * custom emoji and the upload/delete controls.
 *
 * Uploads show the file immediately (the optimistic row is written before the
 * request leaves), and a failure removes that row and prints the server's own
 * message. The list itself is the shared `/api/emojis/available` cache, so a
 * new emoji is in every picker — DM included — without a reload.
 */
export function RealmEmojiPicker({
  open,
  onOpenChange,
  realmId,
  onPick,
  canManage,
}: RealmEmojiPickerProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [tab, setTab] = useState<"standard" | "custom">("standard");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const available = useAvailableEmojis();
  const upload = useUploadEmoji();

  const realmSection = available.data?.realms.find((realm) => realm.id === realmId);
  const rows = realmSection?.emojis ?? [];

  useEffect(() => {
    if (!open) {
      setName("");
      setAdding(false);
    }
  }, [open]);

  const addFrom = async (file: File) => {
    const clean = name.trim().toLowerCase();
    if (!/^[a-z0-9_]{2,32}$/.test(clean)) {
      toast.error("Names use a-z, 0-9 and _ (2 to 32 characters)");
      return;
    }
    if (!/^image\/(png|jpe?g|gif|webp)$/.test(file.type)) {
      toast.error("Emoji must be a PNG, JPG, GIF or WebP image.");
      return;
    }
    if (file.size > 256 * 1024) {
      toast.error("That image is larger than 256 KB — shrink it and try again.");
      return;
    }
    if (!user) return;

    setBusy(true);
    setName("");
    setAdding(false);
    upload.mutate(
      {
        realmId,
        file,
        name: clean,
        animated: /^image\/(gif|webp)$/.test(file.type),
      },
      {
        onSuccess: () => toast.success(`:${clean}: added`),
        onError: (error) => {
          // The optimistic tile is already gone (the mutation's onError rolls it
          // back); the toast carries the server's own reason.
          toast.error(error instanceof Error ? error.message : "Couldn't add that emoji");
        },
        onSettled: () => {
          setBusy(false);
          if (fileRef.current) fileRef.current.value = "";
        },
      },
    );
  };

  const remove = async (id: string, emojiName: string) => {
    try {
      await deleteRealmEmoji(id);
      invalidateAvailableEmojis(qc);
      toast.success(`:${emojiName}: removed`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't remove that emoji");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="glass-strong max-h-[72dvh] rounded-t-3xl border-white/10 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:mx-auto sm:max-w-md"
      >
        <SheetHeader className="px-1 text-left">
          <SheetTitle className="flex items-center justify-between font-display text-base">
            <span className="flex items-center gap-2">
              <Smile className="h-4 w-4 text-primary" /> Emojis
            </span>
            <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.06] p-1">
              <button
                type="button"
                onClick={() => setTab("standard")}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                  tab === "standard"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => setTab("custom")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                  tab === "custom"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                <Sticker className="h-3 w-3" /> Custom ({rows.length})
              </button>
            </div>
          </SheetTitle>
        </SheetHeader>

        {tab === "standard" && (
          <div className="mt-3 h-[min(52dvh,430px)] min-h-[280px]">
            {/* The same virtualised Fluent panel the DM and group sheets use.
                Sharing it keeps one emoji design across the app and keeps this
                sheet from mounting 750 unicode cells before it can paint. */}
            <RizzEmojiPanel
              realmId={realmId}
              onPick={(token) => {
                onPick(token);
                onOpenChange(false);
              }}
            />
          </div>
        )}

        {tab === "custom" && (
          <div className="mt-3 space-y-3">
            {available.isLoading && (
              <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </p>
            )}
            {!available.isLoading && rows.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {canManage
                  ? "No custom realm emoji yet — add the first one below."
                  : "This realm has no custom emoji yet."}
              </p>
            )}

            <div className="flex max-h-[42dvh] flex-wrap gap-2.5 overflow-y-auto p-1">
              {rows.map((entry) => {
                const pending = entry.id.startsWith("pending-");
                return (
                  <span key={entry.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (pending) {
                          toast.info("That emoji is still uploading.");
                          return;
                        }
                        onPick(`<:${entry.name}:${entry.id}>`);
                        onOpenChange(false);
                      }}
                      className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition-all hover:scale-105 hover:bg-white/10"
                      title={`:${entry.name}:`}
                      aria-label={`:${entry.name}:`}
                    >
                      {/* Square cell, object-fit: contain: a tall screenshot
                          stays readable instead of shrinking to a sliver. */}
                      <img
                        src={entry.url}
                        alt={`:${entry.name}:`}
                        loading="lazy"
                        decoding="async"
                        width={40}
                        height={40}
                        className="h-10 w-10 object-contain"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                      {pending ? (
                        <span className="absolute inset-0 grid place-items-center bg-black/40 text-[10px] font-semibold">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </span>
                      ) : null}
                    </button>
                    {canManage && !pending && (
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
                );
              })}
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
                    onChange={(event) =>
                      setName(event.target.value.replace(/[^A-Za-z0-9_]/g, "").toLowerCase())
                    }
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
                    className="border-0 bg-primary text-primary-foreground shadow-md"
                    onClick={() => fileRef.current?.click()}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Choose image"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  PNG, JPG, GIF or WebP, up to 256 KB. The name is what people see between colons.
                </p>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
