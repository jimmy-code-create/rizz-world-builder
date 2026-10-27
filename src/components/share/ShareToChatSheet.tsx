import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Hash, Search, Send, Users, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "@/lib/toast";
import {
  fetchShareTargets,
  searchShareProfiles,
  sendToTarget,
  type ShareDraft,
  type ShareTarget,
  type ShareTargetKind,
} from "@/lib/share-to-chat";

/** Which shelf of the picker is on screen. */
type ShareCategory = "all" | "dm" | "group" | "realm";

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
  // The search box stays responsive while the people query waits for a pause.
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState<ShareCategory>("all");
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const targets = useQuery({
    queryKey: ["share-targets", user?.id],
    queryFn: () => fetchShareTargets(user!.id),
    enabled: open && !!user,
    staleTime: 30_000,
  });

  // Anyone on RIZZ can be sent to, even without an existing conversation —
  // this is what makes "share it to that person" work for a new member.
  const people = useQuery({
    queryKey: ["share-people", user?.id, debounced],
    queryFn: () => searchShareProfiles(user!.id, debounced),
    enabled: open && !!user && debounced.length >= 2 && category !== "realm" && category !== "group",
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const match = (target: ShareTarget) =>
      !needle ||
      target.name.toLowerCase().includes(needle) ||
      (target.subtitle ?? "").toLowerCase().includes(needle);
    const dms = (targets.data?.dms ?? []).filter(match);
    const seen = new Set(dms.map((dm) => dm.id));
    // People the plain name filter already lists stay in the People section once.
    const extraPeople = (people.data ?? []).filter(
      (person) => !seen.has(person.id) && !dms.some((dm) => dm.name === person.name),
    );
    return {
      dms,
      extraPeople,
      groups: (targets.data?.groups ?? []).filter(match),
      realms: (targets.data?.realms ?? []).filter(match),
    };
  }, [targets.data, people.data, query]);

  const counts = {
    all: 0,
    dm: (targets.data?.dms ?? []).length,
    group: (targets.data?.groups ?? []).length,
    realm: (targets.data?.realms ?? []).length,
  };

  const showCategory = (kind: Exclude<ShareCategory, "all">) => category === "all" || category === kind;

  const nothing =
    !targets.isLoading &&
    (!showCategory("dm") || filtered.dms.length + filtered.extraPeople.length === 0) &&
    (!showCategory("group") || filtered.groups.length === 0) &&
    (!showCategory("realm") || filtered.realms.length === 0);

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

  const categories: Array<{ id: ShareCategory; label: string; count?: number }> = [
    { id: "all", label: "All" },
    { id: "dm", label: "People", count: counts.dm },
    { id: "group", label: "Groups", count: counts.group },
    { id: "realm", label: "Realms", count: counts.realm },
  ];

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setQuery("");
          setCategory("all");
        }
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

        {/* Category shelf: pick where the share should go, or "All" to search
            everything at once. */}
        <div className="flex gap-1.5 overflow-x-auto overscroll-contain pb-0.5" role="tablist">
          {categories.map((item) => {
            const active = category === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCategory(item.id)}
                className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-colors ${
                  active
                    ? "border-primary/60 bg-primary/12 text-foreground"
                    : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
                {typeof item.count === "number" && item.count > 0 && (
                  <span className="text-[11px] font-bold text-muted-foreground">{item.count}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search any member, group or realm"
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

          {people.isLoading && debounced.length >= 2 && (
            <p className="px-2 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Searching people…
            </p>
          )}

          {nothing && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              Nothing matches “{query.trim()}”.
            </p>
          )}

          {showCategory("dm") && section("People", [...filtered.dms, ...filtered.extraPeople], <UserRound className="h-3 w-3" />)}
          {showCategory("group") && section("Groups", filtered.groups, <Users className="h-3 w-3" />)}
          {showCategory("realm") && section("Realms", filtered.realms, <Hash className="h-3 w-3" />)}
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
