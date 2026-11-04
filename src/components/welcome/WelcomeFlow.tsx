import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MessageCircle,
  RotateCcw,
  Rss,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { FEATURE_PREVIEWS, FeaturePhone } from "./PhoneScreens";
import {
  markWelcomeSeen,
  readWelcomeState,
  rememberWelcomeName,
  resetWelcome,
} from "@/lib/welcome";
import { useLightCanvas } from "@/lib/use-light-canvas";

type Stage = "name" | "features" | "returning";

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || value;
}

function Brand() {
  return (
    <span className="inline-flex items-center gap-2">
      <img src="/brand/rizz-cat-logo.svg" alt="" className="h-7 w-7 shrink-0" />
      <span className="font-display text-[17px] font-extrabold tracking-[-0.03em] text-[#15151a]">
        RIZZ
      </span>
    </span>
  );
}

export function WelcomeSplash() {
  return (
    <div className="rizz-auth-shell grid min-h-dvh place-items-center bg-white">
      <div className="flex flex-col items-center gap-3" role="status" aria-label="Loading RIZZ">
        <img src="/brand/rizz-cat-logo.svg" alt="" className="h-12 w-12" />
        <span className="h-1 w-20 overflow-hidden rounded-full bg-[#edebe4]">
          <span className="block h-full w-1/2 animate-shimmer-sweep rounded-full bg-[#c9ff3d]" />
        </span>
      </div>
    </div>
  );
}

/**
 * The mobile front door.
 *
 * Signed-out visitors get three deliberate screens instead of a desktop
 * marketing page: a name-first welcome, a swipeable look at the product drawn
 * as real app screens, then the white login flow. The finished flag lives in
 * localStorage so a returning signed-out member gets a short "welcome back"
 * screen rather than the whole tour again.
 */
export function WelcomeFlow() {
  useLightCanvas();
  const nav = useNavigate();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [stage, setStage] = useState<Stage>("name");
  const [name, setName] = useState("");
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The login chunk is small, but fetching it while someone reads the intro
    // means the hand-off is instant instead of flashing the app's dark loader.
    void Promise.resolve(router.preloadRoute({ to: "/login" })).catch(() => {});
  }, [router]);

  useEffect(() => {
    if (stage !== "returning") return;
    void Promise.resolve(router.preloadRoute({ to: "/signup" })).catch(() => {});
  }, [router, stage]);

  useEffect(() => {
    const saved = readWelcomeState();
    if (saved.name) setName(saved.name);
    if (saved.name && saved.seen) setStage("returning");
    else if (saved.name) setStage("features");
    setReady(true);
  }, []);

  const finish = useCallback(() => {
    markWelcomeSeen();
    void nav({ to: "/login", replace: true });
  }, [nav]);

  const startOver = () => {
    resetWelcome();
    setName("");
    setIndex(0);
    setStage("name");
  };

  if (!ready) return <WelcomeSplash />;

  return (
    <div className="rizz-auth-shell min-h-dvh bg-white text-[#15151a] lg:bg-[#f1efe8]">
      <div className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col bg-white lg:my-6 lg:min-h-[calc(100dvh-3rem)] lg:rounded-[34px] lg:border lg:border-[#e6e2d8] lg:shadow-[0_40px_120px_-60px_rgba(20,20,20,0.45)]">
        {stage === "name" && (
          <div key="name" className="welcome-screen-in flex flex-1 flex-col">
            <header className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top,0px)+16px)]">
              <Brand />
              <Link
                to="/login"
                className="rounded-full px-4 py-2 text-[13px] font-semibold text-[#6f6c64] transition-colors hover:bg-[#f4f3ef] hover:text-[#15151a]"
              >
                Log in
              </Link>
            </header>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                const clean = name.trim().replace(/\s+/g, " ").slice(0, 32);
                if (!clean) return;
                rememberWelcomeName(clean);
                setName(clean);
                setIndex(0);
                setStage("features");
              }}
              className="flex flex-1 flex-col justify-center px-6 pb-[calc(env(safe-area-inset-bottom,0px)+22px)]"
            >
              <div className="relative mx-auto mb-6 h-[138px] w-[138px]">
                <span className="absolute inset-0 rounded-[2.4rem] bg-[#c9ff3d]" />
                <img
                  src="/cats/peek.svg"
                  alt=""
                  className="absolute -bottom-2 left-1/2 h-[148px] w-[148px] -translate-x-1/2 select-none"
                  draggable={false}
                />
                <span className="absolute -left-[62px] top-4 -rotate-6 rounded-full border border-[#ebe8df] bg-white px-3 py-1 text-[10px] font-bold shadow-[0_8px_22px_-12px_rgba(20,20,20,0.35)]">
                  Your feed
                </span>
                <span className="absolute -right-[54px] top-1 rotate-6 rounded-full border border-[#ebe8df] bg-white px-3 py-1 text-[10px] font-bold shadow-[0_8px_22px_-12px_rgba(20,20,20,0.35)]">
                  Voice
                </span>
                <span className="absolute -right-[44px] bottom-2 rotate-3 rounded-full border border-[#ebe8df] bg-white px-3 py-1 text-[10px] font-bold shadow-[0_8px_22px_-12px_rgba(20,20,20,0.35)]">
                  DMs
                </span>
              </div>

              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#8a877d]">
                <Sparkles className="h-3.5 w-3.5 text-[#15151a]" aria-hidden /> Welcome to RIZZ
              </p>
              <h1 className="mt-2 font-display text-[2.7rem] font-extrabold leading-[0.94] tracking-[-0.045em] text-[#111110]">
                What's
                <br />
                your name?
              </h1>
              <p className="mt-3 max-w-[310px] text-[14px] leading-relaxed text-[#6f6c64]">
                We'll use it to make this place feel like yours. A first name is plenty.
              </p>

              <label
                htmlFor="welcome-name"
                className="mt-7 text-[11px] font-bold uppercase tracking-[0.16em] text-[#8a877d]"
              >
                Your name
              </label>
              <div className="relative mt-2">
                <UserRound
                  aria-hidden
                  className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#9d998e]"
                  strokeWidth={2}
                />
                <input
                  id="welcome-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={32}
                  autoComplete="given-name"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  placeholder="e.g. Sam"
                  className="h-[56px] w-full rounded-2xl border border-[#e3e0d7] bg-[#f7f6f2] pl-12 pr-4 text-[16px] font-medium text-[#15151a] outline-none transition placeholder:text-[#a5a196] focus:border-[#15151a] focus:bg-white focus:ring-4 focus:ring-[#c9ff3d]/40"
                />
              </div>

              <button
                type="submit"
                disabled={!name.trim()}
                className="mt-4 flex h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-[#15151a] text-[15px] font-semibold text-white transition hover:bg-[#2a2a2e] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-30"
              >
                Continue
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
              <p className="mt-3 text-center text-[11px] font-medium text-[#969287]">
                No account needed yet — you'll log in next.
              </p>
            </form>
          </div>
        )}

        {stage === "features" && (
          <div key="features" className="welcome-screen-in flex flex-1 flex-col">
            <header className="flex items-center justify-between gap-3 px-5 pt-[calc(env(safe-area-inset-top,0px)+14px)]">
              <button
                type="button"
                onClick={() => setStage("name")}
                aria-label="Back to your name"
                className="grid h-9 w-9 place-items-center rounded-full border border-[#e8e5dc] text-[#35342f] transition-colors hover:bg-[#f4f3ef]"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </button>
              <div className="flex flex-1 flex-col items-center gap-1.5" aria-label="Step 2 of 2">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#969287]">
                  2 of 2
                </span>
                <span className="flex gap-1">
                  <span className="h-1 w-8 rounded-full bg-[#15151a]" />
                  <span className="h-1 w-8 rounded-full bg-[#15151a]" />
                </span>
              </div>
              <button
                type="button"
                onClick={finish}
                className="rounded-full px-3 py-2 text-[13px] font-semibold text-[#6f6c64] transition-colors hover:bg-[#f4f3ef] hover:text-[#15151a]"
              >
                Skip
              </button>
            </header>

            <div className="px-6 pt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#969287]">
                Welcome, {firstName(name)}
              </p>
              <h1 className="mt-1.5 font-display text-[2.15rem] font-extrabold leading-[0.98] tracking-[-0.04em] text-[#111110]">
                Everything you love.
                <br />
                One home.
              </h1>
            </div>

            <div
              ref={trackRef}
              onScroll={(event) => {
                const el = event.currentTarget;
                const next = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
                if (next !== index) setIndex(next);
              }}
              className="rizz-no-scrollbar mt-4 flex shrink-0 snap-x snap-mandatory overflow-x-auto scroll-smooth"
              aria-roledescription="carousel"
              aria-label="A look inside RIZZ"
            >
              {FEATURE_PREVIEWS.map((feature, featureIndex) => (
                <section
                  key={feature.id}
                  className="flex w-full shrink-0 snap-center flex-col items-center px-5"
                  aria-label={`${featureIndex + 1} of ${FEATURE_PREVIEWS.length}: ${feature.title}`}
                >
                  <FeaturePhone id={feature.id} />
                  <div className="mt-4 w-full max-w-[320px] text-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f2f1eb] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5f5c54]">
                      {feature.id === "feed" && <Rss className="h-3 w-3" aria-hidden />}
                      {feature.id === "realms" && <Users className="h-3 w-3" aria-hidden />}
                      {feature.id === "messages" && (
                        <MessageCircle className="h-3 w-3" aria-hidden />
                      )}
                      {feature.kicker}
                    </span>
                    <h2 className="mt-2 font-display text-[1.2rem] font-bold tracking-[-0.025em] text-[#161613]">
                      {feature.title}
                    </h2>
                    <p className="mx-auto mt-1 max-w-[290px] text-[12.5px] leading-relaxed text-[#716d63]">
                      {feature.body}
                    </p>
                  </div>
                </section>
              ))}
            </div>

            <div className="flex items-center justify-center gap-1.5 pt-3">
              {FEATURE_PREVIEWS.map((feature, dotIndex) => (
                <button
                  key={feature.id}
                  type="button"
                  onClick={() => {
                    const el = trackRef.current;
                    if (!el) return;
                    el.scrollTo({ left: dotIndex * el.clientWidth, behavior: "smooth" });
                  }}
                  aria-label={`Go to ${feature.kicker}`}
                  aria-current={dotIndex === index ? "true" : undefined}
                  className={`h-1.5 rounded-full transition-all ${
                    dotIndex === index
                      ? "w-6 bg-[#15151a]"
                      : "w-1.5 bg-[#d8d5cb] hover:bg-[#b9b5aa]"
                  }`}
                />
              ))}
            </div>

            <div className="sticky bottom-0 z-20 mt-auto border-t border-[#f1efe8] bg-white/95 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+14px)] pt-3 backdrop-blur supports-[backdrop-filter]:bg-white/85">
              <button
                type="button"
                onClick={() => {
                  if (index < FEATURE_PREVIEWS.length - 1) {
                    const el = trackRef.current;
                    if (!el) return;
                    el.scrollTo({ left: (index + 1) * el.clientWidth, behavior: "smooth" });
                    return;
                  }
                  finish();
                }}
                className="flex h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-[#15151a] text-[15px] font-semibold text-white transition hover:bg-[#2a2a2e] active:scale-[0.99]"
              >
                {index < FEATURE_PREVIEWS.length - 1 ? "Next" : "Continue to log in"}
                {index < FEATURE_PREVIEWS.length - 1 ? (
                  <ArrowRight className="h-4 w-4" aria-hidden />
                ) : (
                  <Check className="h-4 w-4" aria-hidden />
                )}
              </button>
              <p className="mt-2.5 text-center text-[11px] font-medium text-[#969287]">
                {index < FEATURE_PREVIEWS.length - 1
                  ? "Swipe through to see what's inside"
                  : "Your account is one step away"}
              </p>
            </div>
          </div>
        )}

        {stage === "returning" && (
          <div key="returning" className="welcome-screen-in flex flex-1 flex-col">
            <header className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top,0px)+16px)]">
              <Brand />
              <button
                type="button"
                onClick={startOver}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-semibold text-[#7b786f] transition-colors hover:bg-[#f4f3ef] hover:text-[#15151a]"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Not you?
              </button>
            </header>

            <div className="flex flex-1 flex-col justify-center px-6 pb-[calc(env(safe-area-inset-bottom,0px)+22px)]">
              <div className="relative mx-auto mb-6 h-[116px] w-[116px]">
                <span className="absolute inset-0 rounded-[2rem] bg-[#c9ff3d]" />
                <img
                  src="/cats/peek.svg"
                  alt=""
                  className="absolute -bottom-2 left-1/2 h-[126px] w-[126px] -translate-x-1/2 select-none"
                  draggable={false}
                />
              </div>

              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8a877d]">
                Welcome back
              </p>
              <h1 className="mt-2 font-display text-[2.75rem] font-extrabold leading-[0.94] tracking-[-0.045em] text-[#111110]">
                Hey,
                <br />
                {firstName(name)}.
              </h1>
              <p className="mt-3 max-w-[310px] text-[14px] leading-relaxed text-[#6f6c64]">
                Your feed, your realms and your people are right where you left them.
              </p>

              <button
                type="button"
                onClick={() => void nav({ to: "/login" })}
                className="mt-7 flex h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-[#15151a] text-[15px] font-semibold text-white transition hover:bg-[#2a2a2e] active:scale-[0.99]"
              >
                Log in
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => void nav({ to: "/signup" })}
                className="mt-2.5 flex h-[52px] w-full items-center justify-center rounded-2xl border border-[#e3e0d7] bg-white text-[14px] font-semibold text-[#15151a] transition hover:bg-[#f7f6f2] active:scale-[0.99]"
              >
                Create an account
              </button>

              <div className="mt-7 flex items-center justify-center gap-4 text-[11px] font-medium text-[#8a877d]">
                <span className="inline-flex items-center gap-1.5">
                  <Rss className="h-3.5 w-3.5" aria-hidden /> Feed
                </span>
                <span className="h-3 w-px bg-[#dedbd1]" aria-hidden />
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" aria-hidden /> Realms
                </span>
                <span className="h-3 w-px bg-[#dedbd1]" aria-hidden />
                <span className="inline-flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden /> Messages
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
