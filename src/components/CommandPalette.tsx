import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import {
  Bot, Home, Compass, Bell, MessageCircle, Hash, Target, Bookmark, Trophy, Users, Film, Settings, User as UserIcon, Flame, LogOut, Copy, MessageSquareText,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { UserAvatar } from "@/components/ui/avatar";
import { formatNumber } from "@/lib/formatters";
import { toast } from "@/lib/toast";

type Hit = { kind: "user"; id: string; username: string; display_name: string | null; avatar_url: string | null }
  | { kind: "tag"; tag: string; post_count: number };

const PAGES = [
  { to: "/feed", label: "Feed", icon: Home },
  { to: "/reels", label: "Reels", icon: Film },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/groups", label: "Groups", icon: Users },
  { to: "/realms", label: "Realms", icon: Hash },
  { to: "/drops", label: "Bounties", icon: Target },
  { to: "/dms", label: "Messages", icon: MessageCircle },
  { to: "/chat-stories", label: "Chat Stories", icon: MessageSquareText },
  { to: "/bookmarks", label: "Saved", icon: Bookmark },
  { to: "/badges", label: "Badges", icon: Trophy },
  { to: "/leaderboard", label: "Leaderboard", icon: Flame },
  { to: "/notifications", label: "Inbox", icon: Bell },
  { to: "/bots", label: "Bots", icon: Bot },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const nav = useNavigate();
  const { profile, signOut } = useAuth();
  const profileUsername = profile?.username;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("rizz:command-palette", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("rizz:command-palette", onOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (!open || !q.trim()) { setHits([]); return; }
    const term = q.trim().replace(/^[#@]/, "");
    let cancelled = false;
    const run = async () => {
      const [u, t] = await Promise.all([
        supabase.from("profiles").select("id,username,display_name,avatar_url").or(`username.ilike.%${term}%,display_name.ilike.%${term}%`).limit(6),
        supabase.from("hashtags").select("tag,post_count").ilike("tag", `%${term.toLowerCase()}%`).order("post_count", { ascending: false }).limit(5),
      ]);
      if (cancelled) return;
      const list: Hit[] = [];
      (u.data ?? []).forEach((r: any) => {
        if (r.username) list.push({ kind: "user", ...r });
      });
      (t.data ?? []).forEach((r: any) => list.push({ kind: "tag", tag: r.tag, post_count: r.post_count }));
      setHits(list);
    };
    const id = window.setTimeout(run, 150);
    return () => { cancelled = true; window.clearTimeout(id); };
  }, [q, open]);

  const go = (fn: () => void) => { setOpen(false); setQ(""); setTimeout(fn, 0); };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search people, tags, or jump anywhere…  (⌘K)" value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        {hits.length > 0 && (
          <CommandGroup heading="Results">
            {hits.map((h) => h.kind === "user" ? (
              <CommandItem
                key={"u" + h.id}
                value={"user " + h.username + " " + (h.display_name || "")}
                onSelect={() => go(() => nav({ to: "/u/$username", params: { username: h.username } }))}
              >
                <UserAvatar src={h.avatar_url} fallback={h.display_name || h.username} size="xs" className="mr-2" />
                <span className="font-medium">@{h.username}</span>
                {h.display_name && <span className="ml-2 text-muted-foreground text-xs truncate">{h.display_name}</span>}
              </CommandItem>
            ) : (
              <CommandItem
                key={"t" + h.tag}
                value={"tag " + h.tag}
                onSelect={() => go(() => nav({ to: "/tag/$tag", params: { tag: h.tag } }))}
              >
                <Hash className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="font-medium">#{h.tag}</span>
                <span className="ml-auto text-xs text-muted-foreground">{formatNumber(h.post_count)} posts</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandSeparator />
        <CommandGroup heading="Go to">
          {PAGES.map((p) => (
            <CommandItem key={p.to} value={"goto " + p.label} onSelect={() => go(() => nav({ to: p.to }))}>
              <p.icon className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>{p.label}</span>
            </CommandItem>
          ))}
          {profileUsername && (
            <CommandItem value="goto profile" onSelect={() => go(() => nav({ to: "/u/$username", params: { username: profileUsername } }))}>
              <UserIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>My profile</span>
            </CommandItem>
          )}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem
            value="copy profile link"
            onSelect={() => go(() => {
              if (profileUsername) {
                navigator.clipboard.writeText(`${location.origin}/u/${profileUsername}`);
                toast.success("Profile link copied to clipboard");
              }
            })}
          >
            <Copy className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Copy my profile link</span>
          </CommandItem>
          <CommandItem
            value="sign out"
            className="text-destructive focus:text-destructive"
            onSelect={() => go(() => signOut())}
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sign out</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
