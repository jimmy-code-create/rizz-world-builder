import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Hash, Search, Send, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "@/lib/toast";
import {
  fetchShareTargets,
  sendToTarget,
  type ShareDraft,
  type ShareTarget,
  type ShareTargetKind,
} from "@/lib/share-to-chat";

/**
 * The one "send to…" picker for the whole app.
 *
 * Discord lets you forward anything anywhere, so this sheet lists the person,
 * group or realm you actually talk to — searchable, grouped, with the same row
 * shape in every section. It is used by the post and reel share buttons and by
 * Forward on any message, so all three paths behave identically.
 */
export function ShareToChatSheet({
  open,
  onOpenChange,
  draft,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null while the caller has nothing to share; the sheet then renders empty. */
  draft: ShareDraft | null;
  onSent?: (target: ShareTarget) => void;
}) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const targets = useQuery({
    queryKey: ["share-targets", user?.id],
    queryFn: () => fetchShareTargets(user!.id),
    enabled: open && !!user,
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const match = (target: ShareTarget) =>
      !needle ||
      target.name.toLowerCase().includes(needle) ||
      (target.subtitle ?? "").toLowerCase().includes(needle);
    return {
      dms: (targets.data?.dms ?? []).filter(match),
      groups: (targets.data?.groups ?? []).filter(match),
      realms: (targets.data?.realms ?? []).filter(match),
    };
  }, [targets.data, query]);

  const nothing =
    !targets.isLoading &&
    filtered.dms.length + filtered.groups.length + filtered.realms.length === 0;

  const send = async (target: ShareTarget) => {
    if (!draft || !user || sendingTo) return;
    const key = `${target.kind}:${target.id}`;
    setSendingTo(key);
    try {
      await sendToTarget(target, draft, user.id);
      setSentTo(key);
      toast.success(`Sent to ${target.name}`);
      onSent?.(target);
      // Let the tick land before the sheet goes away.
      window.setTimeout(() => {
        onOpenChange(false);
        setSentTo(null);
      }, 550);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send that");
    } finally {
      setSendingTo(null);
    }
  };

  const row = (target: ShareTarget) => {
    const key = `${target.kind}:${target.id}`;
    const busy = sendingTo === key;
    const done = sentTo === key;
    return (
      <button
        key={key}
        type="button"
        onClick={() => void send(target)}
        disabled={!!sendingTo}
        className="flex min-h-[56px] w-full items-center gap-3 rounded-xl px-2 text-left transition-colors hover:bg-white/[0.06] active:bg-white/[0.09] disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarImage src={target.avatarUrl ?? undefined} alt="" />
          <AvatarFallback className="bg-primary/20 text-[11px] font-bold text-primary">
            {target.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-foreground">
            {target.name}
          </span>
          <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
            {target.subtitle}
          </span>
        </span>
        <span className="grid h-8 w-8 shrink-0 place-items-center text-muted-foreground">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : done ? (
            <Check className="h-4 w-4 text-primary" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </span>
      </button>
    );
  };

  const section = (label: string, items: ShareTarget[], icon?: React.ReactNode) =>
    items.length > 0 ? (
      <section className="mt-3 first:mt-0">
        <h3 className="flex items-center gap-1.5 px-2 pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          {icon}
          {label}
        </h3>
        <div className="space-y-0.5">{items.map(row)}</div>
      </section>
    ) : null;

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery("");
        onOpenChange(next);
      }}
      title={draft?.title ?? "Send to"}
      description="Choose a conversation. It lands there instantly."
    >
      <div className="space-y-3">
        {draft && (draft.body.trim() || draft.attachmentUrl) && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <p className="line-clamp-2 text-[12.5px] leading-snug text-foreground/85">
              {draft.body.trim() || "Photo"}
            </p>
          </div>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people, groups, realms"
            className="h-11 rounded-xl pl-9 text-[15px]"
            autoComplete="off"
          />
        </div>

        <div className="max-h-[52dvh] overflow-y-auto overscroll-contain pr-0.5">
          {targets.isLoading && (
            <div className="space-y-2 py-2" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 px-2">
                  <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-white/10" />
                  <div className="h-3.5 w-40 animate-pulse rounded bg-white/10" />
                </div>
              ))}
            </div>
          )}

          {targets.isError && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              Couldn&apos;t load your conversations.
            </p>
          )}

          {nothing && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              Nothing matches “{query.trim()}”.
            </p>
          )}

          {section("People", filtered.dms)}
          {section("Groups", filtered.groups, <Users className="h-3 w-3" />)}
          {section("Realms", filtered.realms, <Hash className="h-3 w-3" />)}
        </div>

        {draft && (
          <Button
            type="button"
            variant="ghost"
            className="h-10 w-full justify-center gap-2 text-[13px] text-muted-foreground"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(draft.body);
                toast.success("Copied");
              } catch {
                toast.error("Couldn't copy");
              }
            }}
          >
            Copy text instead
          </Button>
        )}
      </div>
    </ResponsiveOverlay>
  );
}

export type { ShareTargetKind };
