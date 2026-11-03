import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  REALM_COVER_ACCEPT,
  REALM_COVER_MAX_LABEL,
  realmCoverIsAnimated,
} from "@/lib/realm-cover";

/**
 * The animated cover field, shared by "New realm" and "Edit realm".
 *
 * It is a wide 16:7 strip rather than a square: that is the shape the cover is
 * shown in on discovery. A GIF or WebP previews and plays exactly as it will on
 * the card, so what you pick is what the realm gets.
 */
export function RealmCoverPicker({
  file,
  preview,
  existingUrl,
  remove,
  busy = false,
  onPick,
  onRemove,
}: {
  file: File | null;
  preview: string | null;
  existingUrl: string | null;
  remove: boolean;
  busy?: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const shown = remove ? null : (preview ?? existingUrl);
  const animated = file ? file.type !== "image/png" && file.type !== "image/jpeg" : realmCoverIsAnimated(existingUrl);

  return (
    <div>
      <p className="text-xs text-muted-foreground">Animated cover</p>
      <label
        className={cn(
          "relative mt-1 block aspect-[16/7] w-full cursor-pointer overflow-hidden rounded-2xl border border-dashed border-white/20 bg-white/[0.03] transition-colors",
          "hover:border-primary/50 hover:bg-white/[0.05] focus-within:ring-2 focus-within:ring-primary",
          shown && "border-solid border-white/10",
        )}
      >
        {shown ? (
          <img
            src={shown}
            alt="Realm cover preview"
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="flex h-full flex-col items-center justify-center gap-1 text-center">
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <ImagePlus className="h-5 w-5 text-muted-foreground" />
            )}
            <span className="text-[11px] font-semibold text-foreground/85">
              Add an animated cover
            </span>
            <span className="text-[10px] text-muted-foreground">
              GIF, WebP, PNG or JPG · up to {REALM_COVER_MAX_LABEL}
            </span>
          </span>
        )}

        {shown ? (
          <>
            <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-6 text-[10px] font-semibold text-white/85">
              {animated ? "Animated cover · GIF/WebP" : "Cover · 16:7"}
            </span>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                onRemove();
              }}
              aria-label="Remove realm cover"
              className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/80"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        ) : null}

        <input
          type="file"
          accept={REALM_COVER_ACCEPT}
          aria-label="Upload realm cover"
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            const picked = event.target.files?.[0];
            if (picked) onPick(picked);
            event.currentTarget.value = "";
          }}
        />
      </label>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Wide strip on discovery and the realm header. Animated files play as-is.
      </p>
    </div>
  );
}
