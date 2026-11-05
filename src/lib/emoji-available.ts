import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  AVAILABLE_EMOJIS_PATH,
  emptyAvailableEmojis,
  type AvailableEmoji,
  type AvailableEmojiResponse,
  type AvailableRealmEmojis,
} from "@/lib/emoji-token";

/**
 * Every custom emoji the signed-in viewer may use — from every realm they are a
 * member of, plus their own private uploads — fetched from one endpoint no
 * matter which screen the picker was opened from.
 *
 * Why one endpoint and not the `joined_realm_emoji` RPC: a DM has no realm id,
 * and the picker used to be passed the current realm, so in DMs (and in realms
 * whose emoji lived elsewhere) it had nothing to show. `/api/emojis/available`
 * takes no parameters: the answer is the same in a DM, a realm and the feed
 * composer, and it is cached once for all of them.
 */

export const availableEmojisKey = (userId?: string | null) =>
  ["available-emojis", userId ?? "anonymous"] as const;

/** What the optimistic upload writes before the server answers. */
export type PendingEmoji = AvailableEmoji & {
  realmId: string;
  pending?: boolean;
};

export function emptyResponse(): AvailableEmojiResponse {
  return emptyAvailableEmojis();
}

async function fetchAvailable(userId: string): Promise<AvailableEmojiResponse> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return emptyResponse();

  const response = await fetch(AVAILABLE_EMOJIS_PATH, {
    headers: { Authorization: `Bearer ${token}` },
    // The endpoint is authenticated; never let an intermediary cache it.
    cache: "no-store",
  });
  if (!response.ok) {
    // 401 means the session died — let auth handle it, the picker just empties.
    if (response.status === 401) return emptyResponse();
    throw new Error(`Emoji list failed (${response.status})`);
  }
  const payload = (await response.json()) as Partial<AvailableEmojiResponse>;
  return {
    private: Array.isArray(payload.private) ? payload.private : [],
    realms: Array.isArray(payload.realms)
      ? payload.realms.filter((realm): realm is AvailableRealmEmojis => Boolean(realm?.id))
      : [],
  };
}

export function useAvailableEmojis() {
  const { user } = useAuth();
  return useQuery({
    queryKey: availableEmojisKey(user?.id),
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: () => fetchAvailable(user!.id),
  });
}

/** Invalidate everywhere the list is read: picker, rail, recents, renderers. */
/** A private (per-account) emoji, saved outside any realm. */
export function useSavePrivateEmoji() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, name }: { file: File; name: string }) => {
      const { uploadPrivateEmoji, savePrivateEmoji } = await import("@/lib/realm-emoji");
      const url = await uploadPrivateEmoji(file, name);
      const { id } = await savePrivateEmoji({ name, url });
      return { id, name, url } as AvailableEmoji;
    },
    onSuccess: () => invalidateAvailableEmojis(qc),
  });
}

export function invalidateAvailableEmojis(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ["available-emojis"] });
  // Message rendering resolves ids through the shared emoji lookup; a new row
  // must not wait for a stale entry there either.
  void qc.invalidateQueries({ queryKey: ["emoji-lookup"] });
}

function insertOptimistic(
  current: AvailableEmojiResponse | undefined,
  pending: PendingEmoji,
): AvailableEmojiResponse {
  const base = current ?? emptyResponse();
  const entry: AvailableEmoji = {
    id: pending.id,
    name: pending.name,
    url: pending.url,
    animated: pending.animated ?? false,
  };
  return {
    private: base.private,
    realms: base.realms.map((realm) =>
      realm.id === pending.realmId ? { ...realm, emojis: [entry, ...realm.emojis] } : realm,
    ),
  };
}

/**
 * Swaps a pending (blob-url) row for the saved one in the same realm. Without
 * this the picker would briefly show the picture twice.
 */
function replacePending(current: AvailableEmojiResponse | undefined, emoji: AvailableEmoji) {
  if (!current) return current;
  // The optimistic row is the one whose url is a local blob: it is replaced in
  // place, keeping the section's ordering stable while the refetch lands.
  const isPending = (row: AvailableEmoji) =>
    row.id.startsWith("pending-") && row.name === emoji.name;
  return {
    private: current.private.filter((row) => !isPending(row)),
    realms: current.realms.map((realm) => {
      const emojis = realm.emojis.filter((row) => !isPending(row));
      return {
        ...realm,
        emojis: emojis.some((row) => row.id === emoji.id) ? emojis : [...emojis, emoji],
      };
    }),
  };
}

function removeById(current: AvailableEmojiResponse | undefined, id: string) {
  if (!current) return current;
  return {
    private: current.private.filter((emoji) => emoji.id !== id),
    realms: current.realms.map((realm) => ({
      ...realm,
      emojis: realm.emojis.filter((emoji) => emoji.id !== id),
    })),
  };
}

export type UploadEmojiInput = {
  realmId: string;
  file: File;
  name: string;
  animated: boolean;
};

/**
 * Upload + save, with the picker updated before the network answers.
 *
 * A local object URL goes in first, so the tile appears the moment the file is
 * chosen; when the server replies the row is replaced by its real url and id.
 * On failure the optimistic row is removed and the caller shows the real error.
 */
export function useUploadEmoji() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    onMutate: (variables: UploadEmojiInput) => {
      // Show the file we already have: a local blob goes into the picker under
      // a pending id before the upload even starts.
      const objectUrl = URL.createObjectURL(variables.file);
      const pendingId = pendingEmojiId();
      applyOptimisticEmoji(qc, {
        id: pendingId,
        name: variables.name,
        url: objectUrl,
        animated: variables.animated,
        realmId: variables.realmId,
        pending: true,
      });
      return { objectUrl, pendingId };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      removeOptimisticEmoji(qc, context.pendingId);
      URL.revokeObjectURL(context.objectUrl);
    },
    mutationFn: async ({ realmId, file, name, animated }: UploadEmojiInput) => {
      const { uploadRealmEmoji, saveRealmEmoji, fetchRealmEmoji } =
        await import("@/lib/realm-emoji");
      if (!user?.id) throw new Error("Sign in to add an emoji.");
      const url = await uploadRealmEmoji(file, user.id, name);
      await saveRealmEmoji({ realmId, name, url, kind: "emoji" });
      // The save RPC returns `{ ok, id }`; the token needs that id, so read the
      // realm back once rather than trusting a name spread across realms.
      const rows = await fetchRealmEmoji(realmId);
      const saved = rows.find((row) => row.name === name);
      if (!saved) throw new Error("The emoji saved but could not be read back.");
      return {
        id: saved.id,
        name: saved.name,
        url: saved.url,
        animated: Boolean((saved as { animated?: boolean }).animated ?? animated),
      } as AvailableEmoji;
    },
    onSuccess: (emoji) => {
      // The optimistic row (a blob: url under a pending id) is replaced by the
      // real one; a refetch fills in anything else that changed.
      qc.setQueryData<AvailableEmojiResponse>(availableEmojisKey(), (current) =>
        replacePending(current, emoji),
      );
      invalidateAvailableEmojis(qc);
    },
  });
}

export function removeOptimisticEmoji(qc: QueryClient, id: string) {
  qc.setQueryData<AvailableEmojiResponse>(availableEmojisKey(), (current) =>
    removeById(current, id),
  );
}

export function applyOptimisticEmoji(qc: QueryClient, pending: PendingEmoji) {
  qc.setQueryData<AvailableEmojiResponse>(availableEmojisKey(), (current) =>
    insertOptimistic(current, pending),
  );
}

/** A stable, collision-free id for an emoji that has not been saved yet. */
export function pendingEmojiId(): string {
  const cryptoObj = typeof crypto !== "undefined" ? crypto : undefined;
  if (cryptoObj && "randomUUID" in cryptoObj) return `pending-${cryptoObj.randomUUID()}`;
  return `pending-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
