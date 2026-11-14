/**
 * <CatAvatar> — the one renderer.
 *
 * The builder preview, the profile header, the voice tile and the saved PNG all
 * go through `catLayerStack`, so the same config produces the same cat in every
 * place. Markup is generated here from the app's own catalog; nothing from a
 * user or a URL is ever injected.
 */
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { sanitizeCatConfig, type CatConfig } from "./config";
import { catLayerStack } from "./parts";

export type CatAvatarProps = {
  config: unknown;
  size?: number;
  animated?: boolean;
  className?: string;
  /** Decorative copies (a second preview on the page) opt out of the label. */
  label?: string;
};

/** The dark shade is derived from the fur colour, never a new brand colour. */
export function furDark(fur: string): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(fur)?.[1] ?? "17171a";
  const channels = [0, 2, 4].map((offset) => Math.round(parseInt(hex.slice(offset, offset + 2), 16) * 0.62));
  return `#${channels.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export function catVars(config: CatConfig): CSSProperties {
  return {
    "--fur": config.colors.fur,
    "--fur-dark": furDark(config.colors.fur),
    "--accent": config.colors.accent,
    "--eye": config.colors.eye,
  } as CSSProperties;
}

export function CatAvatar({ config, size = 96, animated = false, className, label }: CatAvatarProps) {
  const safe = sanitizeCatConfig(config);
  const layers = catLayerStack(safe);
  const description = label ?? "Cat avatar";

  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      role="img"
      aria-label={description}
      className={cn("cat-avatar block shrink-0", animated && "cat-avatar--animated", className)}
      style={catVars(safe)}
      dangerouslySetInnerHTML={{ __html: layers.map((layer) => layer.markup).join("") }}
    />
  );
}
