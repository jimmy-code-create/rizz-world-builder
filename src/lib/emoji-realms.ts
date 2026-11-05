import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import type { SharedEmoji } from "@/lib/emoji-shared";

/**
 * The realms a viewer actually belongs to.
 *
 * `joined_realm_emoji` already filters to joined realms server-side, but the
 * picker's category rail needs a row for every joined realm even when it has no
 * custom emoji yet. This is also the membership list we use to drop a stale
 * client cache entry for a realm the viewer has since left.
 */
export type JoinedRealm = {
  id: string;
  name: string;
  slug: string;
  icon_url: string | null;
  role?: "owner" | "mod" | "member";
};

export type EmojiRealmSection = {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  emoji: SharedEmoji[];
  /** Kept explicit for UI modes that offer a locked realm as a preview. */
  isMember: boolean;
  allowExternal: boolean;
};

export const joinedRealmsKey = (userId?: string | null) =>
  ["joined-realms", userId ?? "anonymous"] as const;

export function useJoinedRealms() {
  const { user } = useAuth();

  return useQuery({
    queryKey: joinedRealmsKey(user?.id),
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<JoinedRealm[]> => {
      const { data, error } = await (supabase.from as any)("realm_members")
        .select(
          "role, realm:realms!realm_members_realm_id_fkey(id,name,slug,icon_url)",
        )
        .eq("user_id", user!.id);
      if (error) return [];

      const seen = new Set<string>();
      const realms: JoinedRealm[] = [];
      for (const row of (data ?? []) as Array<{
        role?: JoinedRealm["role"];
        realm?: {
          id?: string;
          name?: string;
          slug?: string;
          icon_url?: string | null;
        } | null;
      }>) {
        const realm = row.realm;
        if (!realm?.id || !realm.name || !realm.slug || seen.has(realm.id)) continue;
        seen.add(realm.id);
        realms.push({
          id: realm.id,
          name: realm.name,
          slug: realm.slug,
          icon_url: realm.icon_url ?? null,
          role: row.role,
        });
      }
      return realms;
    },
  });
}

/**
 * Groups the shared emoji RPC rows into realm sections. The current realm is
 * pinned first; everything else follows alphabetically so the rail is stable
 * between visits. If the membership query is still loading we fall back to the
 * realm metadata the RPC already supplied, which keeps emoji visible without a
 * second round trip.
 */
export function buildEmojiRealmSections(
  rows: SharedEmoji[],
  realms: JoinedRealm[],
  currentRealmId?: string | null,
): EmojiRealmSection[] {
  const joined = new Set(realms.map((realm) => realm.id));
  const source = realms.length
    ? rows.filter((row) => joined.has(row.realm_id))
    : rows;

  const byId = new Map<string, EmojiRealmSection>();
  for (const realm of realms) {
    byId.set(realm.id, {
      id: realm.id,
      name: realm.name,
      slug: realm.slug,
      iconUrl: realm.icon_url ?? null,
      emoji: [],
      isMember: true,
      allowExternal: true,
    });
  }

  for (const row of source) {
    let section = byId.get(row.realm_id);
    if (!section) {
      section = {
        id: row.realm_id,
        name: row.realm_name || "Realm",
        slug: row.realm_slug || "",
        iconUrl: null,
        emoji: [],
        isMember: true,
        allowExternal: true,
      };
      byId.set(row.realm_id, section);
    }
    section.emoji.push(row);
  }

  return [...byId.values()].sort((a, b) => {
    if (currentRealmId) {
      if (a.id === currentRealmId) return -1;
      if (b.id === currentRealmId) return 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}
