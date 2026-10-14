/**
 * Unified Formatting Utilities for RIZZ
 */

/**
 * Format any integer or float with standard comma grouping.
 * 500000 -> "500,000"
 */
export function formatNumber(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0";
  const num = typeof val === "string" ? Number(val) : val;
  if (Number.isNaN(num)) return "0";
  return new Intl.NumberFormat("en-US").format(num);
}

/**
 * Parses a chat or feed message body and returns a clean, human-readable preview.
 * Never leaks raw markdown formatting, image tags, or full URLs.
 * Returns: "GIF", "Photo", "Voice note 0:12", "Link: domain.com", or plain text.
 */
export function previewText(message: string | null | undefined): string {
  if (!message) return "";
  const raw = message.trim();
  if (!raw) return "";

  // 1. Voice note with optional duration: [voice note: 0:12](...) or /voice/0:12
  const voiceMatch = raw.match(/\[voice(?:\s+note)?(?::\s*([0-9:]+))?\]/i) || raw.match(/voice note\s*([0-9:]+)?/i);
  if (voiceMatch) {
    const dur = voiceMatch[1] ? ` ${voiceMatch[1]}` : "";
    return `Voice note${dur}`;
  }

  // 2. GIF markers or giphy/tenor embeds
  if (
    /!\[(?:gif|sticker)\]/i.test(raw) ||
    /\[gif:[^\]]+\]/i.test(raw) ||
    /(?:giphy\.com|tenor\.com)\/media/i.test(raw) ||
    /\.gif(?:$|[?#])/i.test(raw)
  ) {
    return "GIF";
  }

  // 3. Photos / Images
  if (/!\[.*?\]\(.*?\)/i.test(raw) || /\.(?:png|jpe?g|webp|svg)(?:$|[?#])/i.test(raw)) {
    return "Photo";
  }

  // 4. Standalone or prominent URLs: extract domain
  const urlMatch = raw.match(/https?:\/\/([a-zA-Z0-9.-]+)(?:\/[^\s]*)?/i);
  if (urlMatch && (raw.startsWith("http://") || raw.startsWith("https://") || raw.length === urlMatch[0].length)) {
    const domain = urlMatch[1].replace(/^www\./, "");
    return `Link: ${domain}`;
  }

  // 5. Clean plain text: strip markdown symbols (bold, code, headers, links)
  let cleaned = raw
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [Text](url) -> Text
    .replace(/[*_~`#>]+/g, "")             // strip markdown formatting characters
    .replace(/\s+/g, " ")                  // collapse multiple whitespace
    .trim();

  // If a URL is embedded inside text, format as "Link: domain" or truncate cleanly
  if (/^https?:\/\//i.test(cleaned)) {
    try {
      const u = new URL(cleaned.split(" ")[0]);
      return `Link: ${u.hostname.replace(/^www\./, "")}`;
    } catch {
      return "Link";
    }
  }

  return cleaned.length > 80 ? cleaned.slice(0, 77) + "…" : cleaned;
}

/**
 * Returns a relative time string alongside the full formatted date for title and aria-label.
 */
export function relativeTime(input: string | number | Date | null | undefined): {
  text: string;
  fullDate: string;
  ariaLabel: string;
} {
  if (!input) {
    return { text: "", fullDate: "", ariaLabel: "" };
  }

  const date = typeof input === "object" ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return { text: "", fullDate: "", ariaLabel: "" };
  }

  const fullDate = date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 45) {
    return { text: "just now", fullDate, ariaLabel: `Just now, on ${fullDate}` };
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return { text: `${diffMin}m`, fullDate, ariaLabel: `${diffMin} minutes ago, on ${fullDate}` };
  }
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    return { text: `${diffHour}h`, fullDate, ariaLabel: `${diffHour} hours ago, on ${fullDate}` };
  }
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) {
    return { text: `${diffDay}d`, fullDate, ariaLabel: `${diffDay} days ago, on ${fullDate}` };
  }
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 4) {
    return { text: `${diffWeek}w`, fullDate, ariaLabel: `${diffWeek} weeks ago, on ${fullDate}` };
  }

  const text = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return { text, fullDate, ariaLabel: fullDate };
}
