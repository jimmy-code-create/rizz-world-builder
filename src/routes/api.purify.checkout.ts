import { createFileRoute } from "@tanstack/react-router";
import { getAuthorizedSupabase } from "@/lib/server-supabase";

/**
 * Starts a Stripe Checkout session for Purify.
 *
 * Stripe's REST API is called directly with fetch rather than through the SDK:
 * the app is bundled for both Node and edge, and a form-encoded POST keeps the
 * server bundle free of Node-only dependencies.
 *
 * POST /api/purify/checkout  →  { url } | { error }
 */
export const Route = createFileRoute("/api/purify/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await getAuthorizedSupabase(request);
        if (auth instanceof Response) return auth;

        const secret = process.env.STRIPE_SECRET_KEY;
        const price = process.env.STRIPE_PRICE_ID;
        if (!secret || !price) {
          return Response.json(
            { error: "Purify billing isn't connected yet. Add the Stripe keys to open it." },
            { status: 503 },
          );
        }

        const origin = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
        const body = new URLSearchParams({
          mode: "subscription",
          "line_items[0][price]": price,
          "line_items[0][quantity]": "1",
          success_url: `${origin}/purify?checkout=success`,
          cancel_url: `${origin}/purify?checkout=cancelled`,
          // Both places, so the webhook can find the member whether it reads the
          // session or the subscription it creates.
          client_reference_id: auth.userId,
          "metadata[user_id]": auth.userId,
          "subscription_data[metadata][user_id]": auth.userId,
        });

        const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secret}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        });

        const result = (await response.json().catch(() => ({}))) as {
          url?: string;
          error?: { message?: string };
        };

        if (!response.ok || !result.url) {
          console.error("[purify] checkout failed", response.status, result.error?.message);
          return Response.json(
            { error: "Couldn't open checkout. Try again in a moment." },
            { status: 502 },
          );
        }

        return Response.json({ url: result.url }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
