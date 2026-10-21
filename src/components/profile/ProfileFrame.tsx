import { DarkMoonFrame } from "./DarkMoonFrame";

/**
 * A profile frame wraps the banner/card. Only Dark Moon ships, and a stale slug
 * renders nothing rather than resurrecting a removed frame.
 */
export function ProfileFrame({
  slug,
  className,
}: {
  slug?: string | null;
  className?: string;
}) {
  return <DarkMoonFrame slug={slug} className={className} />;
}
