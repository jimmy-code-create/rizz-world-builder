import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles, Radio, Zap, Crown, Mic, Hash, Flame, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "RIZZ — Your feed. Your server. Your world." },
      { name: "description", content: "The social platform built for Gen Z creators. Feeds, live channels, drops, voice rooms, badges. Join the world that never sleeps." },
    ],
  }),
});

function Index() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* Aurora orbs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-[var(--rizz-pink)] opacity-30 blur-[120px] animate-float" />
        <div className="absolute top-1/3 -right-40 h-[600px] w-[600px] rounded-full bg-[var(--rizz-violet)] opacity-40 blur-[140px]" style={{ animation: "float 8s ease-in-out infinite" }} />
        <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-[var(--accent)] opacity-25 blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12">
        <Link to="/" className="flex items-center gap-2">
          <div className="relative">
            <div className="absolute inset-0 rounded-lg bg-gradient-primary blur-md opacity-70" />
            <div className="relative h-9 w-9 rounded-lg bg-gradient-primary flex items-center justify-center font-display font-bold text-lg">
              R
            </div>
          </div>
          <span className="font-display text-xl font-bold tracking-tight">RIZZ</span>
        </Link>
        <div className="flex items-center gap-2 md:gap-3">
          <Link to="/login">
            <Button variant="ghost" size="sm">Log in</Button>
          </Link>
          <Link to="/signup">
            <Button size="sm" className="bg-gradient-primary border-0 shadow-glow hover:opacity-90">Join RIZZ</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 px-6 pt-12 pb-24 md:pt-24 md:px-12 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium text-muted-foreground mb-6">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--rizz-pink)] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--rizz-pink)]" />
            </span>
            Now in early access
          </div>

          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold leading-[0.95] tracking-tighter">
            Your feed.
            <br />
            <span className="text-gradient">Your server.</span>
            <br />
            Your world.
          </h1>

          <p className="mt-8 mx-auto max-w-xl text-base md:text-lg text-muted-foreground leading-relaxed">
            RIZZ fuses Instagram-style content with Discord-style live communities.
            Every creator has a profile <em>and</em> a server. Following someone means joining their world.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/signup">
              <Button size="lg" className="bg-gradient-primary border-0 shadow-glow-lg hover:opacity-90 text-base px-8 h-12">
                <Sparkles className="mr-2 h-4 w-4" />
                Claim your @
              </Button>
            </Link>
            <Link to="/feed">
              <Button size="lg" variant="outline" className="glass border-white/10 hover:bg-white/5 text-base px-8 h-12">
                Explore the feed
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Feature grid */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="glass rounded-2xl p-6 hover:shadow-glow transition-all duration-500 group"
            >
              <div className="h-10 w-10 rounded-xl bg-gradient-primary/20 flex items-center justify-center mb-4 group-hover:shadow-glow transition-shadow">
                <f.icon className="h-5 w-5 text-[var(--rizz-pink)]" />
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Tagline footer */}
        <div className="mt-32 text-center">
          <p className="font-display text-2xl md:text-4xl text-muted-foreground/60">
            Built for creators who never log off.
          </p>
        </div>
      </section>
    </div>
  );
}

const features = [
  { icon: Hash, title: "Channels in profiles", desc: "Every user has #vibes, #drops, #art-dump where followers chat in real time around posted content." },
  { icon: Radio, title: "Live presence", desc: "Stories show who's active right now. Passive scrolling becomes live moments." },
  { icon: Crown, title: "Rizz Score", desc: "Reputation that rewards engagement quality, consistency, and energy — not just follower counts." },
  { icon: Zap, title: "Drop System", desc: "Creators drop exclusive files, links, or content that vanishes on a timer or claim limit." },
  { icon: Mic, title: "Voice Rooms", desc: "Spontaneous audio spaces that attach to any post or channel." },
  { icon: Flame, title: "Public reactions", desc: "Discord-style emoji on every post, visible to everyone. Pile on the energy." },
  { icon: Users, title: "Badges", desc: "Earn glowing badges for streaks, drops, voice time, and being early. Wear them everywhere." },
  { icon: Sparkles, title: "Built-in vibes", desc: "Dark, electric, expressive UI. Nothing is static — everything pulses, reacts, glows." },
];
