/**
 * The realms RIZZ runs itself.
 *
 * They are ordinary realm rows — the same members, rooms and messages as any
 * other — so the feature is presentation, not a second kind of realm. Matching
 * is by slug first and by name second, because the rows were created by hand
 * before there was a naming rule.
 */
export type OfficialRealm = {
  key: "official" | "support";
  name: string;
  label: string;
  blurb: string;
  accent: string;
  matches: (realm: { slug: string; name: string }) => boolean;
};

const normalized = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

export const OFFICIAL_REALMS: OfficialRealm[] = [
  {
    key: "official",
    name: "Rizz Official",
    label: "Official",
    blurb: "Announcements, new drops and everything happening in RIZZ first.",
    accent: "#c9ff3d",
    matches: (realm) =>
      realm.slug === "rizz-official" ||
      realm.slug === "rizz-official-realm" ||
      normalized(realm.name).startsWith("rizz official"),
  },
  {
    key: "support",
    name: "Rizz Support",
    label: "Support",
    blurb: "Help, bug reports and a real human when something breaks.",
    accent: "#8b7cf6",
    matches: (realm) =>
      realm.slug === "rizz-support" ||
      realm.slug === "rizz-support-realm" ||
      normalized(realm.name).startsWith("rizz support"),
  },
];

export function officialRealmOf(realm: { slug: string; name: string }) {
  return OFFICIAL_REALMS.find((official) => official.matches(realm)) ?? null;
}
