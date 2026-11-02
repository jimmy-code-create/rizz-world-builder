import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { PURIFY_PERKS, PURIFY_PRICE_LABEL, PURIFY_PRICE_SHORT, usePurify } from "@/lib/purify";
import { startPurifyCheckout } from "@/lib/purify-checkout";
import {
  markPaywallSeen,
  paywallCapAllows,
  PURIFY_PAYWALL_EVENT,
  type PurifyPaywallDetail,
} from "@/lib/purify-paywall";
import { PurifyShield } from "@/components/purify/PurifyShield";

/**
 * The paywall a gate opens instead of a toast: the mark, three perks and the
 * price, with the full page one tap away.
 *
 * It is opened by the `rizz:open-purify-paywall` event (see
 * `openPurifyPaywall`), so every locked action in the app asks for the same
 * sheet. A deliberate tap always shows it; anything unasked-for respects the
 * seven-day cap, and every dismissal restarts that window.
 */
export function PurifyPaywallSheet() {
  const { session } = useAuth();
  const { active } = usePurify();
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<PurifyPaywallDetail>).detail;
      // Already a member, or a proactive offer inside the cooldown: stay closed.
      if (active) return;
      if (!detail?.reason && !paywallCapAllows()) return;
      setReason(detail?.reason ?? null);
      setOpen(true);
    };
    window.addEventListener(PURIFY_PAYWALL_EVENT, onOpen);
    return () => window.removeEventListener(PURIFY_PAYWALL_EVENT, onOpen);
  }, [active]);

  const close = (next: boolean) => {
    if (!next) markPaywallSeen();
    setOpen(next);
  };

  async function startCheckout() {
    if (starting) return;
    setStarting(true);
    try {
      window.location.href = await startPurifyCheckout(session?.access_token);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Couldn't start checkout.";
      toast.error(message);
    } finally {
      setStarting(false);
    }
  }

  // Three perks is the sheet's budget; the page carries the rest.
  const perks = PURIFY_PERKS.slice(0, 3);

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent
        side="bottom"
        className="glass-strong max-h-[86dvh] overflow-y-auto rounded-t-3xl border-white/10 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]"
      >
        <SheetHeader className="px-1 text-left">
          <SheetTitle className="flex items-center gap-3 font-display text-lg">
            <PurifyShield size={34} shimmer={false} />
            Purify unlocks this
          </SheetTitle>
        </SheetHeader>

        <div className="mt-1 px-1">
          {reason ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">{reason}</span> — a Purify perk.
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              One dollar a month, and it covers every perk below. Cancel anytime.
            </p>
          )}
        </div>

        <ul className="mt-4 space-y-3 px-1">
          {perks.map((perk) => (
            <li key={perk.id} className="flex gap-3">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{perk.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  {perk.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-5 px-1">
          <Button
            type="button"
            onClick={() => void startCheckout()}
            disabled={starting}
            className="h-12 w-full gap-2 text-[15px] font-bold"
          >
            {starting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {starting ? "Opening checkout…" : `Get Purify · ${PURIFY_PRICE_SHORT}`}
          </Button>

          <div className="mt-1 flex items-center justify-between gap-2">
            <Link
              to="/purify"
              onClick={() => close(false)}
              className="inline-flex min-h-11 items-center px-1 text-xs font-semibold text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              See every perk · {PURIFY_PRICE_LABEL}
            </Link>
            <button
              type="button"
              onClick={() => close(false)}
              className="inline-flex min-h-11 items-center px-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Maybe later
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
