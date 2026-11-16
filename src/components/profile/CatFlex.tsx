/**
 * The "Flexes" tab: the member and their cat, turned under their own finger.
 *
 * Both stand in one scene — the person, and the pet at their feet — because a
 * Flex that showed only the cat read as somebody else's animal. The profile
 * photo stays the photo; this never takes its place.
 */
import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, PawPrint, PenLine } from "lucide-react";
import { AvatarModel3D, type AvatarModelHandle } from "@/features/create-avatar/AvatarModel3D";
import { DEFAULT_AVATAR, loadStoredAvatar } from "@/features/create-avatar/config";
import { CAT_COLOURWAYS, colourwayFor } from "@/features/cat-studio/model";
import { CAT_SLOTS } from "@/features/cat-studio/config";
import { catFromProfile } from "@/features/cat-studio/useCatStudio";
import { getCatItem } from "@/features/cat-studio/catalog";
import { catPngBlob } from "@/features/cat-studio/renderPng";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type ProfileRow = Record<string, unknown> & {
  username?: string | null;
  cat_poster_url?: string | null;
};

export function CatFlex({ profile, isMe }: { profile: ProfileRow; isMe: boolean }) {
  const cat = useMemo(() => catFromProfile(profile), [profile]);
  const [colourway, setColourway] = useState(() => colourwayFor(cat?.colourway).id);
  const model = useRef<AvatarModelHandle>(null);
  const [sharing, setSharing] = useState(false);

  // My own look comes from my saved avatar. Another member's avatar colours are
  // not on the server yet, so their card shows the model's own default look
  // rather than an empty box.
  const avatarConfig = useMemo(() => (isMe ? loadStoredAvatar() : DEFAULT_AVATAR), [isMe]);
  const username = profile.username ?? "member";

  const worn = useMemo(() => {
    if (!cat) return [];
    return CAT_SLOTS.map((slot) => {
      const id = cat.slots[slot];
      return id ? getCatItem(id)?.name ?? null : null;
    }).filter((name): name is string => Boolean(name));
  }, [cat]);

  if (!cat) {
    return (
      <section className="rounded-[16px] border border-white/10 bg-surface-2 px-4 py-6 text-center">
        <PawPrint className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <p className="mt-2 text-[13px] text-muted-foreground">
          {isMe ? "You haven't adopted a cat yet." : `@${username} hasn't adopted a cat yet.`}
        </p>
        {isMe && (
          <Link
            to="/cat-studio"
            className="mt-3 inline-flex h-11 items-center rounded-[14px] bg-primary px-4 text-[13px] font-bold text-primary-foreground"
          >
            Open Cat Studio
          </Link>
        )}
      </section>
    );
  }

  const share = async () => {
    setSharing(true);
    try {
      // The model is the picture: capture the pose on screen, or fall back to the
      // layered renderer if the canvas never came up.
      const blob = (await model.current?.capturePng(1024).catch(() => null)) ?? (await catPngBlob({ ...cat, colourway }, 1024));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cat-${username}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4_000);
      toast.success("Cat saved as a picture");
    } catch {
      toast.error("Could not save the cat.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <section data-focus-hide className="flex flex-col gap-3">
      <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-[16px] border border-white/10 bg-surface-2">
        <div className="relative aspect-square w-full">
          <AvatarModel3D config={avatarConfig} petColourway={colourway} handleRef={model} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {CAT_COLOURWAYS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setColourway(entry.id)}
            aria-pressed={colourway === entry.id}
            className={cn(
              "flex h-11 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold",
              colourway === entry.id
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-white/12 text-muted-foreground",
            )}
          >
            <span
              aria-hidden="true"
              className="h-3 w-3 rounded-full border border-white/20"
              style={{ background: entry.swatch }}
            />
            {entry.name}
          </button>
        ))}
      </div>

      <p className="text-center text-[11.5px] text-muted-foreground">
        {worn.length > 0 ? `Wearing ${worn.join(", ")}.` : "No items equipped."}
      </p>

      <div className="flex items-center justify-center gap-2">
        {isMe && (
          <Link
            to="/cat-studio"
            className="inline-flex h-11 items-center gap-1.5 rounded-[14px] border border-white/12 px-4 text-[13px] font-semibold text-foreground"
          >
            <PenLine className="h-4 w-4" aria-hidden="true" />
            Edit in Cat Studio
          </Link>
        )}
        <button
          type="button"
          onClick={() => void share()}
          disabled={sharing}
          className="inline-flex h-11 items-center gap-1.5 rounded-[14px] bg-primary px-4 text-[13px] font-bold text-primary-foreground disabled:opacity-50"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {sharing ? "Saving…" : "Share"}
        </button>
      </div>
    </section>
  );
}
