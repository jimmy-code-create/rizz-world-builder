/**
 * A member's name.
 *
 * Nameplates were part of the cosmetics catalogue that was removed when the
 * profile effects were trimmed to the single Puppy Love effect. Keeping the
 * component means the profile header, feed author line and call ringer still
 * share one name surface with the same typography hooks.
 */
export function Nameplate({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return <span className={className}>{name}</span>;
}
