import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { getPostAuthPath } from "@/lib/onboarding";
import { ArrowRight, Volume2, Flame, Heart, Headphones, Hash, Radio, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "RIZZ — Your feed. Your server. All in one room." },
      { name: "description", content: "Profiles that double as live servers. Post content, host voice rooms, and chat with your community in real time." },
    ],
  }),
});

export function LandingPage() {
  const { user, profile, loading, profileError, refreshProfile } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (loading || !user || profileError) return;
    void nav({ to: getPostAuthPath(profile) });
  }, [loading, user, profile, profileError, nav]);

  if (user && profileError) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">{profileError}</p>
        <Button variant="outline" onClick={() => void refreshProfile()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col selection:bg-primary selection:text-primary-foreground">
      {/* 1. TOP NAV */}
      <header className="border-b border-border bg-background/95 sticky top-0 z-40 backdrop-blur-none">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md p-1">
            <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-base">
              R
            </div>
            <span className="font-display text-xl font-bold tracking-tight">RIZZ</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground px-3 py-2 transition-colors">
              Log in
            </Link>
            <Link to="/signup">
              <Button size="sm" className="bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 h-9 px-4">
                Join RIZZ
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* 2. HERO (Asymmetric split layout) */}
        <section className="border-b border-border py-16 sm:py-24 lg:py-28">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-start">
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Live social without the algorithmic noise
                </div>

                <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.02]">
                  The feed is dead.
                  <br />
                  Long live the room.
                </h1>

                <p className="text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
                  Instagram gave you followers who never talk. Discord gave you servers nobody can find. RIZZ fuses feeds and live realms so your posts and your community live in the exact same room.
                </p>

                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <Link to="/signup">
                    <Button size="lg" className="w-full sm:w-auto bg-primary text-primary-foreground font-semibold rounded-lg h-12 px-7 text-base hover:bg-primary/90">
                      Claim your @
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to="/feed">
                    <Button size="lg" variant="outline" className="w-full sm:w-auto border-border bg-card hover:bg-muted font-medium rounded-lg h-12 px-7 text-base text-foreground">
                      Explore the live feed
                    </Button>
                  </Link>
                </div>

                <p className="text-xs text-muted-foreground pt-1">
                  Early access · Free forever · No phone number required
                </p>
              </div>

              {/* Side highlight: stark stat card */}
              <div className="lg:col-span-5 border border-border bg-card rounded-2xl p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Network Status</span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Online
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-3xl font-display font-bold text-foreground">48,200+</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Creators hosting active realms</p>
                  </div>
                  <div className="border-t border-border pt-4">
                    <p className="text-3xl font-display font-bold text-foreground">1.4M</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Vanishing drops claimed this month</p>
                  </div>
                  <div className="border-t border-border pt-4">
                    <p className="text-3xl font-display font-bold text-foreground">0</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Algorithm tricks or sponsored junk in feeds</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. PRODUCT SHOWCASE (Single large live UI demo crop) */}
        <section className="border-b border-border py-16 sm:py-24 bg-card/40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="max-w-2xl mb-10">
              <span className="text-xs font-mono uppercase tracking-widest text-primary font-bold">The Real Product</span>
              <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight mt-2 text-foreground">
                Your profile is a server. Your posts start conversations.
              </h2>
            </div>

            {/* Live Product Visual Crop */}
            <div className="border border-border bg-card rounded-2xl overflow-hidden shadow-none">
              {/* Fake window header */}
              <div className="border-b border-border bg-muted/60 px-4 py-3 flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-border" />
                  <span className="h-3 w-3 rounded-full bg-border" />
                  <span className="h-3 w-3 rounded-full bg-border" />
                  <span className="ml-2 font-mono text-[11px] text-foreground font-medium">rizz.app/@maya</span>
                </div>
                <div className="flex items-center gap-2 font-medium">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-foreground">6 in voice</span>
                </div>
              </div>

              {/* Product inside */}
              <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-border">
                {/* Left: The Post */}
                <div className="lg:col-span-7 p-5 sm:p-7 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-secondary text-foreground grid place-items-center font-bold text-sm border border-border">
                        M
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm text-foreground">Maya Lin</span>
                          <span className="text-xs text-muted-foreground">@maya</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Sound designer & visual artist</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                      Rizz 942
                    </span>
                  </div>

                  <p className="text-sm text-foreground/90 leading-relaxed">
                    Finished the modular patch from Thursday&apos;s stream. Dropping the raw stems & Ableton rack for the next 2 hours. Claim below before it resets:
                  </p>

                  {/* Audio drop player preview */}
                  <div className="border border-border rounded-xl bg-muted/40 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Volume2 className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-foreground">patch_04_analog_drift.wav</span>
                      </div>
                      <span className="font-mono text-muted-foreground">01:42</span>
                    </div>
                    {/* Minimal flat waveform */}
                    <div className="h-7 flex items-end gap-1 px-1">
                      {[35, 60, 85, 40, 70, 95, 55, 30, 75, 100, 80, 45, 65, 90, 50, 70, 85, 40, 60, 30, 90, 75, 50, 65, 80, 40, 95, 60, 45, 70].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-sm transition-all"
                          style={{
                            height: `${h}%`,
                            backgroundColor: i < 12 ? "var(--primary)" : "rgba(244, 244, 246, 0.2)",
                          }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/60">
                      <span className="text-muted-foreground">Drop active · 34/50 claimed</span>
                      <span className="font-semibold text-primary">Claim zip (240MB)</span>
                    </div>
                  </div>

                  {/* Reaction chips */}
                  <div className="flex items-center gap-2 pt-1">
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-foreground">
                      <span>🔥</span>
                      <span>38</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      <span>🎧</span>
                      <span>19</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      <span>❤️</span>
                      <span>44</span>
                    </div>
                  </div>
                </div>

                {/* Right: The Live Realm Channel */}
                <div className="lg:col-span-5 p-5 sm:p-6 bg-muted/20 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        <Hash className="h-4 w-4 text-primary" />
                        <span>stems-chat</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">18 members active</span>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="font-semibold text-primary mr-1.5">@kai:</span>
                        <span className="text-foreground/80">that bass roll at 0:48 is insane, what filter are you using?</span>
                      </div>
                      <div>
                        <span className="font-semibold text-sky-400 mr-1.5">@maya:</span>
                        <span className="text-foreground/80">analog ladder with 40% drive, stems have the dry track too!</span>
                      </div>
                      <div>
                        <span className="font-semibold text-amber-400 mr-1.5">@sam_d:</span>
                        <span className="text-foreground/80">grabbed it 🙌 jumping in voice now</span>
                      </div>
                    </div>
                  </div>

                  {/* Audio channel bar */}
                  <div className="rounded-xl border border-border bg-card p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Radio className="h-4 w-4 text-primary animate-pulse" />
                      <div>
                        <p className="text-xs font-semibold text-foreground">Sound Lab Live</p>
                        <p className="text-[10px] text-muted-foreground">6 in room · open mic</p>
                      </div>
                    </div>
                    <span className="rounded-md bg-primary text-primary-foreground text-xs font-bold px-2.5 py-1">
                      Join room
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. PLAIN TEXT LIST (No cards! Full-width split with thin rules) */}
        <section className="border-b border-border py-16 sm:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
              <div className="lg:col-span-4 lg:sticky lg:top-24">
                <span className="text-xs font-mono uppercase tracking-widest text-primary font-bold">Architecture</span>
                <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight mt-2 text-foreground">
                  Built for creators who want conversations, not monologue feeds.
                </h2>
                <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
                  Every feature is built around real-time connection. No hidden algorithms deciding who gets to see what you post.
                </p>
              </div>

              <div className="lg:col-span-8 divide-y divide-border border-y border-border">
                <div className="py-6 sm:py-8 space-y-2">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-xs text-primary font-bold">01</span>
                    <h3 className="font-display text-xl font-bold text-foreground">Realms built into profiles</h3>
                  </div>
                  <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed pl-7">
                    Every profile hosts live channels. When you share work, people discuss it right where it lives — no redirecting followers to an external chat server.
                  </p>
                </div>

                <div className="py-6 sm:py-8 space-y-2">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-xs text-primary font-bold">02</span>
                    <h3 className="font-display text-xl font-bold text-foreground">Drops with actual limits</h3>
                  </div>
                  <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed pl-7">
                    Share unreleased music, artwork, files, or secret links with true scarcity. Once the claim count or countdown timer ends, the drop locks.
                  </p>
                </div>

                <div className="py-6 sm:py-8 space-y-2">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-xs text-primary font-bold">03</span>
                    <h3 className="font-display text-xl font-bold text-foreground">Instant audio rooms</h3>
                  </div>
                  <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed pl-7">
                    Spontaneous voice channels attach directly to any post or realm. Tap once to drop in, listen, or speak without leaving your feed.
                  </p>
                </div>

                <div className="py-6 sm:py-8 space-y-2">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-xs text-primary font-bold">04</span>
                    <h3 className="font-display text-xl font-bold text-foreground">Reactions that show real people</h3>
                  </div>
                  <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed pl-7">
                    Hover or tap any reaction to see exactly who reacted. No anonymous bot counts or fake vanity metrics.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. COMMUNITY PROOF */}
        <section className="border-b border-border py-16 sm:py-20 bg-card/30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <span className="text-xs font-mono uppercase tracking-widest text-primary font-bold">Community Voice</span>
              <blockquote className="font-display text-xl sm:text-3xl font-medium tracking-tight text-foreground leading-snug">
                “Every other app forces you to choose between screaming into an algorithmic void or managing ten separate Discord servers. RIZZ is the first place where posting feels like opening your door.”
              </blockquote>
              <div className="flex items-center justify-center gap-3 pt-2">
                <div className="h-9 w-9 rounded-full bg-secondary border border-border grid place-items-center font-bold text-xs">
                  E
                </div>
                <div className="text-left text-xs">
                  <p className="font-semibold text-foreground">Elena Vance</p>
                  <p className="text-muted-foreground">Beatmaker & producer · 18k realm members</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. FINAL CTA */}
        <section className="py-20 sm:py-28">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
            <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-foreground">
              Claim your username before someone else does.
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto text-sm sm:text-base">
              Early access is open. Choose a handle, drop your first post, and open your realm in seconds.
            </p>
            <div className="pt-2 flex justify-center">
              <Link to="/signup">
                <Button size="lg" className="bg-primary text-primary-foreground font-semibold rounded-lg h-12 px-8 text-base hover:bg-primary/90">
                  Claim your @
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-border py-8 text-xs text-muted-foreground">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-xs">
              R
            </div>
            <span className="font-display font-bold text-foreground">RIZZ</span>
            <span>· Built for real communities</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/feed" className="hover:text-foreground">Feed</Link>
            <Link to="/explore" className="hover:text-foreground">Explore</Link>
            <Link to="/login" className="hover:text-foreground">Log in</Link>
            <Link to="/signup" className="hover:text-foreground">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
