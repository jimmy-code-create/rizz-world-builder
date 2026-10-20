import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  Compass,
  Heart,
  Info,
  Loader2,
  MessageCircle,
  Paintbrush,
  PawPrint,
  Search,
  Sparkles,
  Trophy,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/Badge";
import { Rizzy, type RizzyPose } from "@/components/rizzy/Rizzy";
import { cn } from "@/lib/utils";
import "./rizzy-tour.css";

export type RizzyTourProfile = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  interests: string[] | null;
  accent_color?: string | null;
} | null;

type SceneBullet = {
  icon: LucideIcon;
  title: string;
  text: string;
};

type Scene = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  pose: RizzyPose;
  bubble: string;
  bullets: SceneBullet[];
  note?: string;
};

const SCENES: Scene[] = [
  {
    id: "welcome",
    kicker: "Welcome",
    title: "Hey! I'm Rizzy. Welcome to Rizz!",
    body: "I'm your tour guide, your hype cat, and the reason your cursor keeps drifting left. Let me show you around — eight quick scenes, no homework.",
    pose: "wave",
    bubble: "Let's get you settled.",
    bullets: [
      {
        icon: Sparkles,
        title: "Built for real people",
        text: "A feed, communities, realms, voice and DMs — all in one place.",
      },
      {
        icon: Heart,
        title: "No cold starts",
        text: "Your interests help Rizz surface people and rooms that get you.",
      },
    ],
  },
  {
    id: "profile",
    kicker: "Your corner",
    title: "Create your profile",
    body: "Your profile is your home base. Pick a photo or one of our built-in cats, keep your username, and add a bio that sounds like you.",
    pose: "point",
    bubble: "This part is all yours.",
    bullets: [
      {
        icon: UserRound,
        title: "Face + name",
        text: "A picture, a display name and your @ — the basics people see first.",
      },
      {
        icon: Paintbrush,
        title: "Bio + interests",
        text: "Say what you're into so the right people can find you.",
      },
    ],
    note: "You can change any of it later in Settings → Profile.",
  },
  {
    id: "discover",
    kicker: "Find your people",
    title: "Discover people",
    body: "Explore the feed, follow interests, join groups and drop into realms. Rizz puts people, communities and creators within paw's reach.",
    pose: "point",
    bubble: "Your people are closer than you think.",
    bullets: [
      {
        icon: Compass,
        title: "Explore by interest",
        text: "Music, gaming, art, memes — the feed follows your energy.",
      },
      {
        icon: Users,
        title: "Find your crowd",
        text: "Join groups and realms built around what you love.",
      },
    ],
  },
  {
    id: "chat",
    kicker: "Say something",
    title: "Start chatting",
    body: "Slide into a DM, reply in a post, or start a group chat. React, share and keep the conversation moving.",
    pose: "chat",
    bubble: "Say something. I dare you.",
    bullets: [
      {
        icon: MessageCircle,
        title: "DMs + group chats",
        text: "One-to-one or a whole room — start where it feels right.",
      },
      {
        icon: Heart,
        title: "Replies + reactions",
        text: "Keep it light, keep it moving, keep it you.",
      },
    ],
  },
  {
    id: "vibe",
    kicker: "Make it yours",
    title: "Customize your vibe",
    body: "Try an accent color, choose a theme, and wear a cinematic profile effect or avatar decoration. Your profile should look like you, not a template.",
    pose: "present",
    bubble: "Make it loud. Or very quiet.",
    bullets: [
      {
        icon: Sparkles,
        title: "Effects that move",
        text: "One full-profile loop and three animated avatar decorations in Effects.",
      },
      {
        icon: Paintbrush,
        title: "Accent, theme, nameplate",
        text: "Tune the details that make your corner feel like yours.",
      },
    ],
    note: "Effects are live. Unlock a look with Paws, then apply it from the Effects page.",
  },
  {
    id: "rewards",
    kicker: "Show up, collect",
    title: "Collect Paws",
    body: "Paws are RIZZ's currency — earned by claiming bounties. Spend them on a full-profile effect or an animated avatar decoration. No purchase is required to earn them.",
    pose: "paw",
    bubble: "Earned in bounties.",
    bullets: [
      {
        icon: PawPrint,
        title: "Claim bounties",
        text: "Every successful claim adds Paws to your wallet.",
      },
      {
        icon: Sparkles,
        title: "Spend in Effects",
        text: "Unlock a look and apply it straight to your profile.",
      },
    ],
    note: "Paws are live. Claim a bounty, then spend them on the Effects page.",
  },
  {
    id: "badges",
    kicker: "Proof you showed up",
    title: "Achievements",
    body: "Badges are proof you showed up. Unlock them through real milestones — your first post, 100 likes, 100 messages, leaderboard ranks, game wins and more.",
    pose: "badge",
    bubble: "Real work. Real proof.",
    bullets: [
      {
        icon: Trophy,
        title: "Real milestones",
        text: "No pay-to-win badges. The work is the point.",
      },
      {
        icon: BadgeCheck,
        title: "Wear the proof",
        text: "Feature a badge on your profile when you earn one.",
      },
    ],
  },
  {
    id: "ready",
    kicker: "Your move",
    title: "You're all set. Go make your mark!",
    body: "That's the tour. Post something, find your people, and make this place yours. I'll be around.",
    pose: "celebrate",
    bubble: "Go make your mark!",
    bullets: [
      {
        icon: Sparkles,
        title: "Start anywhere",
        text: "Open the feed, say hi in a community, or finish your profile.",
      },
    ],
    note: "You can replay this tour any time from Settings.",
  },
];

export function RizzyTour({
  profile,
  replay = false,
  busy = false,
  error = "",
  reducedMotion = false,
  onFinish,
  onSkip,
  onBackToOnboarding,
  initialSceneIndex = 0,
}: {
  profile: RizzyTourProfile;
  replay?: boolean;
  busy?: boolean;
  error?: string;
  /** Mirrors the account's reduced-motion setting into the tour. */
  reducedMotion?: boolean;
  onFinish: () => void | Promise<void>;
  onSkip: () => void | Promise<void>;
  /** What Back does on scene 1: onboarding returns to the profile step, replay exits. */
  onBackToOnboarding?: () => void;
  /** Used by the preview harness and deep links; the normal flow starts at 0. */
  initialSceneIndex?: number;
}) {
  const safeStart = Math.min(Math.max(0, Math.round(initialSceneIndex)), SCENES.length - 1);
  const [index, setIndex] = useState(safeStart);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const scene = SCENES[index]!;
  const isLast = index === SCENES.length - 1;
  const isFirst = index === 0;
  const hasMounted = useRef(false);

  function go(next: number) {
    if (busy) return;
    if (next < 0) {
      onBackToOnboarding?.();
      return;
    }
    if (next >= SCENES.length || next === index) return;
    setDirection(next > index ? "forward" : "back");
    setIndex(next);
  }

  function advance() {
    if (busy) return;
    if (isLast) {
      void onFinish();
      return;
    }
    go(index + 1);
  }

  function retreat() {
    if (busy) return;
    if (isFirst) {
      onBackToOnboarding?.();
      return;
    }
    go(index - 1);
  }

  // A new scene starts at its stage, not at the controls the visitor just tapped.
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    const prefersReduced =
      reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
  }, [index, reducedMotion]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        advance();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        retreat();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const dirClass = direction === "forward" ? "rz-enter-forward" : "rz-enter-back";

  return (
    <div className="rz-tour" data-reduced-motion={reducedMotion ? "true" : undefined}>
      <div className="rz-tour-glow" aria-hidden="true" />

      <header className="rz-header">
        <div className="rz-header-inner">
          <div className="rz-brand" aria-label="Rizz welcome tour">
            <span className="rz-brand-mark" aria-hidden="true">
              <PawPrint className="h-4.5 w-4.5" strokeWidth={2.4} />
            </span>
            <span className="rz-brand-word">RIZZ</span>
            <span className="rz-brand-divider" aria-hidden="true" />
            <span className="rz-brand-sub">Rizzy's welcome tour</span>
          </div>

          <div className="rz-progress-desktop">
            <Progress index={index} />
          </div>

          <div className="rz-header-actions">
            <span className="rz-step-count" aria-hidden="true">
              {String(index + 1).padStart(2, "0")} / {String(SCENES.length).padStart(2, "0")}
            </span>
            <button type="button" className="rz-skip" onClick={() => void onSkip()} disabled={busy}>
              {replay ? "Exit tour" : "Skip tutorial"}
            </button>
          </div>
        </div>

        <div className="rz-progress-mobile">
          <Progress index={index} />
        </div>
      </header>

      <main className="rz-main">
        <section className="rz-stage" aria-label="Rizzy's scene">
          <div className="rz-stage-grid" aria-hidden="true" />
          <div className="rz-stage-ring" aria-hidden="true" />
          <div className={cn("rz-stage-layer", dirClass)} key={`stage-${scene.id}`}>
            <SceneArt scene={scene} profile={profile} />
            <div className="rz-mascot">
              <Rizzy pose={scene.pose} />
            </div>
          </div>
          <span className="rz-stage-tag" aria-hidden="true">
            Scene {String(index + 1).padStart(2, "0")} · Rizzy
          </span>
        </section>

        <section className="rz-copy" aria-labelledby="rizzy-scene-title">
          <div className={cn("rz-scene-copy", dirClass)} key={`copy-${scene.id}`}>
            <p className="rz-kicker">
              <span aria-hidden="true" className="rz-kicker-dot" />
              Scene {String(index + 1).padStart(2, "0")} · {scene.kicker}
            </p>
            <h1 id="rizzy-scene-title" className="rz-title">
              {scene.title}
            </h1>
            <p className="rz-body">{scene.body}</p>

            <ul className="rz-bullets">
              {scene.bullets.map((bullet) => (
                <li key={bullet.title} className="rz-bullet">
                  <span className="rz-bullet-icon" aria-hidden="true">
                    <bullet.icon className="h-4.5 w-4.5" strokeWidth={2.2} />
                  </span>
                  <span>
                    <span className="rz-bullet-title">{bullet.title}</span>
                    <span className="rz-bullet-text">{bullet.text}</span>
                  </span>
                </li>
              ))}
            </ul>

            {scene.note && (
              <p className="rz-note">
                <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{scene.note}</span>
              </p>
            )}
          </div>

          <div className="rz-controls">
            {error && (
              <p className="rz-error" role="alert">
                {error}
              </p>
            )}
            <div className="rz-controls-row">
              <button
                type="button"
                className="rz-btn rz-btn-back"
                onClick={retreat}
                disabled={busy || (isFirst && !onBackToOnboarding)}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back
              </button>

              <span className="rz-key-hint" aria-hidden="true">
                ← → to move
              </span>

              <button
                type="button"
                className="rz-btn rz-btn-next"
                onClick={advance}
                disabled={busy}
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Saving…
                  </>
                ) : isLast ? (
                  <>
                    Finish
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      </main>

      <p className="sr-only" aria-live="polite">
        Scene {index + 1} of {SCENES.length}: {scene.title}
      </p>
    </div>
  );
}

function Progress({ index }: { index: number }) {
  return (
    <div
      className="rz-progress"
      role="progressbar"
      aria-label="Tutorial progress"
      aria-valuemin={1}
      aria-valuemax={SCENES.length}
      aria-valuenow={index + 1}
    >
      {SCENES.map((scene, i) => (
        <span
          key={scene.id}
          className={cn(
            "rz-progress-segment",
            i < index && "rz-progress-segment--done",
            i === index && "rz-progress-segment--current",
          )}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function SceneArt({ scene, profile }: { scene: Scene; profile: RizzyTourProfile }) {
  return (
    <>
      <div className="rz-bubble-float" aria-hidden="true">
        <span className="rz-bubble-dot" />
        {scene.bubble}
      </div>
      {scene.id === "welcome" && <WelcomeArt />}
      {scene.id === "profile" && <ProfileArt profile={profile} />}
      {scene.id === "discover" && <DiscoverArt profile={profile} />}
      {scene.id === "chat" && <ChatArt />}
      {scene.id === "vibe" && <VibeArt profile={profile} />}
      {scene.id === "rewards" && <RewardsArt />}
      {scene.id === "badges" && <BadgesArt />}
      {scene.id === "ready" && <ReadyArt />}
    </>
  );
}

function WelcomeArt() {
  return (
    <div className="rz-prop rz-prop-welcome" aria-hidden="true">
      <div className="rz-welcome-sticker">
        <Sparkles className="h-4 w-4" />
        <span>Meet Rizzy</span>
      </div>
      <div className="rz-spark rz-spark-a">✦</div>
      <div className="rz-spark rz-spark-b">✦</div>
      <div className="rz-spark rz-spark-c">✦</div>
    </div>
  );
}

function ProfileArt({ profile }: { profile: RizzyTourProfile }) {
  const name = profile?.display_name || profile?.username || "Your name";
  const username = profile?.username || "yourname";
  const initial = name.charAt(0).toUpperCase();
  const interests = (profile?.interests ?? []).slice(0, 3);

  return (
    <div className="rz-prop rz-prop-profile" aria-hidden="true">
      <div className="rz-profile-card">
        <div className="rz-profile-card-top">
          <span className="rz-mini-label">Your profile</span>
          <Camera className="h-3.5 w-3.5 text-[#a9a69c]" />
        </div>
        <div className="rz-profile-card-person">
          <span className="rz-profile-avatar">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>{initial}</span>
            )}
          </span>
          <span className="min-w-0">
            <span className="rz-profile-name">{name}</span>
            <span className="rz-profile-handle">@{username}</span>
          </span>
        </div>
        <p className="rz-profile-bio">
          {profile?.bio || "Your bio goes here — keep it short, make it yours."}
        </p>
        <div className="rz-profile-chips">
          {interests.length > 0 ? (
            interests.map((interest) => (
              <span key={interest} className="rz-chip rz-chip--lime">
                {interest}
              </span>
            ))
          ) : (
            <span className="rz-chip">Pick interests</span>
          )}
        </div>
        <span className="rz-profile-foot">Editable later in Settings</span>
      </div>
    </div>
  );
}

function DiscoverArt({ profile }: { profile: RizzyTourProfile }) {
  const interests = (profile?.interests ?? []).slice(0, 4);
  return (
    <div className="rz-prop rz-prop-discover" aria-hidden="true">
      <div className="rz-search-pill">
        <Search className="h-3.5 w-3.5" />
        <span>Find people, realms, tags</span>
      </div>
      <div className="rz-discover-stack">
        <div className="rz-discover-card">
          <span className="rz-discover-icon">
            <Compass className="h-3.5 w-3.5" />
          </span>
          <span>
            <strong>Explore</strong>
            <small>Follow what you love</small>
          </span>
        </div>
        <div className="rz-discover-card">
          <span className="rz-discover-icon">
            <Users className="h-3.5 w-3.5" />
          </span>
          <span>
            <strong>Communities</strong>
            <small>Groups + realms</small>
          </span>
        </div>
      </div>
      <div className="rz-profile-chips">
        {(interests.length > 0 ? interests : ["Music", "Gaming", "Art"]).map((interest) => (
          <span key={interest} className="rz-chip rz-chip--lime">
            {interest}
          </span>
        ))}
      </div>
    </div>
  );
}

function ChatArt() {
  return (
    <div className="rz-prop rz-prop-chat" aria-hidden="true">
      <div className="rz-chat-bubble">Start with a hello.</div>
      <div className="rz-chat-bubble rz-chat-bubble--out">Make it yours.</div>
      <div className="rz-chat-typing">
        <span />
        <span />
        <span />
        <small>someone is typing</small>
      </div>
      <div className="rz-chat-reactions">
        <span>♥</span>
        <span>✦</span>
        <span>＋</span>
      </div>
    </div>
  );
}

const ACCENTS = [
  { name: "Lime", color: "#c9ff3d" },
  { name: "Paper", color: "#f4f1e7" },
  { name: "Violet", color: "#b9a6ff" },
  { name: "Coral", color: "#ff8a6b" },
];

function VibeArt({ profile }: { profile: RizzyTourProfile }) {
  const [accent, setAccent] = useState(profile?.accent_color || "#c9ff3d");
  const name = profile?.display_name || profile?.username || "Your name";
  const initial = name.charAt(0).toUpperCase();
  return (
    <div className="rz-prop rz-prop-vibe">
      <div
        className="rz-vibe-card"
        style={{
          borderColor: `${accent}66`,
          boxShadow: `0 0 46px -16px ${accent}99`,
        }}
      >
        <span className="rz-preview-pill">Preview only</span>
        <div
          className="rz-vibe-banner"
          style={{
            background: `radial-gradient(circle at 28% 30%, ${accent}55, transparent 58%), #101014`,
          }}
        />
        <div className="rz-vibe-person">
          <span className="rz-profile-avatar" style={{ boxShadow: `0 0 0 2px ${accent}` }}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>{initial}</span>
            )}
          </span>
          <span className="min-w-0">
            <span className="rz-profile-name">{name}</span>
            <span className="rz-profile-handle">@{profile?.username || "yourname"}</span>
          </span>
        </div>
      </div>
      <div className="rz-swatches" role="group" aria-label="Preview an accent color">
        {ACCENTS.map((option) => (
          <button
            key={option.name}
            type="button"
            className="rz-swatch"
            aria-label={`Preview ${option.name} accent`}
            aria-pressed={accent.toLowerCase() === option.color.toLowerCase()}
            onClick={() => setAccent(option.color)}
            style={{ backgroundColor: option.color }}
          >
            {accent.toLowerCase() === option.color.toLowerCase() && (
              <Check className="h-3 w-3 text-[#0a0a0b]" aria-hidden="true" />
            )}
          </button>
        ))}
      </div>
      <p className="rz-art-note">Try a preview — nothing is saved.</p>
    </div>
  );
}

function RewardsArt() {
  return (
    <div className="rz-prop rz-prop-rewards" aria-hidden="true">
      <div className="rz-paw-tokens">
        <div className="rz-paw-token">
          <PawPrint className="h-5 w-5" />
          <span>Bounties</span>
        </div>
        <div className="rz-paw-token">
          <PawPrint className="h-5 w-5" />
          <span>Profile effects</span>
        </div>
        <div className="rz-paw-token">
          <PawPrint className="h-5 w-5" />
          <span>Avatar decorations</span>
        </div>
      </div>
      <div className="rz-reward-tag">
        <span className="rz-reward-dot" />
        Claim · earn · wear
      </div>
      <p className="rz-art-note">Live: 25 Paws per bounty claim</p>
    </div>
  );
}

const BADGE_SHOWCASE = [
  { slug: "rookie", name: "Newcomer" },
  { slug: "rising-star", name: "Rising Star" },
  { slug: "smooth-talker", name: "Chatterbox" },
];

function BadgesArt() {
  return (
    <div className="rz-prop rz-prop-badges">
      <div className="rz-badge-card">
        <span className="rz-mini-label">Real badges to earn</span>
        <div className="rz-badge-row">
          {BADGE_SHOWCASE.map((badge) => (
            <div key={badge.slug} className="rz-badge-item">
              <span className="rz-badge-frame">
                <Badge slug={badge.slug} size={40} title={badge.name} />
              </span>
              <span>{badge.name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rz-reward-tag rz-reward-tag--quiet">
        <Trophy className="h-3.5 w-3.5" />
        Milestones, not noise
      </div>
    </div>
  );
}

const CONFETTI = [
  { x: "8%", delay: "0s", color: "#c9ff3d", rotate: "18deg", duration: "2.6s" },
  { x: "18%", delay: "0.35s", color: "#f4f1e7", rotate: "70deg", duration: "3.1s" },
  { x: "29%", delay: "0.1s", color: "#c9ff3d", rotate: "28deg", duration: "2.9s" },
  { x: "41%", delay: "0.6s", color: "#b9a6ff", rotate: "10deg", duration: "3.3s" },
  { x: "54%", delay: "0.2s", color: "#f4f1e7", rotate: "45deg", duration: "2.7s" },
  { x: "66%", delay: "0.5s", color: "#c9ff3d", rotate: "80deg", duration: "3.2s" },
  { x: "78%", delay: "0.15s", color: "#ff8a6b", rotate: "15deg", duration: "2.8s" },
  { x: "89%", delay: "0.65s", color: "#f4f1e7", rotate: "60deg", duration: "3s" },
];

function ReadyArt() {
  return (
    <>
      <div className="rz-confetti" aria-hidden="true">
        {CONFETTI.map((piece, i) => (
          <span
            key={i}
            style={{
              left: piece.x,
              animationDelay: piece.delay,
              animationDuration: piece.duration,
              backgroundColor: piece.color,
              rotate: piece.rotate,
            }}
          />
        ))}
      </div>
      <div className="rz-prop rz-prop-ready">
        <div className="rz-ready-card">
          <span className="rz-ready-check">
            <Check className="h-4 w-4" />
          </span>
          <span>
            <strong>Tour complete</strong>
            <small>Now make it yours.</small>
          </span>
        </div>
      </div>
    </>
  );
}
