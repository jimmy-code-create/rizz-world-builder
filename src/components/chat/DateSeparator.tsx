/**
 * The "Today" / "Yesterday" / "12 March 2026" divider between days of chat.
 *
 * `dayKey` is the grouping primitive: two messages belong to the same day when
 * their *local* year/month/day match, which is what a reader means by "day" —
 * comparing ISO strings would split a conversation at UTC midnight instead.
 */
export function dayKey(value: string | number | Date): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/** Midnight-relative label, falling back to a short absolute date. */
export function formatDayLabel(value: string | number | Date, now: Date = new Date()): string {
  const date = new Date(value);
  if (dayKey(date) === dayKey(now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(date) === dayKey(yesterday)) return "Yesterday";

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function DateSeparator({ date }: { date: string | number | Date }) {
  const label = formatDayLabel(date);
  return (
    <div className="chat-date-separator" role="separator" aria-label={label}>
      <span className="chat-date-separator__line" aria-hidden="true" />
      <span className="chat-date-separator__label">{label}</span>
      <span className="chat-date-separator__line" aria-hidden="true" />
    </div>
  );
}
