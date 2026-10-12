import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * `<@userId>` mention tokens.
 *
 * Our composer writes `@username`, which is what the mention notification
 * trigger reads, but a bot or an API client can write the token form. Tokens
 * carry an id, so a rename can never break them — the label is looked up once
 * per visible chat and cached.
 */
const TOKEN_RE = /<@([0-9a-fA-F-]{36})>/g;

export function extractMentionTokens(bodies: (string | null | undefined)[]): string[] {
  const ids = new Set<string>();
  for (const body of bodies) {
    if (!body || !body.includes("<@")) continue;
    for (const match of body.matchAll(TOKEN_RE)) ids.add(match[1].toLowerCase());
  }
  return [...ids];
}

export function useMentionLabels(bodies: (string | null | undefined)[]): (token: string) => string {
  const ids = useMemo(() => extractMentionTokens(bodies), [bodies.join("|")]);

  const profiles = useQuery({
    queryKey: ["mention-token-labels", ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", ids);
      if (error) throw error;
      return (data ?? []) as { id: string; username: string | null; display_name: string | null }[];
    },
  });

  const byId = useMemo(() => {
    const map = new Map<string, string>();
    for (const profile of profiles.data ?? []) {
      map.set(profile.id.toLowerCase(), `@${profile.username ?? profile.display_name ?? "member"}`);
    }
    return map;
  }, [profiles.data]);

  return (token: string) => byId.get(token.toLowerCase()) ?? "@member";
}
