import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadPrefs, PREFS_EVENT } from "@/lib/prefs";

/** A message shows at most this many previews. */
export const MAX_PREVIEWS_PER_MESSAGE = 3;

export type PreviewScope = "dm" | "realm" | "group";

export type LinkPreview = {
  ok: boolean;
  url: string;
  domain: string;
  kind: "link" | "image" | "video";
  title: string | null;
  description: string | null;
  siteName: string | null;
  imageUrl: string | null;
};

/** Local-only bookkeeping for the "Leaving RIZZ" sheet. */
const ACKED_DOMAINS_KEY = "rizz:link-ack-domains";
const DONT_ASK_KEY = "rizz:link-dont-ask";

/** Shorteners hide where you're really going; punycode hides who you're really visiting. */
const SHORTENER_HOSTS = /^(bit\.ly|t\.co|tinyurl\.com|goo\.gl|ow\.ly|is\.gd|buff\.ly|cutt\.ly|rb\.gy|shorturl\.at|rebrand\.ly)$/i;

export function isSuspiciousDomain(domain: string) {
  if (SHORTENER_HOSTS.test(domain)) return true;
  if (domain.startsWith("xn--") || domain.includes(".xn--")) return true;
  // .zip / .mov / .app style TLDs that get used to look like file names or apps.
  if (/\.(zip|mov|apk|exe|scr)$/i.test(domain)) return true;
  // Many dashes or digits can be a lookalike host.
  if ((domain.match(/-/g)?.length ?? 0) >= 3) return true;
  return false;
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function extractPreviewUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"'`]+/gi) ?? [];
  const cleaned = matches.map((url) => url.replace(/[.,;:!?)\]]+$/, ""));
  return [...new Set(cleaned)].slice(0, MAX_PREVIEWS_PER_MESSAGE);
}

export function linkPreviewsEnabled() {
  if (typeof window === "undefined") return true;
  return loadPrefs().linkPreviews !== false;
}

export function previewQueryKey(url: string) {
  return ["link-preview", url] as const;
}

export function hiddenPreviewsQueryKey(scope: PreviewScope, messageIds: string[]) {
  return ["link-preview-hides", scope, [...messageIds].sort().join(",")] as const;
}

export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  const fallback: LinkPreview = {
    ok: false,
    url,
    domain: hostOf(url),
    kind: "link",
    title: null,
    description: null,
    siteName: null,
    imageUrl: null,
  };
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) return fallback;
    const payload = (await response.json()) as Partial<LinkPreview>;
    if (!payload || typeof payload !== "object") return fallback;
    return { ...fallback, ...payload } as LinkPreview;
  } catch {
    // A failed fetch just means no card: the link text stays tappable.
    return fallback;
  }
}

/**
 * Previews for the links in one message: at most three URLs, cached per URL so
 * the server fetches each link once. Exactly MAX_PREVIEWS_PER_MESSAGE queries
 * are always declared (inactive slots stay disabled) so the hook order never
 * changes as a message body changes.
 */
export function useMessageLinkPreviews(text: string, enabled: boolean) {
  const urls = useMemo(() => {
    const found = enabled ? extractPreviewUrls(text) : [];
    return Array.from({ length: MAX_PREVIEWS_PER_MESSAGE }, (_, index) => found[index] ?? "");
  }, [text, enabled]);

  const first = useQuery(previewQuery(urls[0]));
  const second = useQuery(previewQuery(urls[1]));
  const third = useQuery(previewQuery(urls[2]));
  const queries = [first, second, third];

  const previews = queries.map((query, index) => {
    if (!urls[index]) return null;
    if (query.data) return query.data;
    return query.isLoading ? ({ loading: true, url: urls[index] } as const) : null;
  }).filter(Boolean) as Array<LinkPreview | { loading: true; url: string }>;

  return { urls, previews };
}

function previewQuery(url: string) {
  return {
    queryKey: previewQueryKey(url || "none"),
    queryFn: () => fetchLinkPreview(url),
    enabled: Boolean(url),
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  };
}

/**
 * The Settings > Preferences switch, live-updated through the prefs event that
 * savePrefs() dispatches.
 */
export function useLinkPreviewsEnabled() {
  const [enabled, setEnabled] = useState(linkPreviewsEnabled);
  useEffect(() => {
    const reread = () => setEnabled(linkPreviewsEnabled());
    window.addEventListener(PREFS_EVENT, reread);
    window.addEventListener("storage", reread);
    return () => {
      window.removeEventListener(PREFS_EVENT, reread);
      window.removeEventListener("storage", reread);
    };
  }, []);
  return enabled;
}

export async function hideLinkPreview(messageId: string, scope: PreviewScope) {
  const { error } = await (supabase.rpc as any)("hide_link_preview", {
    _message_id: messageId,
    _scope: scope,
  });
  if (error) throw new Error("Couldn't remove that preview, try again");
}

/** Which messages in this chat have had their preview removed. */
export function useHiddenLinkPreviews(scope: PreviewScope, messageIds: string[]) {
  const qc = useQueryClient();
  const ids = useMemo(() => [...new Set(messageIds.filter(Boolean))], [messageIds.join("|")]);
  const queryKey = hiddenPreviewsQueryKey(scope, ids);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!ids.length) return [] as string[];
      const { data, error } = await supabase
        .from("link_preview_hides" as never)
        .select("message_id")
        .eq("message_scope", scope)
        .in("message_id", ids);
      if (error) throw error;
      return ((data ?? []) as Array<{ message_id: string }>).map((row) => row.message_id);
    },
    enabled: ids.length > 0,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!ids.length) return;
    const channel = supabase
      .channel(`link-preview-hides-${scope}-${ids[0]}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "link_preview_hides", filter: `message_scope=eq.${scope}` },
        () => { void qc.invalidateQueries({ queryKey: ["link-preview-hides", scope] }); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [scope, ids, qc]);

  return { hidden: new Set(query.data ?? []), refetch: query.refetch };
}

export function hasAckedDomain(domain: string) {
  if (typeof window === "undefined") return true;
  try {
    if (window.localStorage.getItem(DONT_ASK_KEY) === "1") return true;
    const acked = JSON.parse(window.localStorage.getItem(ACKED_DOMAINS_KEY) || "[]") as string[];
    return acked.includes(domain);
  } catch {
    return false;
  }
}

export function ackDomain(domain: string, dontAskAgain = false) {
  if (typeof window === "undefined") return;
  try {
    if (dontAskAgain) window.localStorage.setItem(DONT_ASK_KEY, "1");
    const acked = JSON.parse(window.localStorage.getItem(ACKED_DOMAINS_KEY) || "[]") as string[];
    if (!acked.includes(domain)) acked.push(domain);
    window.localStorage.setItem(ACKED_DOMAINS_KEY, JSON.stringify(acked.slice(-200)));
  } catch {
    // Private mode: the sheet will simply ask again next time.
  }
}
