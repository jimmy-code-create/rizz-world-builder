import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Bell,
  ChevronRight,
  Palette,
  Shield,
  Sliders,
  UserCog,
  UserRound,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { applyPrefs, loadPrefs } from "@/lib/prefs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PresenceSheet } from "@/components/presence/PresenceSheet";
import { AvatarWithStatus, CustomStatusLine } from "@/components/presence/StatusDot";
import { statusLabel, useSelfPresence } from "@/lib/presence";

export const Route = createFileRoute("/_app/settings/")({
  head: () => ({ meta: [{ title: "Settings · RIZZ" }] }),
  component: SettingsHubPage,
});

type SettingsSection = {
  to:
    | "/settings/profile"
    | "/settings/appearance"
    | "/settings/notifications"
    | "/settings/preferences"
    | "/settings/voice"
    | "/settings/blocked"
    | "/settings/account";
  label: string;
  description: string;
  icon: LucideIcon;
};

const SECTIONS: SettingsSection[] = [
  { to: "/settings/profile", label: "Profile", description: "Name, bio, avatar and banner", icon: UserRound },
  { to: "/settings/appearance", label: "Appearance", description: "Theme, mode, density and motion", icon: Palette },
  { to: "/settings/notifications", label: "Notifications", description: "Push alerts and delivery", icon: Bell },
  { to: "/settings/voice", label: "Voice & Sound", description: "Bot, call and alert volume, mic and devices", icon: Volume2 },
  { to: "/settings/preferences", label: "Preferences", description: "Feeds, media, text size and language", icon: Sliders },
  { to: "/settings/blocked", label: "Blocked accounts", description: "People you've blocked", icon: Shield },
  { to: "/settings/account", label: "Account", description: "Your data, sign out and delete", icon: UserCog },
];

function SettingsHubPage() {
  const { profile } = useAuth();
  const [statusOpen, setStatusOpen] = useState(false);
  const presence = useSelfPresence();

  useEffect(() => {
    applyPrefs(loadPrefs());
  }, []);

  if (!profile) return null;
  const initial = (profile.display_name || profile.username || "?").charAt(0).toUpperCase();

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="font-display text-xl sm:text-2xl font-bold">Settings</h1>

      <Link
        to="/settings/profile"
        className="flex items-center gap-3.5 rounded-2xl border border-white/5 glass p-3.5 transition-colors hover:bg-white/5"
      >
        <Avatar className="h-12 w-12 ring-2 ring-primary/40">
          <AvatarImage src={profile.avatar_url ?? undefined} />
          <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">{initial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{profile.display_name || profile.username}</p>
          <p className="truncate text-xs text-muted-foreground">@{profile.username}</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </Link>

      <button
        type="button"
        onClick={() => setStatusOpen(true)}
        className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-white/5 glass px-4 py-2.5 text-left transition-colors hover:bg-white/5"
      >
        <AvatarWithStatus status={presence.status} dotSize={11}>
          <Avatar className="h-10 w-10">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">{initial}</AvatarFallback>
          </Avatar>
        </AvatarWithStatus>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Status</span>
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <span className="shrink-0">{statusLabel(presence.status)}</span>
            {presence.customStatus && <CustomStatusLine status={presence.customStatus} className="min-w-0" />}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      <nav className="overflow-hidden rounded-2xl border border-white/5 glass">
        {SECTIONS.map((section, index) => (
          <Link
            key={section.to}
            to={section.to}
            className={`flex min-h-[56px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/5 ${
              index > 0 ? "border-t border-white/5" : ""
            }`}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-primary">
              <section.icon className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold leading-tight">{section.label}</span>
              <span className="block truncate text-xs text-muted-foreground mt-0.5">{section.description}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </nav>

      <PresenceSheet open={statusOpen} onOpenChange={setStatusOpen} />
    </div>
  );
}
