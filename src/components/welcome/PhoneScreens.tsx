import type { ReactNode } from "react";
import {
  BatteryFull,
  Bell,
  Clapperboard,
  Heart,
  Home,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Signal,
  Wifi,
} from "lucide-react";

/**
 * Miniature product screens for the first-run tour.
 *
 * These are drawn in the same ink + lime language as the live app, instead of
 * shipping stale screenshots: the artwork stays sharp on every phone, follows
 * the brand tokens, and can never drift out of date the way a PNG does.
 */
function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto w-[188px] shrink-0 rounded-[2rem] border-[5px] border-[#111113] bg-[#111113] shadow-[0_30px_70px_-38px_rgba(17,17,19,0.7)] sm:w-[202px]"
    >
      <div className="absolute left-1/2 top-[6px] z-30 h-[13px] w-[58px] -translate-x-1/2 rounded-full bg-[#111113]" />
      <div
        className="relative overflow-hidden rounded-[1.6rem] bg-[#0b0b0c] text-[#f4f1e7]"
        style={{ aspectRatio: "9 / 18" }}
      >
        {children}
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <>
      <div className="flex items-center justify-between px-3.5 pt-2 text-[6.5px] font-semibold text-white/85">
        <span>9:41</span>
        <span className="flex items-center gap-1">
          <Signal className="h-[7px] w-[7px]" strokeWidth={2.5} />
          <Wifi className="h-[7px] w-[7px]" strokeWidth={2.5} />
          <BatteryFull className="h-[8px] w-[8px]" strokeWidth={2.5} />
        </span>
      </div>
      <div className="mx-3 mt-2 h-px bg-white/8" />
    </>
  );
}

function TabBar({ active }: { active: "feed" | "reels" | "dms" | "more" }) {
  const tabs = [
    { id: "feed", label: "Feed", icon: Home },
    { id: "reels", label: "Reels", icon: Clapperboard },
    { id: "dms", label: "DMs", icon: MessageCircle },
    { id: "more", label: "More", icon: MoreHorizontal },
  ] as const;

  return (
    <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-[#0b0b0c] px-2.5 pb-1.5 pt-1.5">
      <div className="flex items-end justify-between">
        {tabs.slice(0, 2).map((tab) => (
          <Tab key={tab.id} active={active === tab.id} icon={tab.icon} label={tab.label} />
        ))}
        <span className="grid h-6 w-6 place-items-center rounded-full bg-[#c9ff3d] text-[#0a0a0b]">
          <Plus className="h-3.5 w-3.5" strokeWidth={2.8} />
        </span>
        {tabs.slice(2).map((tab) => (
          <Tab key={tab.id} active={active === tab.id} icon={tab.icon} label={tab.label} />
        ))}
      </div>
      <div className="mx-auto mt-1 h-[2.5px] w-12 rounded-full bg-white/30" />
    </div>
  );
}

function Tab({ active, icon: Icon, label }: { active: boolean; icon: typeof Home; label: string }) {
  return (
    <span
      className={`flex w-8 flex-col items-center gap-0.5 text-[5.5px] font-semibold ${
        active ? "text-[#c9ff3d]" : "text-white/45"
      }`}
    >
      <Icon className="h-[10px] w-[10px]" strokeWidth={2.3} />
      {label}
    </span>
  );
}

function MiniAvatar({ src, alt = "" }: { src: string; alt?: string }) {
  return (
    <img
      src={src}
      alt={alt}
      className="h-5 w-5 shrink-0 rounded-full bg-white/10 object-cover"
      loading="eager"
      decoding="async"
      draggable={false}
    />
  );
}

function FeedPreview() {
  const stories = [
    "/avatars/cat-2.svg",
    "/avatars/cat-4.svg",
    "/avatars/cat-5.svg",
    "/avatars/cat-6.svg",
  ];

  return (
    <div className="relative h-full pb-12">
      <StatusBar />

      <div className="flex items-center justify-between px-3 pt-2">
        <span className="flex items-center gap-1">
          <img src="/brand/rizz-cat-logo.svg" alt="" className="h-3.5 w-3.5" />
          <span className="font-display text-[10px] font-extrabold tracking-tight">RIZZ</span>
        </span>
        <span className="flex items-center gap-2 text-white/70">
          <Search className="h-3 w-3" strokeWidth={2.2} />
          <Bell className="h-3 w-3" strokeWidth={2.2} />
        </span>
      </div>

      <div className="mt-2.5 flex items-start gap-2 px-3">
        <span className="flex flex-col items-center gap-0.5">
          <span className="grid h-7 w-7 place-items-center rounded-full border border-dashed border-[#c9ff3d]/70 text-[#c9ff3d]">
            <Plus className="h-3 w-3" strokeWidth={2.5} />
          </span>
          <span className="text-[5px] text-white/45">You</span>
        </span>
        {stories.map((src, index) => (
          <span key={src} className="flex flex-col items-center gap-0.5">
            <span className="rounded-full p-[1.5px] ring-[1.5px] ring-[#c9ff3d]">
              <MiniAvatar src={src} />
            </span>
            <span className="text-[5px] text-white/45">
              {["mara", "tobi", "june", "kaz"][index]}
            </span>
          </span>
        ))}
      </div>

      <div className="mx-2.5 mt-2 rounded-[10px] border border-white/10 bg-[#131315] p-2">
        <div className="flex items-center gap-1.5">
          <MiniAvatar src="/avatars/cat-2.svg" />
          <span className="min-w-0 flex-1">
            <span className="block text-[6.5px] font-bold text-[#c9ff3d]">mara</span>
            <span className="block text-[5px] text-white/40">#art-dump · 2m</span>
          </span>
          <MoreHorizontal className="h-2.5 w-2.5 text-white/40" />
        </div>
        <p className="mt-1.5 text-[6.5px] leading-[1.45] text-white/90">
          painted the whole thing in one sitting and now my wrist hates me. worth it.
        </p>
        <img
          src="/landing/sketch-dump.svg"
          alt=""
          className="mt-1.5 aspect-[4/3] w-full rounded-md object-cover"
          loading="eager"
          decoding="async"
          draggable={false}
        />
        <div className="mt-1.5 flex items-center gap-1">
          <span className="flex items-center gap-0.5 rounded-full border border-[#c9ff3d]/45 bg-[#c9ff3d]/10 px-1.5 py-[2px] text-[5.5px] font-semibold text-[#c9ff3d]">
            <Heart className="h-2 w-2 fill-current" strokeWidth={2} /> 12
          </span>
          <span className="rounded-full border border-white/10 px-1.5 py-[2px] text-[5.5px] text-white/55">
            🔥 4
          </span>
          <span className="rounded-full border border-white/10 px-1.5 py-[2px] text-[5.5px] text-white/55">
            💬 3
          </span>
        </div>
      </div>

      <div className="mx-2.5 mt-1.5 rounded-[10px] border border-white/10 bg-[#131315] px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <MiniAvatar src="/avatars/cat-4.svg" />
          <span className="text-[6.5px] font-semibold text-white/80">tobi</span>
          <span className="ml-auto text-[5px] text-white/35">5m</span>
        </div>
        <p className="mt-1 text-[6px] leading-snug text-white/65">
          voice room in 5? I need the full story
        </p>
      </div>

      <TabBar active="feed" />
    </div>
  );
}

function RealmsPreview() {
  const people = [
    { src: "/avatars/cat-2.svg", name: "mara" },
    { src: "/avatars/cat-4.svg", name: "tobi" },
    { src: "/avatars/cat-5.svg", name: "june" },
  ];

  return (
    <div className="relative h-full pb-12">
      <StatusBar />

      <div className="flex items-center justify-between px-3 pt-2">
        <span>
          <span className="block text-[5px] font-semibold uppercase tracking-[0.16em] text-white/40">
            Your spaces
          </span>
          <span className="font-display text-[10px] font-extrabold">Realms</span>
        </span>
        <span className="grid h-4 w-4 place-items-center rounded-full border border-white/10 text-white/65">
          <Search className="h-2.5 w-2.5" strokeWidth={2.2} />
        </span>
      </div>

      <div className="mx-2.5 mt-2.5 overflow-hidden rounded-[10px] bg-[#c9ff3d] p-2 text-[#0a0a0b]">
        <div className="flex items-center justify-between gap-1">
          <span className="font-display text-[7.5px] font-extrabold"># drops-live</span>
          <span className="flex items-center gap-1 rounded-full bg-[#0a0a0b] px-1.5 py-[2px] text-[5px] font-bold text-[#c9ff3d]">
            <span className="h-1 w-1 rounded-full bg-[#c9ff3d]" />
            LIVE
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          {people.map((person) => (
            <span key={person.name} className="flex flex-1 flex-col items-center gap-0.5">
              <span className="rounded-full bg-[#0a0a0b] p-[1.5px]">
                <MiniAvatar src={person.src} />
              </span>
              <span className="text-[5px] font-semibold">{person.name}</span>
            </span>
          ))}
          <span className="flex flex-1 flex-col items-center gap-0.5 opacity-55">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-[#0a0a0b]/15 text-[7px] font-bold">
              +
            </span>
            <span className="text-[5px] font-semibold">you?</span>
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-[#0a0a0b] px-2 py-1">
          <span className="truncate text-[5.5px] text-[#c9ff3d]">mara is drawing, come sit</span>
          <span className="shrink-0 rounded-[3px] bg-[#c9ff3d] px-1.5 py-[2px] text-[5px] font-bold text-[#0a0a0b]">
            Join
          </span>
        </div>
      </div>

      <div className="mt-2 px-2.5">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[5.5px] font-semibold uppercase tracking-[0.14em] text-white/35">
            Your realms
          </span>
          <span className="text-[5px] text-[#c9ff3d]">See all</span>
        </div>
        {[
          { name: "Chill", meta: "1 in voice", avatar: "/avatars/cat-5.svg" },
          { name: "Art dump", meta: "42 members", avatar: "/avatars/cat-2.svg" },
          { name: "Late night", meta: "8 online", avatar: "/avatars/cat-6.svg" },
        ].map((realm) => (
          <div
            key={realm.name}
            className="mt-1 flex items-center gap-1.5 rounded-[8px] border border-white/8 bg-[#131315] px-1.5 py-1.5"
          >
            <MiniAvatar src={realm.avatar} />
            <span className="min-w-0 flex-1">
              <span className="block text-[6px] font-semibold"># {realm.name}</span>
              <span className="block text-[5px] text-white/40">{realm.meta}</span>
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#c9ff3d]" />
          </div>
        ))}
      </div>

      <TabBar active="more" />
    </div>
  );
}

function MessagesPreview() {
  const threads = [
    {
      name: "mara",
      avatar: "/avatars/cat-2.svg",
      text: "sent the last panel 👀",
      time: "2m",
      unread: true,
    },
    {
      name: "tobi",
      avatar: "/avatars/cat-4.svg",
      text: "voice room in 5?",
      time: "8m",
      unread: true,
    },
    {
      name: "june",
      avatar: "/avatars/cat-5.svg",
      text: "ok but the third sketch",
      time: "1h",
      unread: false,
    },
    {
      name: "kaz",
      avatar: "/avatars/cat-6.svg",
      text: "you: on my way",
      time: "3h",
      unread: false,
    },
  ];

  return (
    <div className="relative h-full pb-12">
      <StatusBar />

      <div className="flex items-center justify-between px-3 pt-2">
        <span>
          <span className="block text-[5px] font-semibold uppercase tracking-[0.16em] text-white/40">
            Private
          </span>
          <span className="font-display text-[10px] font-extrabold">Messages</span>
        </span>
        <span className="grid h-4 w-4 place-items-center rounded-full bg-[#c9ff3d] text-[#0a0a0b]">
          <Pencil className="h-2.5 w-2.5" strokeWidth={2.4} />
        </span>
      </div>

      <div className="mx-2.5 mt-2 flex items-center gap-1.5 rounded-full border border-white/10 bg-[#131315] px-2 py-1 text-white/35">
        <Search className="h-2.5 w-2.5" strokeWidth={2.2} />
        <span className="text-[5.5px]">Search messages</span>
      </div>

      <div className="mt-2 px-2.5">
        {threads.map((thread) => (
          <div key={thread.name} className="flex items-center gap-1.5 py-1.5">
            <MiniAvatar src={thread.avatar} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1">
                <span className="text-[6.5px] font-bold">{thread.name}</span>
                {thread.unread && <span className="h-1 w-1 rounded-full bg-[#c9ff3d]" />}
              </span>
              <span className="block truncate text-[5.5px] text-white/45">{thread.text}</span>
            </span>
            <span className="self-start text-[5px] text-white/30">{thread.time}</span>
          </div>
        ))}
      </div>

      <div className="mx-2.5 mt-2 rounded-[10px] border border-[#c9ff3d]/25 bg-[#c9ff3d]/8 p-2">
        <div className="flex items-center gap-1.5">
          <MiniAvatar src="/avatars/cat-2.svg" />
          <span className="text-[6px] font-semibold text-[#c9ff3d]">mara is typing…</span>
        </div>
        <div className="mt-1.5 ml-7 w-fit rounded-lg rounded-bl-[2px] bg-[#131315] px-2 py-1 text-[6px] text-white/80">
          come sit in the voice room
        </div>
        <div className="mt-1 ml-auto w-fit rounded-lg rounded-br-[2px] bg-[#c9ff3d] px-2 py-1 text-[6px] font-medium text-[#0a0a0b]">
          omw
        </div>
      </div>

      <TabBar active="dms" />
    </div>
  );
}

export const FEATURE_PREVIEWS = [
  {
    id: "feed",
    kicker: "Your feed",
    title: "One scroll. Your whole world.",
    body: "Posts, reels, polls and timed drops from the people you actually follow — all in one place.",
    Screen: FeedPreview,
  },
  {
    id: "realms",
    kicker: "Realms & voice",
    title: "A room full of your people.",
    body: "Build a realm, start a voice room from any post, and see who's actually in before you join.",
    Screen: RealmsPreview,
  },
  {
    id: "messages",
    kicker: "Messages",
    title: "The group chat comes with you.",
    body: "Private chats, reactions, voice notes and chat stories that disappear when the moment does.",
    Screen: MessagesPreview,
  },
] as const;

export function FeaturePhone({ id }: { id: (typeof FEATURE_PREVIEWS)[number]["id"] }) {
  const feature = FEATURE_PREVIEWS.find((item) => item.id === id);
  if (!feature) return null;
  const { Screen } = feature;
  return (
    <PhoneFrame>
      <Screen />
    </PhoneFrame>
  );
}
