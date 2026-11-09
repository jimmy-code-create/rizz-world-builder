import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageSquare, Mic, Rss, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { MediaFrame } from "@/components/MediaFrame";
import { useAuth } from "@/lib/auth";
import { getPostAuthPath } from "@/lib/onboarding";

const faqs = [
  {
    q: "What is Rizzup?",
    a: "Rizzup is the nickname and web address for RIZZ, a free social app that combines a feed, topic realms, live voice rooms, DMs and 24-hour chat stories in one place.",
  },
  {
    q: "What is the official Rizzup website?",
    a: "The official RIZZ site is rizzup.space — look for the lime RIZZ cat logo. RIZZ is not affiliated with other apps or services that use a similar name.",
  },
  {
    q: "Is Rizzup a dating app?",
    a: "No. Rizzup (RIZZ) is a social app for feeds, realms, voice rooms and group chats, not a dating app or a follower-growth service.",
  },
  {
    q: "What does “rizz” mean?",
    a: "Rizz is Gen Z slang for charisma or charm. RIZZ (Rizzup) is also the name of this social app: a place to post, reply, join a realm and hop into voice, not a dictionary entry.",
  },
  {
    q: "Is RIZZ free to join?",
    a: "Yes. RIZZ is free to join at rizzup.space — no card required. Pick a username, then post, reply, message and join a voice room from your browser.",
  },
  {
    q: "What can you do on RIZZ?",
    a: "Share photos, reels, polls and timed drops, reply in threads, build a realm with channels and roles, start a voice room, send DMs and voice notes, play games and earn badges.",
  },
  {
    q: "Do I need to install an app?",
    a: "No. RIZZ runs in your browser and can be installed as a progressive web app on your phone's home screen. Open rizzup.space to start.",
  },
  {
    q: "How do I find RIZZ online?",
    a: "Search for Rizzup or RIZZ social app, or go directly to rizzup.space. The official site is the one at rizzup.space with the lime RIZZ cat logo.",
  },
];

const PAGE_TITLE = "Rizzup (RIZZ) — free social app for feeds, realms & voice";
const PAGE_DESCRIPTION =
  "Rizzup (RIZZ) is the free social app for Gen Z: a feed, realms, live voice rooms, DMs, games and 24-hour chat stories. Join at rizzup.space.";
const OG_IMAGE_ALT =
  "The RIZZ cat logo beside the lowercase rizz wordmark on a lime, violet and ink gradient.";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: PAGE_TITLE },
      { name: "description", content: PAGE_DESCRIPTION },
      { property: "og:title", content: PAGE_TITLE },
      { property: "og:description", content: PAGE_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://rizzup.space/" },
      { property: "og:image", content: "https://rizzup.space/og-banner.jpg" },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: OG_IMAGE_ALT },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: PAGE_TITLE },
      { name: "twitter:description", content: PAGE_DESCRIPTION },
      { name: "twitter:image", content: "https://rizzup.space/og-banner.jpg" },
      { name: "twitter:image:alt", content: OG_IMAGE_ALT },
    ],
    links: [{ rel: "canonical", href: "https://rizzup.space/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "@id": "https://rizzup.space/#faq",
          mainEntity: faqs.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          "@id": "https://rizzup.space/#webpage",
          url: "https://rizzup.space/",
          name: PAGE_TITLE,
          description: PAGE_DESCRIPTION,
          isPartOf: { "@id": "https://rizzup.space/#website" },
          about: { "@id": "https://rizzup.space/#organization" },
          inLanguage: "en",
          primaryImageOfPage: {
            "@type": "ImageObject",
            url: "https://rizzup.space/og-banner.jpg",
            width: 1200,
            height: 630,
          },
        }),
      },
    ],
  }),
});

function Index() {
  const { user, profile, loading, profileError, refreshProfile } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (loading || !user || profileError) return;
    void nav({ to: getPostAuthPath(profile) });
  }, [loading, user, profile, profileError, nav]);

  if (user && profileError) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">{profileError}</p>
        <Button variant="outline" onClick={() => void refreshProfile()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteNav />
      <BrandBanner />

      {/* ---- Hero: asymmetric split, type left, a real product crop right ---- */}
      <section aria-labelledby="hero-title" className="shell-gutter pt-10 pb-14 md:pt-20 md:pb-24">
        <div className="mx-auto grid max-w-[1400px] gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-7">
            <p className="mb-5 font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--brand-signal)]">
              Rizzup · feed + realms + voice
            </p>
            <h2 id="hero-title" className="type-display">
              Your feed.
              <br />
              Your server.
              <br />
              Your world.
            </h2>
            {/* Two lines on a phone. The headline already carries the message. */}
            <p className="type-lead mt-6 max-w-lg">
              RIZZ, also known as Rizzup, is the social app where you post once, take it to the
              replies, then to voice.
            </p>
            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link to="/signup">
                <Button size="lg" className="h-12 rounded-[6px] px-7 text-base font-semibold">
                  Claim your @
                </Button>
              </Link>
              <Link to="/feed">
                <Button size="lg" variant="outline" className="h-12 rounded-[6px] px-7 text-base">
                  Poke around the feed
                </Button>
              </Link>
            </div>
            <p className="mt-4 max-w-md text-[13px] text-muted-foreground">
              Free. No card. Takes about thirty seconds, mostly spent choosing a username.
            </p>
          </div>

          <div className="lg:col-span-5">
            <ProductCrop />
          </div>
        </div>
      </section>

      {/* ---- Product: icon + text rows, no cards ---- */}
      <section className="shell-gutter shell-section border-t border-border">
        <div className="mx-auto max-w-[1400px]">
          <h2 className="type-title max-w-2xl">Four things, one app, no app-switching.</h2>
          <dl className="mt-10 border-t border-border">
            {pillars.map((item, i) => (
              <div
                key={item.title}
                className="border-b border-border py-6 md:grid md:grid-cols-[3rem_2.25rem_13rem_1fr] md:items-center md:gap-x-6"
              >
                {/* Phone: number, tile and title share one line; desktop: the
                    wrapper dissolves (md:contents) into the four-column grid. */}
                <div className="flex items-center gap-3 md:contents">
                  <span className="font-mono text-xs text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {/* One shared tile keeps every glyph the same size and centred. */}
                  <IconTile size="sm" className="border border-border bg-card text-foreground">
                    <item.icon />
                  </IconTile>
                  <dt className="font-display text-lg font-semibold">{item.title}</dt>
                </div>
                <dd className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground md:mt-0">
                  {item.body}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---- Community: pull quote + an example conversation ---- */}
      <section className="shell-gutter shell-section border-t border-border">
        <div className="mx-auto grid max-w-[1400px] gap-12 lg:grid-cols-12 lg:gap-16">
          <blockquote className="lg:col-span-5 lg:pt-6">
            <p className="font-display text-2xl leading-snug md:text-4xl">
              “I used to screenshot the same photo into three apps. Now it goes up once and the
              conversation happens right under it.”
            </p>
            <footer className="mt-6 text-sm text-muted-foreground">@mara · posts in #art-dump</footer>
          </blockquote>

          <div className="lg:col-span-7 lg:pl-6">
            <div className="flex items-center justify-between gap-4">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                #art-dump
              </p>
              {/* Honest labelling: this transcript is a mock, and it says so. */}
              <span className="rounded-[4px] border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                example
              </span>
            </div>
            <ul className="mt-5 border-l-2 border-[var(--brand-signal)] pl-5">
              {chatLines.map((line, i) => (
                <li
                  key={line.name + line.text}
                  className="grid grid-cols-[1.5rem_1fr] gap-3 pb-4 last:pb-0"
                  style={{ ["--delay" as string]: `${i * 900}ms` }}
                >
                  <span className="relative mt-0.5 h-4">
                    <span aria-hidden className="anim-typing absolute inset-0 flex items-center gap-0.5">
                      {[0, 1, 2].map((dot) => (
                        <span
                          key={dot}
                          className="anim-typing-dot h-1 w-1 rounded-full bg-muted-foreground"
                          style={{ animationDelay: `${dot * 120}ms` }}
                        />
                      ))}
                    </span>
                  </span>
                  {/* The dots land first, the message follows ~300ms later, so each
                      line reads as a reply rather than a block that fades in. */}
                  <div className="anim-rise" style={{ animationDelay: "calc(var(--delay) + 280ms)" }}>
                    <p className="font-display text-sm font-semibold" style={{ color: line.color }}>
                      {line.name}
                      <span className="ml-2 font-sans text-[11px] font-normal text-muted-foreground">
                        {line.time}
                      </span>
                    </p>
                    <p className="text-sm leading-relaxed text-foreground/90">{line.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---- The one loud section: full-bleed lime voice-room band ---- */}
      <section className="bg-[var(--brand-signal)] text-[var(--brand-signal-ink)]">
        {/* The loud section also mirrors the page: on desktop the room sits left
            and the copy right, opposite the hero and the pull quote. Padding is
            its own scale (tighter on a phone, roomier on a desktop) instead of
            repeating the dark sections' rhythm. */}
        <div className="shell-gutter mx-auto grid max-w-[1400px] gap-12 py-14 md:py-28 lg:grid-cols-12 lg:items-center lg:gap-16">
          <div className="lg:order-2 lg:col-span-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] opacity-70">Voice rooms</p>
            <h2 className="type-title mt-5 max-w-xl text-[var(--brand-signal-ink)]">
              The feed is better with you in it.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed opacity-80">
              Start a room from any post. Presence shows who is actually in it, so you never walk into
              an empty stage.
            </p>
            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link to="/signup">
                <Button
                  size="lg"
                  className="h-12 rounded-[6px] border-0 bg-[var(--brand-signal-ink)] px-7 text-base font-semibold text-[var(--brand-signal)] hover:bg-[var(--brand-signal-ink)]/90"
                >
                  Claim your @
                </Button>
              </Link>
              <Link
                to="/feed"
                className="text-sm font-medium underline decoration-2 underline-offset-4 hover:no-underline"
              >
                Or read the feed first
              </Link>
            </div>
          </div>

          <div className="lg:order-1 lg:col-span-7">
            <VoiceRoomMock />
          </div>
        </div>
      </section>

      {/* ---- FAQ: the brand answers, in the same language people search with ---- */}
      <section aria-labelledby="faq-title" className="shell-gutter shell-section border-t border-border">
        <div className="mx-auto max-w-[920px]">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--brand-signal)]">
            FAQ
          </p>
          <h2 id="faq-title" className="type-title mt-4">
            Rizzup, explained.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            New here? These are the questions people ask before they claim a username.
          </p>
          <dl className="mt-10 border-t border-border">
            {faqs.map((item) => (
              <div
                key={item.q}
                className="border-b border-border py-6 md:grid md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:gap-10"
              >
                <dt className="font-display text-lg font-semibold">{item.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-foreground md:mt-0">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <footer className="shell-gutter border-t border-border py-8">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 text-[13px] text-muted-foreground">
          <span>RIZZ (Rizzup) — built by people who post too much.</span>
          <div className="flex items-center gap-5">
            <Link to="/login" className="hover:text-foreground">
              Log in
            </Link>
            <Link to="/signup" className="hover:text-foreground">
              Create an account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * The masthead: the cat mark and the wordmark and nothing else, on the same
 * lime-to-violet wash as the social card. Typing "rizzup" anywhere on the page
 * earns a small smile in the corner.
 */
function BrandBanner() {
  const smiling = useRizzupSmile();

  return (
    <section
      aria-labelledby="brand-banner-title"
      className={`brand-banner${smiling ? " is-smiling" : ""}`}
    >
      <div className="brand-banner__inner">
        <h1 id="brand-banner-title" className="brand-banner__lockup">
          <img
            src="/brand/rizz-cat-logo.svg"
            alt=""
            width={112}
            height={112}
            className="brand-banner__logo"
          />
          <span aria-hidden="true" className="brand-banner__word">
            rizz
          </span>
          <span className="sr-only">
            RIZZ, also known as Rizzup — the social app for feeds, realms and voice rooms.
          </span>
        </h1>
        <span aria-hidden="true" className="brand-banner__smile">
          <svg viewBox="0 0 48 26" fill="none" className="h-auto w-full">
            <path
              d="M7 6c3 7.5 9.2 12 17 12s14-4.5 17-12"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <circle cx="16" cy="11" r="1.5" fill="currentColor" />
            <circle cx="32" cy="11" r="1.5" fill="currentColor" />
          </svg>
        </span>
      </div>
    </section>
  );
}

/** Listens for the brand name as a typed sequence, then lets it fade. */
function useRizzupSmile() {
  const [smiling, setSmiling] = useState(false);

  useEffect(() => {
    let typed = "";
    let timer: number | undefined;

    const trigger = () => {
      setSmiling(true);
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setSmiling(false), 2800);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.key.length !== 1) return;
      typed = (typed + event.key.toLowerCase()).slice(-6);
      if (typed === "rizzup") {
        typed = "";
        trigger();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    if (/rizzup/i.test(`${window.location.search}${window.location.hash}`)) trigger();

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return smiling;
}

function SiteNav() {
  return (
    <header className="shell-gutter sticky top-0 z-20 border-b border-border bg-background">
      <nav className="mx-auto flex max-w-[1400px] items-center justify-between py-4">
        <Link to="/" className="flex items-center gap-2.5" aria-label="RIZZ (Rizzup) home">
          <img src="/brand/rizz-cat-logo.svg" alt="" className="h-7 w-7 shrink-0" />
          <span className="font-display text-lg font-bold tracking-tight">RIZZ</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/login"
            className="rounded-[6px] px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-[var(--brand-ink-3)] hover:text-foreground"
          >
            Log in
          </Link>
          <Link to="/signup">
            <Button className="h-9 rounded-[6px] px-4 text-sm font-semibold">Claim your @</Button>
          </Link>
        </div>
      </nav>
    </header>
  );
}

/**
 * The hero visual is the product itself: a real post card in the same markup the
 * feed uses, with a real sketch as its media (see /landing/sketch-dump.svg) and
 * a frame that reserves height, shimmers while loading and labels a failed load.
 */
function ProductCrop() {
  return (
    <div className="rounded-[10px] border border-border bg-card p-3 shadow-[var(--shadow-2)] sm:p-4">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <img src="/avatars/cat-2.svg" alt="" className="h-9 w-9 rounded-full" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold text-[var(--brand-signal)]">
            @mara
          </p>
          <p className="truncate text-[11px] text-muted-foreground">posted in #art-dump · 2m</p>
        </div>
        {/* Both a demo post and a demo transcript are labelled, so no number on
            this page reads as live product data. */}
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-[4px] border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            realm
          </span>
          <span className="rounded-[4px] border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            example
          </span>
        </div>
      </div>

      <p className="pt-3 text-sm leading-relaxed">
        painted the whole thing in one sitting and now my wrist hates me. worth it.
      </p>

      <MediaFrame
        className="mt-3"
        ratio="4 / 3"
        eager
        src="/landing/sketch-dump.svg"
        alt="Sketch dump: a cat drawn in pencil beside two smaller studies"
        fallback="Artwork unavailable"
        imgClassName="bg-[var(--brand-ink)]"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {[
          ["❤️", 12, true],
          ["🔥", 4, false],
          ["😂", 2, false],
        ].map(([emoji, count, mine]) => (
          <span
            key={String(emoji)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
              mine
                ? "border-[var(--brand-signal)] bg-[color-mix(in_srgb,var(--brand-signal)_18%,transparent)] text-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            <span aria-hidden>{emoji}</span>
            <span className="font-mono">{count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * A large, quiet mockup of a live room — the visual anchor of the lime band.
 * The presence dots are decorative, but the one on the room is the only slow
 * effect on the page and it stops entirely under reduced motion.
 */
function VoiceRoomMock() {
  const people = [
    { name: "mara", avatar: "/avatars/cat-2.svg", inRoom: true },
    { name: "tobi", avatar: "/avatars/cat-4.svg", inRoom: true },
    { name: "june", avatar: "/avatars/cat-5.svg", inRoom: true },
    { name: "kaz", avatar: "/avatars/cat-6.svg", inRoom: false },
  ];

  return (
    <div className="rounded-[10px] border border-[var(--brand-signal-ink)]/15 bg-[var(--brand-paper)] p-4 text-[var(--brand-signal-ink)] shadow-[var(--shadow-2)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--brand-signal-ink)]/12 pb-4">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 shrink-0" aria-hidden />
          <span className="font-display text-base font-bold"># drops-live</span>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-signal-ink)]/15 px-3 py-1 text-xs font-semibold">
          <span
            aria-hidden
            className="anim-presence h-2 w-2 rounded-full bg-[var(--brand-signal-ink)] text-[var(--brand-signal-ink)]"
          />
          3 in voice
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {people.map((person) => (
          <div key={person.name} className="flex flex-col items-center gap-2 text-center">
            <div className="relative">
              <img
                src={person.avatar}
                alt=""
                className={`h-14 w-14 rounded-full ${person.inRoom ? "" : "opacity-45"}`}
                loading="lazy"
                decoding="async"
              />
              <span
                aria-hidden
                className={`absolute -bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--brand-paper)] ${
                  person.inRoom ? "bg-[var(--brand-signal)]" : "bg-[var(--brand-signal-ink)]/25"
                }`}
              />
            </div>
            <span className="text-xs font-semibold">{person.name}</span>
            <span className="text-[10px] uppercase tracking-wider opacity-60">
              {person.inRoom ? "in voice" : "idle"}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between gap-4 rounded-[8px] border border-[var(--brand-signal-ink)]/12 px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate text-sm opacity-80">mara is drawing, come sit</span>
        <span className="rounded-[6px] bg-[var(--brand-signal-ink)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-signal)]">
          Join room
        </span>
      </div>
    </div>
  );
}

const pillars = [
  {
    icon: Rss,
    title: "The feed",
    body: "Photos, reels, polls and timed drops from people you follow. Chronological-ish, because a feed you can predict is a feed you can leave.",
  },
  {
    icon: Users,
    title: "Realms",
    body: "Every profile carries channels — #vibes, #drops, #art-dump — with roles, moderation and permissions. No server setup, no invite gymnastics.",
  },
  {
    icon: Mic,
    title: "Voice",
    body: "Start a room from a post or a channel and presence shows who is actually in it. Works on a phone, in a browser, no downloads.",
  },
  {
    icon: MessageSquare,
    title: "Messages & chat stories",
    body: "Private chat with reactions, wallpapers and voice notes, plus stories that disappear after 24 hours.",
  },
];

/**
 * Palette rule for the example conversation: the post author is lime, everyone
 * else is cream, timestamps stay muted. No per-handle rainbow.
 */
const chatLines = [
  { name: "mara", color: "var(--brand-signal)", time: "21:04", text: "new sketch dump is up, be nice" },
  { name: "tobi", color: "var(--brand-paper)", time: "21:05", text: "the third one is unreal. how long did it take?" },
  { name: "mara", color: "var(--brand-signal)", time: "21:06", text: "four hours and one burnt dinner" },
  { name: "june", color: "var(--brand-paper)", time: "21:07", text: "voice room in 5? I want the full story" },
];
