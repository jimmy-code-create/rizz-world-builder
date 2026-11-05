import { createFileRoute } from "@tanstack/react-router";
import { getAuthorizedSupabase } from "@/lib/server-supabase";

/**
 * Every custom emoji the signed-in viewer may use, wherever they are.
 *
 * GET /api/emojis/available  →  { private: [...], realms: [{ id, name, iconUrl, emojis }] }
 *
 * The picker used to be handed the *current* realm and queried that realm's
 * rows. A DM has no realm, so the list came back empty there, and an emoji from
 * another realm never appeared at all. This asks the opposite question — "what
 * may *I* use?" — so the answer is identical in a DM, a realm and the feed
 * composer.
 *
 * `private` is always empty today: emoji are owned by a realm. It is in the
 * response so the picker's "Private" section can be filled by a future
 * per-account upload (or by a local, not-yet-saved upload on the client).
 */
export const Route = createFileRoute("/api/emojis/available")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await getAuthorizedSupabase(request);
        if (auth instanceof Response) return auth;

        // Memberships first: this decides which realms (and icons) exist even
        // when a realm has no emoji of its own.
        const { data: memberships, error: memberError } = await auth.client
          .from("realm_members")
          .select(
            "realm_id, realm:realms!realm_members_realm_id_fkey(id,name,icon_url,allow_external_emoji)",
          )
          .eq("user_id", auth.userId);

        if (memberError) {
          console.error("[/api/emojis/available] membership lookup failed", memberError);
          return Response.json({ error: "Couldn't load your realms." }, { status: 500 });
        }

        type RealmRow = {
          id?: string;
          name?: string;
          icon_url?: string | null;
          allow_external_emoji?: boolean | null;
        };
        const realms: Array<{
          id: string;
          name: string;
          iconUrl: string | null;
          emojis: Array<{ id: string; name: string; url: string; animated: boolean }>;
        }> = [];
        const seen = new Set<string>();
        for (const row of (memberships ?? []) as Array<{ realm?: RealmRow | null }>) {
          const realm = row.realm;
          if (!realm?.id || !realm.name || seen.has(realm.id)) continue;
          seen.add(realm.id);
          realms.push({
            id: realm.id,
            name: realm.name,
            iconUrl: realm.icon_url ?? null,
            emojis: [],
          });
        }
        realms.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

        const realmIds = realms.map((realm) => realm.id);
        if (!realmIds.length) {
          return Response.json({ private: [], realms: [] }, { headers: cacheHeaders() });
        }

        // One read for every joined realm. `status`/`animated` arrived with the
        // shared-emoji migration; `select("*")` keeps this working on an older
        // database where those columns do not exist yet.
        const { data: emojiRows, error: emojiError } = await auth.client
          .from("realm_custom_emoji")
          .select("*")
          .in("realm_id", realmIds)
          .eq("kind", "emoji");

        if (emojiError) {
          console.error("[/api/emojis/available] emoji lookup failed", emojiError);
          return Response.json({ error: "Couldn't load emoji." }, { status: 500 });
        }

        const byId = new Map(realms.map((realm) => [realm.id, realm]));
        for (const row of (emojiRows ?? []) as Array<{
          id: string;
          realm_id: string;
          name: string;
          url: string;
          status?: string | null;
          animated?: boolean | null;
        }>) {
          if (row.status && row.status !== "active") continue;
          const realm = byId.get(row.realm_id);
          if (!realm) continue;
          realm.emojis.push({
            id: row.id,
            name: row.name,
            url: row.url,
            animated: row.animated ?? /\.(gif|webp|webm)(\?|#|$)/i.test(row.url),
          });
        }
        for (const realm of realms) {
          realm.emojis.sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
          );
        }

        return Response.json({ private: [], realms }, { headers: cacheHeaders() });
      },
    },
  },
});

function cacheHeaders() {
  // Per-user data: private to the browser, but a short revalidation window so
  // a freshly uploaded emoji shows up without a full refetch.
  return { "Cache-Control": "private, max-age=0, must-revalidate" };
}
