import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CloseButton } from "@/components/ui/close-button";
import { CatEmoji } from "@/components/emoji/CatEmoji";
import { CAT_EMOJI_MANIFEST, type CatEmojiName } from "@/components/emoji/cat-emoji-manifest";
import { cn } from "@/lib/utils";
import { useMyCat } from "@/features/cat-studio/useCatStudio";

/**
 * The composer's cat button.
 *
 * This is the cat button's whole job: the RIZZ cat emoji, and nothing else.
 * Emoji, this server's emoji, GIFs and stickers live behind the smiley. The
 * pack is small, so a 3×3 sheet puts all of it under one thumb. Picking one
 * inserts its shortcode (`:cat_happy:`), which every surface already renders
 * as the image, so a message written here draws the same cat in a reaction or
 * a badge.
 */
export function CatStickerSheet({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (shortcode: string) => void;
}) {
  // Your own cat rides along with the RIZZ pack, like a WhatsApp avatar
  // sticker: the message stores the saved PNG's URL, so everyone sees the cat
  // you dressed, as a sticker, not as an avatar swap.
  const myCat = useMyCat();
  const myCatUrl = myCat.data?.url ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        hideClose
        className="glass-strong z-[110] rounded-t-3xl border-white/10 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
      >
        <SheetTitle className="sr-only">Cat emojis</SheetTitle>
        <div className="mx-auto mb-3 mt-1 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div>
            <p className="font-display text-lg font-bold">Cat emojis</p>
            <p className="text-[11px] text-muted-foreground">The RIZZ pack · tap to drop one in</p>
          </div>
          <CloseButton onClick={() => onOpenChange(false)} />
        </div>
        {myCatUrl && (
          <button
            type="button"
            onClick={() => {
              onPick(`![sticker](${myCatUrl})`);
              onOpenChange(false);
            }}
            className={cn(
              "mt-3 flex w-full items-center gap-3 rounded-2xl border border-primary/35 bg-primary/10 p-2.5 text-left",
              "transition-colors hover:border-primary/60 active:scale-[0.99]",
            )}
          >
            <img
              src={myCatUrl}
              alt=""
              loading="lazy"
              className="h-14 w-14 shrink-0 rounded-xl object-contain"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold">Send my cat</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                Your Cat Studio sticker, as big as a meme
              </span>
            </span>
            <span className="text-[11px] font-semibold text-primary">Send</span>
          </button>
        )}

        <div className="mt-3 grid grid-cols-3 gap-2">
          {CAT_EMOJI_MANIFEST.map((entry) => (
            <button
              key={entry.name}
              type="button"
              onClick={() => {
                onPick(entry.shortcode);
                onOpenChange(false);
              }}
              className={cn(
                "flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-2xl border border-white/[0.08] bg-[#161616]",
                "transition-colors hover:border-white/20 hover:bg-[#1d1d1d] active:scale-95",
              )}
            >
              <CatEmoji name={entry.name as CatEmojiName} size={40} animate={false} />
              <span className="text-[10px] text-[#9a9a9a]">{entry.shortcode}</span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default CatStickerSheet;
