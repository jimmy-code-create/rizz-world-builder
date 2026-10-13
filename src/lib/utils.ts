import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Compact counts for likes, comments and views: 950 → "950", 1_240 → "1.2K",
 * 3_400_000 → "3.4M". Used everywhere a count is shown so the feed and Reels
 * never disagree about how a number reads.
 */
export function formatCount(value: number | null | undefined): string {
  const n = Math.max(0, Math.floor(Number(value ?? 0)));
  if (!Number.isFinite(n)) return "0";
  if (n < 1_000) return String(n);

  // Each unit keeps one decimal below 100, rounds above it, and rolls over
  // before it can ever print "1000K"/"1000M".
  const compact = (value: number, suffix: string) =>
    `${value >= 100 ? Math.round(value) : Number(value.toFixed(1))}${suffix}`;

  if (n < 999_500) return compact(n / 1_000, "K");
  const millions = n / 1_000_000;
  if (millions < 999.5) return compact(millions, "M");
  return compact(n / 1_000_000_000, "B");
}
