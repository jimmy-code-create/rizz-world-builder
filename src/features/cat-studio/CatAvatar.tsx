import { cn } from "@/lib/utils";
import { catSvgString } from "./renderPng";

/**
 * The cat, as a profile picture.
 *
 * Cat Studio renders the 3D model because that is the whole point of turning it
 * under your finger. Avatars are the opposite problem: they appear by the dozen
 * in a feed or a message list, so they must be one cached image, no WebGL, no
 * request. `catSvgString` already turns a config into the flat layered drawing,
 * so this pipes it through a data URI and memoises per config + size.
 *
 * The result is byte-identical to the cat's own artwork — same parts, same
 * colours, same accessories — so a member's avatar and their Flexes tab show the
 * same character rather than a mascot look-alike.
 */
const cache = new Map<string, string>();
const MAX_CACHE = 300;

export function catAvatarSrc(config: unknown, size = 96): string {
  const key = `${size}|${JSON.stringify(config ?? null)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const svg = catSvgString(config, size);
  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  // A feed can cycle through a lot of members; keep the map bounded rather than
  // holding every cat anyone ever scrolled past.
  if (cache.size >= MAX_CACHE) cache.clear();
  cache.set(key, uri);
  return uri;
}

export function CatAvatar({
  config,
  size = 40,
  className,
  alt = "",
}: {
  config: unknown;
  /** Rendered square, in pixels. */
  size?: number;
  className?: string;
  alt?: string;
}) {
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <img
        src={catAvatarSrc(config, size)}
        alt={alt}
        aria-hidden={alt ? undefined : true}
        width={size}
        height={size}
        draggable={false}
        decoding="async"
        className="h-full w-full select-none object-cover"
      />
    </span>
  );
}
