import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const pageTitle = "Social App for Creators in India | RIZZ";
const pageDescription =
  "RIZZ is a social app for creators in India to share posts, build communities in channels, and talk in live voice rooms. Join early access.";
const pageUrl = "https://rizzapp.onrender.com/creators-in-india";

export const Route = createFileRoute("/creators-in-india")({
  component: CreatorsInIndiaPage,
  head: () => ({
    links: [{ rel: "canonical", href: pageUrl }],
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
      { property: "og:url", content: pageUrl },
      { name: "twitter:title", content: pageTitle },
      { name: "twitter:description", content: pageDescription },
    ],
  }),
});

function CreatorsInIndiaPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 md:px-12">
        <Link to="/" className="font-display text-xl font-bold tracking-tight">
          RIZZ
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-4">
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Log in
          </Link>
          <Link to="/signup">
            <Button size="sm" className="bg-gradient-primary border-0 shadow-glow">
              Join RIZZ
            </Button>
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 md:px-12">
        <section className="py-12 md:py-20" aria-labelledby="india-creators-heading">
          <p className="text-sm font-semibold uppercase tracking-widest text-[var(--rizz-pink)]">
            For creators building in India
          </p>
          <h1
            id="india-creators-heading"
            className="mt-4 max-w-4xl font-display text-4xl font-bold tracking-tight md:text-6xl"
          >
            A social app for creators in India
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground">
            RIZZ brings a creator profile and posts together with a community space.
            Share your work, organize conversations in channels, and meet your audience
            in voice rooms connected to the content.
          </p>
          <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">
            It is for creators who want the conversation around their work to live
            alongside their posts—not split between a feed and a separate chat space.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link to="/signup">
              <Button size="lg" className="bg-gradient-primary border-0 shadow-glow-lg">
                Join early access
              </Button>
            </Link>
            <Link
              to="/"
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Explore the RIZZ homepage
            </Link>
          </div>
        </section>

        <section className="py-12" aria-labelledby="creator-tools-heading">
          <h2
            id="creator-tools-heading"
            className="font-display text-2xl font-bold md:text-3xl"
          >
            Keep your posts and community connected
          </h2>
          <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">
            Every creator on RIZZ has a profile and a server. Posts share what you are
            making; channels give conversations a place to continue; voice rooms can
            attach to a post or channel so people can talk live around the work.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <article className="glass rounded-2xl p-6">
              <h3 className="font-display text-lg font-semibold">Share your work</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Post updates and creative work on your profile so followers can keep up
                with what you are making.
              </p>
            </article>
            <article className="glass rounded-2xl p-6">
              <h3 className="font-display text-lg font-semibold">Organize conversations</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Use channels to keep community discussions together around posts and
                shared interests.
              </p>
            </article>
            <article className="glass rounded-2xl p-6">
              <h3 className="font-display text-lg font-semibold">Meet live</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Start a voice room connected to a post or channel and talk with your
                community in real time.
              </p>
            </article>
          </div>
        </section>

        <section className="py-12" aria-labelledby="rizz-faq-heading">
          <h2
            id="rizz-faq-heading"
            className="font-display text-2xl font-bold md:text-3xl"
          >
            Questions about RIZZ
          </h2>
          <div className="mt-6 space-y-6">
            <article>
              <h3 className="font-semibold">Is RIZZ a dating app?</h3>
              <p className="mt-2 max-w-3xl leading-relaxed text-muted-foreground">
                No. RIZZ is a social network for creators, built around profiles,
                posts, community channels, and voice rooms—not matchmaking or AI
                dating replies.
              </p>
            </article>
            <article>
              <h3 className="font-semibold">Does RIZZ also have chat stories?</h3>
              <p className="mt-2 max-w-3xl leading-relaxed text-muted-foreground">
                Yes. RIZZ includes short stories told as text conversations. Chat
                stories are another format in the app; the main focus of this page is
                the creator social network.
              </p>
            </article>
            <article>
              <h3 className="font-semibold">What can creators do on RIZZ?</h3>
              <p className="mt-2 max-w-3xl leading-relaxed text-muted-foreground">
                Creators can share posts, organize community discussion in channels,
                and bring people together in voice rooms connected to posts or
                channels.
              </p>
            </article>
          </div>
        </section>

        <section className="mt-8 rounded-2xl glass p-8 text-center md:p-12">
          <h2 className="font-display text-2xl font-bold md:text-3xl">
            Build your creative community on RIZZ
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Join early access to connect your profile, posts, and community space.
          </p>
          <Link to="/signup" className="mt-6 inline-flex">
            <Button size="lg" className="bg-gradient-primary border-0 shadow-glow-lg">
              Join early access
            </Button>
          </Link>
        </section>
      </main>
    </div>
  );
}
