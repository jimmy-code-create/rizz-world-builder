import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ChevronLeft, Crown, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { PURIFY_BENEFITS, PURIFY_PRICE_LABEL, isPurifyEnforced, usePurify } from "@/lib/purify";

export const Route = createFileRoute("/_app/purify")({
  head: () => ({ meta: [{ title: "Purify · RIZZ" }] }),
  component: PurifyPage,
});

function formatUntil(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Purify is the $1/month tier: gradients, banner photos, GIFs and larger chat
 * uploads. The page is the only place that starts billing; every gate links
 * here instead of opening its own checkout.
 */
function PurifyPage() {
  const { session } = useAuth();
  const { active, until, enforced } = usePurify();
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const endsOn = formatUntil(until);

  async function startCheckout() {
    if (starting) return;
    setStarting(true);
    setNotice(null);
    try {
      const response = await fetch("/api/purify/checkout", {
        method: "POST",
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      const body = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "Couldn't start checkout.");
      if (!body.url) throw new Error("Stripe did not return a checkout link.");
      window.location.href = body.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Couldn't start checkout.";
      setNotice(message);
      toast.error(message);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link
        to="/settings"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Settings
      </Link>

      {/* Rizzy sells it: the mascot introduces Purify in the app instead of
          leaving members to discover a paywall on their own. */}
      <section className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/[0.06] p-3.5">
        <img src="/brand/rizz-cat-logo.svg" alt="Rizzy" className="h-10 w-10 shrink-0" />
        <p className="text-xs leading-relaxed text-foreground/90">
          <span className="font-semibold text-primary">Rizzy:</span> Purify is the one upgrade
          I would buy myself — gradients, banner photos, GIFs and big uploads, all for a dollar.
          {active ? " You already have it. Thank you for keeping the lights on." : " Cancel anytime."}
        </p>
      </section>

      <section className="glass relative overflow-hidden rounded-3xl border border-white/5 p-6 text-center">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40"
          style={{
            background:
              "radial-gradient(80% 120% at 50% -25%, color-mix(in srgb, var(--primary) 45%, transparent), transparent 70%)",
          }}
        />
        <div className="relative">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
            <Crown className="h-8 w-8" />
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">Purify</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything on your profile, unlocked. Cancel anytime.
          </p>

          <p className="mt-4 font-display text-2xl font-bold text-primary">{PURIFY_PRICE_LABEL}</p>

          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-semibold">
            {active ? (
              <>
                <Check className="h-3.5 w-3.5 text-primary" />
                Active{endsOn ? ` · renews ${endsOn}` : ""}
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                Not active
              </>
            )}
          </p>

          {!active && (
            <Button
              type="button"
              onClick={() => void startCheckout()}
              disabled={starting}
              className="mt-5 h-12 w-full gap-2 text-[15px] font-bold"
            >
              {starting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Crown className="h-4 w-4" />
              )}
              {starting ? "Opening checkout…" : `Get Purify — ${PURIFY_PRICE_LABEL}`}
            </Button>
          )}

          {notice && (
            <p role="status" className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              {notice}
            </p>
          )}

          {!enforced && (
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Billing opens soon — until then every Purify feature is free for everyone.
            </p>
          )}
        </div>
      </section>

      <section className="glass rounded-2xl border border-white/5 p-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          What Purify unlocks
        </h2>
        <ul className="mt-3 divide-y divide-white/5">
          {PURIFY_BENEFITS.map((benefit) => (
            <li key={benefit.title} className="flex gap-3 py-3 first:pt-0 last:pb-0">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <Check className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{benefit.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  {benefit.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        If Purify ends, nothing you already set is taken away — your current banner and gradient
        stay exactly as they are. Only new gradient or banner changes ask for Purify again.
      </p>
    </div>
  );
}
