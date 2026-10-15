import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bookmark, Check, ChevronDown, ChevronRight, HelpCircle, Link2, LogOut, Medal,
  Pencil, Settings, Smile, Trophy, User as UserIcon, UserPlus, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { UserAvatar } from "@/components/ui/avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CloseButton } from "@/components/ui/close-button";
import { ProfileCardDialog, bannerToneFor, formatCount } from "@/components/profile/ProfileCard";
import { CustomStatusLine, StatusIcon, AvatarStatusBadge } from "@/components/presence/StatusDot";
import { StatusEmoji } from "@/lib/cat-emoji-text";
import { PRESENCE_STATUSES, statusShortLabel, useSelfPresence } from "@/lib/presence";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type ShellProfile = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
} | null;

type SavedAccount = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  lastUsed: number;
};

const ACCOUNTS_KEY = "rizz-accounts";
const MAX_SAVED_ACCOUNTS = 3;

function loadAccounts(): SavedAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is SavedAccount =>
          !!entry && typeof entry === "object" && typeof (entry as SavedAccount).username === "string",
      )
      .slice(0, MAX_SAVED_ACCOUNTS);
  } catch {
    return [];
  }
}

/**
 * The account menu behind the avatar: a bottom sheet on phones, a dropdown
 * anchored to the avatar on desktop. Header card (banner, avatar + dot,
 * custom status, stats) opens the profile card; then Status, the
 * destination groups, switch-account, settings/help, and red sign-out.
 */
export function AccountMenu({
  profile,
  initial,
  signOut,
  compact,
  onStatus,
}: {
  profile: ShellProfile;
  initial: string;
  signOut: () => Promise<void>;
  compact?: boolean;
  onStatus?: () => void;
}) {
  const { user } = useAuth();
  const nav = useNavigate();
  const isMobile = useIsMobile();
  const selfPresence = useSelfPresence();
  const [open, setOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [statusExpanded, setStatusExpanded] = useState(false);
  const [accountsExpanded, setAccountsExpanded] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [accounts, setAccounts] = useState<SavedAccount[]>(() =>
    typeof window === "undefined" ? [] : loadAccounts(),
  );
  const dragStart = useRef<number | null>(null);

  const userId = user?.id ?? null;
  const username = profile?.username ?? null;
  const displayName = profile?.display_name || username || "Member";

  // Header stats + counts. Everything is best-effort: a missing table or a
  // denied read hides that chip instead of breaking the menu.
  const menuQuery = useQuery({
    queryKey: ["account-menu", userId ?? "anon"],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const fallback = { bannerUrl: null as string | null, rizzScore: 0, followers: 0, saved: 0, badges: 0 };
      try {
        const [prof, followers, saved, badges] = await Promise.all([
          supabase.from("profiles").select("banner_url, rizz_score").eq("id", userId!).maybeSingle(),
          supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", userId!),
          supabase.from("bookmarks").select("id", { count: "exact", head: true }).eq("user_id", userId!),
          supabase.from("user_badges").select("badge_id", { count: "exact", head: true }).eq("user_id", userId!),
        ]);
        const p = (prof.data ?? null) as { banner_url: string | null; rizz_score: number | null } | null;
        return {
          bannerUrl: p?.banner_url ?? null,
          rizzScore: Number(p?.rizz_score ?? 0),
          followers: followers.count ?? 0,
          saved: saved.count ?? 0,
          badges: badges.count ?? 0,
        };
      } catch {
        return fallback;
      }
    },
  });
  const stats = menuQuery.data;

  // Remember this account on the device (max 3) so switching is one tap.
  useEffect(() => {
    if (!userId || !username) return;
    const avatarUrl = profile?.avatar_url ?? null;
    const name = profile?.display_name || username;
    setAccounts((prev) => {
      const next = [
        { id: userId, username, displayName: name, avatarUrl, lastUsed: Date.now() },
        ...prev.filter((entry) => entry.id !== userId),
      ].slice(0, MAX_SAVED_ACCOUNTS);
      try {
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(next));
      } catch {
        /* private mode: the list just doesn't persist */
      }
      return next;
    });
  }, [userId, username, profile?.display_name, profile?.avatar_url]);

  const resetSub = () => {
    setConfirmSignOut(false);
    setStatusExpanded(false);
    setAccountsExpanded(false);
  };

  const closeThen = (fn: () => void) => {
    setOpen(false);
    resetSub();
    window.setTimeout(fn, 60);
  };

  const openCard = () => closeThen(() => setCardOpen(true));
  const openStatusSheet = () => closeThen(() => onStatus?.());

  const copyLink = async () => {
    setOpen(false);
    resetSub();
    if (!username) {
      toast.error("Couldn't copy the link");
      return;
    }
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/u/${username}`);
      toast.success("Profile link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  const doSwitchAccount = async (account?: SavedAccount) => {
    setOpen(false);
    resetSub();
    try {
      await signOut();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't sign out");
      return;
    }
    toast.info(account ? `Sign in as @${account.username}` : "Sign in with another account");
    window.location.assign("/login");
  };

  const doSignOut = async () => {
    setOpen(false);
    resetSub();
    try {
      await signOut();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't sign out");
    }
  };

  const custom = selfPresence.customStatus;
  const rowCls =
    "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm text-[#f2efe6] transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]";

  const countChip = (value: number) =>
    value > 0 ? (
      <span className="ml-auto shrink-0 rounded-full bg-[#c8ff3d]/15 px-2 py-0.5 text-[11px] font-bold text-[#c8ff3d]">
        {formatCount(value)}
      </span>
    ) : null;

  const linkInner = (Icon: typeof Bookmark, label: string, count?: number) => (
    <>
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {count !== undefined ? countChip(count) : null}
    </>
  );

  // A destination row: arrow-key navigable item on desktop, plain link in the sheet.
  const destRow = (
    to: string,
    params: Record<string, string> | undefined,
    Icon: typeof Bookmark,
    label: string,
    count?: number,
    countLabel?: string,
  ) => {
    const ariaLabel = count !== undefined && countLabel ? `${label}, ${count} ${countLabel}` : label;
    if (isMobile) {
      return (
        <Link
          key={to + label}
          to={to}
          params={params as never}
          onClick={() => {
            setOpen(false);
            resetSub();
          }}
          aria-label={ariaLabel}
          className={rowCls}
        >
          {linkInner(Icon, label, count)}
        </Link>
      );
    }
    return (
      <DropdownMenuItem key={to + label} asChild className="p-0 focus:bg-transparent">
        <Link to={to} params={params as never} aria-label={ariaLabel} className={cn(rowCls, "focus:bg-white/[0.06]")}>
          {linkInner(Icon, label, count)}
        </Link>
      </DropdownMenuItem>
    );
  };

  // A simple action row: closes the menu on desktop via onSelect.
  const actionRow = (
    key: string,
    Icon: typeof Bookmark,
    label: string,
    onAction: () => void,
    opts?: { danger?: boolean; ariaLabel?: string },
  ) => {
    const cls = opts?.danger
      ? "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm text-[#ff5d5d] transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
      : rowCls;
    if (isMobile) {
      return (
        <button key={key} type="button" onClick={onAction} aria-label={opts?.ariaLabel ?? label} className={cls}>
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        </button>
      );
    }
    return (
      <DropdownMenuItem
        key={key}
        onSelect={(event) => {
          event.preventDefault();
          onAction();
        }}
        aria-label={opts?.ariaLabel ?? label}
        className={cn("cursor-pointer focus:bg-white/[0.06]", opts?.danger && "focus:text-[#ff5d5d]")}
      >
        <span className="flex w-full items-center gap-3 px-3 py-0 text-sm">
          <Icon className={cn("h-4 w-4 shrink-0", opts?.danger ? "text-[#ff5d5d]" : "text-muted-foreground")} aria-hidden />
          <span className={cn("min-w-0 flex-1 truncate text-left", opts?.danger && "text-[#ff5d5d]")}>{label}</span>
        </span>
      </DropdownMenuItem>
    );
  };

  const sep = isMobile ? (
    <div aria-hidden className="my-1 h-px bg-[#2a2a2e]" />
  ) : (
    <DropdownMenuSeparator className="my-1 bg-[#2a2a2e]" />
  );

  const body = username ? (
    <div>
      {/* Header card: banner, avatar + dot, custom status, stats. Opens the profile card. */}
      <button
        type="button"
        onClick={openCard}
        aria-label={`Open your profile card, @${username}`}
        className="block w-full overflow-hidden rounded-2xl border border-[#2a2a2e] bg-white/[0.03] text-left transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
      >
        <span
          className="block h-20 w-full"
          style={{
            background: stats?.bannerUrl
              ? `url(${stats.bannerUrl}) center/cover`
              : bannerToneFor(userId ?? username),
          }}
          aria-hidden
        />
        <span className="flex items-center gap-3 px-3">
          <span className="relative -mt-6 inline-flex shrink-0">
            <Avatar className="h-12 w-12 rounded-full ring-2 ring-[#141416]">
              <AvatarImage src={profile?.avatar_url ?? undefined} className="object-cover" />
              <AvatarFallback className="rounded-full bg-[#1c1c1f] text-base font-bold text-[#f2efe6]">
                {initial}
              </AvatarFallback>
            </Avatar>
            <AvatarStatusBadge emoji={custom?.emoji} size={14} />
            <span className="absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full bg-[#141416] p-[2px]">
              <StatusIcon status={selfPresence.status} size={16} />
            </span>
          </span>
          <span className="min-w-0 flex-1 py-2">
            <span className="block truncate text-sm font-bold text-[#f2efe6]">{displayName}</span>
            <span className="block truncate text-xs text-muted-foreground">@{username}</span>
            <CustomStatusLine status={custom} className="mt-0.5 text-xs text-muted-foreground" />
          </span>
        </span>
        <span className="flex items-center gap-4 border-t border-white/[0.06] px-3 py-2 text-xs text-muted-foreground">
          {menuQuery.isLoading ? (
            <>
              <span className="h-3 w-16 animate-pulse rounded bg-white/10" aria-hidden />
              <span className="h-3 w-20 animate-pulse rounded bg-white/10" aria-hidden />
              <span className="sr-only">Loading stats</span>
            </>
          ) : (
            <>
              <span>
                <span className="font-bold text-[#f2efe6]">{formatCount(stats?.rizzScore ?? 0)}</span> Rizz
              </span>
              <span>
                <span className="font-bold text-[#f2efe6]">{formatCount(stats?.followers ?? 0)}</span> Followers
              </span>
            </>
          )}
        </span>
      </button>

      {/* Status submenu */}
      <div className="mt-1">
        <button
          type="button"
          onClick={() => setStatusExpanded((prev) => !prev)}
          aria-expanded={statusExpanded}
          aria-label={`Status, ${statusShortLabel(selfPresence.status)}`}
          className={rowCls}
        >
          <span className="grid h-2.5 w-2.5 shrink-0 place-items-center" aria-hidden>
            <StatusIcon status={selfPresence.status} size={10} />
          </span>
          <span className="min-w-0 flex-1 truncate text-left font-medium">Status</span>
          <span className="flex min-w-0 shrink-0 items-center gap-1 text-xs text-muted-foreground">
            {custom?.emoji ? (
              <StatusEmoji emoji={custom.emoji} size={14} />
            ) : null}
            {statusShortLabel(selfPresence.status)}
            {custom?.text ? (
              <span className="max-w-[140px] truncate">· {custom.text}</span>
            ) : null}
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", statusExpanded && "rotate-180")}
              aria-hidden
            />
          </span>
        </button>
        {statusExpanded && (
          <div className="mt-0.5 space-y-0.5 rounded-xl border border-[#2a2a2e] bg-black/40 p-1">
            {PRESENCE_STATUSES.map((entry) => {
              const selected = selfPresence.status === entry.value;
              return (
                <button
                  key={entry.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    void selfPresence.chooseStatus(entry.value).catch((error: unknown) => {
                      toast.error(error instanceof Error ? error.message : "Couldn't save status");
                    });
                    setStatusExpanded(false);
                  }}
                  className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
                >
                  <StatusIcon status={entry.value} size={18} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", selected ? "font-semibold text-[#f2efe6]" : "text-muted-foreground")}>
                      {entry.label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{entry.hint}</span>
                  </span>
                  {selected && <Check className="h-4 w-4 shrink-0 text-[#c8ff3d]" aria-label="Selected" />}
                </button>
              );
            })}
            <button
              type="button"
              onClick={openStatusSheet}
              className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
            >
              <Smile className="h-4 w-4 shrink-0 text-[#c8ff3d]" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm text-[#f2efe6]">
                {custom && (custom.emoji || custom.text)
                  ? `${custom.emoji ?? ""} ${custom.text ?? ""}`.trim()
                  : "Set a custom status"}
              </span>
              {custom && (custom.emoji || custom.text) && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Clear custom status"
                  onClick={(event) => {
                    event.stopPropagation();
                    void selfPresence.clearCustomStatus().then(
                      () => toast.success("Status cleared"),
                      (error: unknown) => toast.error(error instanceof Error ? error.message : "Couldn't clear status"),
                    );
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.stopPropagation();
                      void selfPresence.clearCustomStatus().then(
                        () => toast.success("Status cleared"),
                        (error: unknown) => toast.error(error instanceof Error ? error.message : "Couldn't clear status"),
                      );
                    }
                  }}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-[#f2efe6]"
                >
                  <X className="h-4 w-4" />
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {sep}

      {/* Group 1: destinations */}
      <div className="space-y-0.5">
        {destRow("/u/$username", { username }, UserIcon, "View profile")}
        {destRow("/settings/profile", undefined, Pencil, "Edit profile")}
        {destRow("/bookmarks", undefined, Bookmark, "Saved", stats?.saved ?? 0, "posts")}
        {destRow("/badges", undefined, Medal, "Badges", stats?.badges ?? 0, "badges")}
        {destRow("/leaderboard", undefined, Trophy, "Leaderboard")}
      </div>

      {sep}

      {/* Group 2: accounts + link */}
      <div className="space-y-0.5">
        <button
          type="button"
          onClick={() => setAccountsExpanded((prev) => !prev)}
          aria-expanded={accountsExpanded}
          aria-label="Switch account"
          className={rowCls}
        >
          <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left">Switch account</span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", accountsExpanded && "rotate-180")}
            aria-hidden
          />
        </button>
        {accountsExpanded && (
          <div className="mt-0.5 space-y-0.5 rounded-xl border border-[#2a2a2e] bg-black/40 p-1">
            {accounts.slice(0, MAX_SAVED_ACCOUNTS).map((entry) => {
              const isCurrent = entry.id === userId;
              return (
                <button
                  key={entry.id}
                  type="button"
                  disabled={isCurrent}
                  onClick={() => void doSwitchAccount(entry)}
                  aria-label={isCurrent ? `${entry.username}, current account` : `Switch to ${entry.username}`}
                  className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.08] disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={entry.avatarUrl ?? undefined} />
                    <AvatarFallback className="bg-[#1c1c1f] text-xs font-bold text-[#f2efe6]">
                      {entry.displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-[#f2efe6]">{entry.displayName}</span>
                    <span className="block truncate text-xs text-muted-foreground">@{entry.username}</span>
                  </span>
                  {isCurrent && (
                    <span className="shrink-0 rounded-full bg-[#c8ff3d]/15 px-2 py-0.5 text-[11px] font-bold text-[#c8ff3d]">
                      Current
                    </span>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => void doSwitchAccount()}
              className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left text-sm text-[#f2efe6] transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
            >
              <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              Add account
            </button>
          </div>
        )}
        {actionRow("copy-link", Link2, "Copy profile link", () => void copyLink())}
      </div>

      {sep}

      {/* Group 3: settings + help */}
      <div className="space-y-0.5">
        {destRow("/settings", undefined, Settings, "Settings")}
        {actionRow("help", HelpCircle, "Help & feedback", () => closeThen(() => setHelpOpen(true)))}
      </div>

      {sep}

      {/* Group 4: sign out */}
      {confirmSignOut ? (
        <div className="flex min-h-12 items-center justify-between gap-2 px-3" role="alert">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#ff5d5d]">
            Sign out of @{username}?
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => void doSignOut()}
              className="min-h-11 rounded-lg bg-[#ff5d5d]/20 px-3 text-xs font-bold text-[#ff5d5d] transition-colors hover:bg-[#ff5d5d]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
            >
              Sign out
            </button>
            <button
              type="button"
              onClick={() => setConfirmSignOut(false)}
              className="min-h-11 rounded-lg bg-white/5 px-3 text-xs text-muted-foreground transition-colors hover:text-[#f2efe6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
            >
              Cancel
            </button>
          </span>
        </div>
      ) : (
        actionRow("sign-out", LogOut, "Sign out", () => setConfirmSignOut(true), {
          danger: true,
          ariaLabel: "Sign out",
        })
      )}
    </div>
  ) : (
    <div className="space-y-2 p-1" role="status" aria-label="Loading account">
      <div className="h-11 animate-pulse rounded-xl bg-white/5" />
      <div className="h-11 animate-pulse rounded-xl bg-white/5" />
      <div className="h-11 animate-pulse rounded-xl bg-white/5" />
    </div>
  );

  const triggerLabel = username
    ? `Your profile, @${username}. Status: ${statusShortLabel(selfPresence.status)}`
    : "Your profile";
  const triggerClass = `relative flex items-center gap-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
    compact
      ? "h-11 w-11 justify-center rounded-full hover:bg-surface-2 active:bg-surface-3"
      : "min-h-[44px] w-full rounded-xl p-2 hover:bg-surface-2"
  }`;
  const triggerInner = (
    <>
      <span className="relative inline-flex items-center justify-center">
        <UserAvatar
          src={profile?.avatar_url}
          fallback={initial}
          size={compact ? "sm" : "md"}
          presence={custom?.emoji ? undefined : selfPresence.status}
        />
        {custom?.emoji && (
          <span className="pointer-events-none absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center overflow-hidden rounded-full bg-background ring-1 ring-border leading-none">
            <StatusEmoji emoji={custom.emoji} size={12} />
          </span>
        )}
      </span>
      {!compact && (
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-medium text-foreground">{displayName}</span>
          <span className="block truncate text-xs text-muted-foreground">@{username ?? "…"}</span>
        </span>
      )}
    </>
  );

  return (
    <>
      {isMobile ? (
        <>
          <button type="button" onClick={() => { resetSub(); setOpen(true); }} aria-label={triggerLabel} className={triggerClass}>
            {triggerInner}
          </button>
          <Sheet
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) resetSub();
            }}
          >
            <SheetContent
              side="bottom"
              className="max-h-[85dvh] overflow-y-auto rounded-t-3xl border-white/10 bg-[#141416] px-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
            >
              <SheetTitle className="sr-only">Your account</SheetTitle>
              <div
                onTouchStart={(event) => {
                  dragStart.current = event.touches[0]?.clientY ?? null;
                }}
                onTouchEnd={(event) => {
                  if (dragStart.current === null) return;
                  const end = event.changedTouches[0]?.clientY ?? dragStart.current;
                  if (end - dragStart.current > 120) {
                    setOpen(false);
                    resetSub();
                  }
                  dragStart.current = null;
                }}
              >
                <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-white/25" aria-hidden />
                {body}
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <DropdownMenu
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) resetSub();
          }}
        >
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={triggerLabel} className={triggerClass}>
              {triggerInner}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            collisionPadding={8}
            className="max-h-[85dvh] w-[300px] overflow-y-auto rounded-2xl border border-[#2a2a2e] bg-[#141416] p-2 shadow-2xl"
          >
            {body}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {userId && username && (
        <ProfileCardDialog
          user={{
            userId,
            username,
            displayName: profile?.display_name ?? username,
            avatarUrl: profile?.avatar_url ?? null,
          }}
          open={cardOpen}
          onOpenChange={setCardOpen}
        />
      )}

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent
          hideClose
          className="w-[calc(100vw-2rem)] max-w-sm gap-0 overflow-hidden rounded-3xl border-white/10 bg-[#141416] p-0"
        >
          <DialogTitle className="sr-only">Help and feedback</DialogTitle>
          <div className="flex items-center justify-between gap-2 px-4 pt-4">
            <h3 className="font-display text-base font-bold text-[#f2efe6]">Help & feedback</h3>
            <CloseButton aria-label="Close help" onClick={() => setHelpOpen(false)} />
          </div>
          <div className="space-y-1 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
            <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-muted-foreground">
              Press <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-[#f2efe6]">?</kbd>{" "}
              anywhere for keyboard shortcuts.
            </p>
            <Link
              to="/bots/developer"
              onClick={() => setHelpOpen(false)}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm text-[#f2efe6] transition-colors hover:bg-white/[0.06]"
            >
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              Bots & developer tools
            </Link>
            <Link
              to="/settings/account"
              onClick={() => setHelpOpen(false)}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm text-[#f2efe6] transition-colors hover:bg-white/[0.06]"
            >
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              Account & data settings
            </Link>
            <p className="px-1 pt-1 text-xs text-muted-foreground">
              Something broken? Use Report in any profile menu and a moderator will take a look.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
