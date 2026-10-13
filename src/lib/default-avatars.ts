/**
 * The built-in cat avatars. Every account gets one of these so a profile never
 * shows a bare letter, and anyone can switch between them in Settings → Profile.
 * They ship as SVGs in /public/avatars, so they cost no upload and no storage.
 */
export type DefaultAvatar = {
  id: string;
  url: string;
  label: string;
};

export const DEFAULT_AVATARS: DefaultAvatar[] = [
  { id: "kitten", url: "/avatars/cat-1.svg", label: "Kitten" },
  { id: "curious", url: "/avatars/cat-2.svg", label: "Curious" },
  { id: "headphones", url: "/avatars/cat-3.svg", label: "Headphones" },
  { id: "playful", url: "/avatars/cat-4.svg", label: "Playful" },
  { id: "royal", url: "/avatars/cat-5.svg", label: "Royal" },
  { id: "sleepy", url: "/avatars/cat-6.svg", label: "Sleepy" },
];

/** Stable pick: the same seed always lands on the same cat. */
export function defaultAvatarFor(seed: string | null | undefined): string {
  const value = (seed ?? "").trim().toLowerCase();
  if (!value) return DEFAULT_AVATARS[0].url;
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return DEFAULT_AVATARS[(hash >>> 0) % DEFAULT_AVATARS.length].url;
}

/** A different cat than the one a seed already resolves to, for variety. */
export function randomDefaultAvatar(seed?: string): string {
  const current = seed ? defaultAvatarFor(seed) : null;
  const options = DEFAULT_AVATARS.filter((avatar) => avatar.url !== current);
  return options[Math.floor(Math.random() * options.length)]?.url ?? DEFAULT_AVATARS[0].url;
}

/** True when a profile is still on one of the built-in avatars. */
export function isDefaultAvatar(url: string | null | undefined): boolean {
  return !!url && DEFAULT_AVATARS.some((avatar) => avatar.url === url);
}
