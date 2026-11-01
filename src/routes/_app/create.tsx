import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, X } from "lucide-react";
import { PostComposer } from "@/components/PostComposer";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/create")({
  head: () => ({
    meta: [
      { title: "New post · RIZZ" },
      { name: "description", content: "Write a post, add a poll, a GIF or a realm emoji." },
    ],
  }),
  component: CreatePostPage,
});

/**
 * The composer, on its own page.
 *
 * The feed's inline composer is a doorway: it is good for a one-liner between
 * posts and cramped the moment you attach an image, start a poll or type a
 * caption worth reading. `/create` is the same component with the whole screen,
 * so the draft survives a refresh, the back button returns to the feed, and the
 * link can be shared or opened from anywhere ("post something" → here).
 */
function CreatePostPage() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const leave = () => {
    // Back where the writer came from, or the feed when this was a deep link.
    if (window.history.length > 1) window.history.back();
    else void navigate({ to: "/feed" });
  };

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-2xl px-4 pb-24 pt-4">
      <header className="sticky top-0 z-20 -mx-4 mb-4 flex items-center gap-2 border-b border-white/5 bg-background/80 px-4 py-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={leave}
          className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
          aria-label={t("back")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-lg font-bold leading-tight">New post</h1>
          <p className="truncate text-[11px] text-muted-foreground">
            Drafts save automatically on this device.
          </p>
        </div>
        <Link
          to="/feed"
          className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </Link>
      </header>

      <PostComposer
        fullPage
        onPosted={() => {
          void navigate({ to: "/feed" });
        }}
      />

      <p className="mt-2 px-1 text-[11px] leading-relaxed text-muted-foreground">
        Mention someone with <span className="font-semibold text-foreground">@</span>, start a tag with{" "}
        <span className="font-semibold text-foreground">#</span>, or reach for a realm emoji with the
        smiley. Everything stays in the draft until you post it.
      </p>
    </div>
  );
}
