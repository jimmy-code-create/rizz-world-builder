import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CloseButton } from "@/components/ui/close-button";
import { CatEmoji } from "@/components/emoji/CatEmoji";
import { CAT_EMOJI_MANIFEST, type CatEmojiName } from "@/components/emoji/cat-emoji-manifest";
import { cn } from "@/lib/utils";

/**
 * The composer's cat button.
 *
 * The RIZZ pack is nine stickers, so it does not need the full emoji browser:
 * a 3×3 sheet puts the whole pack under one thumb. Picking one inserts its
 * shortcode (`:cat_happy:`), which every surface already renders as the image,
 * so a message written here draws the same sticker in a reaction or a badge.
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
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        hideClose
        className="glass-strong z-[110] rounded-t-3xl border-white/10 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
      >
        <SheetTitle className="sr-only">Cat stickers</SheetTitle>
        <div className="mx-auto mb-3 mt-1 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div>
            <p className="font-display text-lg font-bold">Cat stickers</p>
            <p className="text-[11px] text-muted-foreground">The RIZZ pack · tap to drop one in</p>
          </div>
          <CloseButton onClick={() => onOpenChange(false)} />
        </div>
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
