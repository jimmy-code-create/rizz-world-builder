import type { CSSProperties } from "react";
import { Award } from "lucide-react";
import { CatEmoji } from "@/components/emoji/CatEmoji";
import { catNameForShortcode } from "@/components/emoji/cat-emoji-manifest";

/** Shared, transparent badge artwork with a tier-tinted glow. */
export function BadgeIcon({
  icon,
  glow,
  size = 20,
  image,
  animate = false,
  className = "",
}: {
  icon: string | null | undefined;
  glow: string;
  size?: number;
  image?: string;
  animate?: boolean | "hover" | "once" | "loop" | "static";
  className?: string;
}) {
  if (image) {
    const floating = animate === true || animate === "loop";
    return (
      <span aria-hidden className={`inline-flex shrink-0 ${className}`}>
        <img
          src={image}
          alt=""
          draggable={false}
          className={`badge-art-image${floating ? " badge-art-image--float" : ""}`}
          style={{ width: size, height: size, "--badge-glow": glow } as CSSProperties}
        />
      </span>
    );
  }

  const name = icon ? catNameForShortcode(icon) : null;
  if (!name) {
    return (
      <Award aria-hidden className={className} style={{ width: size, height: size, color: glow }} />
    );
  }
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 ${className}`}
      style={{ filter: `drop-shadow(0 0 ${Math.max(4, Math.round(size / 2))}px ${glow})` }}
    >
      <CatEmoji name={name} size={size} animate={animate} />
    </span>
  );
}
