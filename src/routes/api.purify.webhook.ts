import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { untypedFrom } from "@/lib/untyped-db";

/**
 * Stripe → Purify.
 *
 * The only writer of `profiles.purify_until` (a trigger blocks client writes).
 * The signature is verified over the exact raw body with Web Crypto, so this
 * works in both the Node and edge builds without the Stripe SDK.
 *
 * Events we act on:
 *   checkout.session.completed   first payment — link the customer, grant time
 *   invoice.paid                 renewals — extend to the paid period end
 *   customer.subscription.*      status changes — mirror the period or revoke
 *
 * POST /api/purify/webhook
 */

const TOLERANCE_SECONDS = 5 * 60;

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
}

/** Constant-time-ish comparison; both sides are fixed-length hex digests. */
function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifiedEvent(
  raw: string,
  header: string | null,
  secret: string,
): Promise<{ type?: string; data?: { object?: Record<string, unknown> } } | null> {
  if (!header) return null;
  const parts = header.split(",").reduce<Record<string, string[]>>((acc, part) => {
    const [key, value] = part.split("=", 2);
    if (!key || value === undefined) return acc;
    (acc[key.trim()] ??= []).push(value.trim());
    return acc;
  }, {});
  const timestamp = Number(parts.t?.[0]);
  if (!Number.isFinite(timestamp)) return null;
  if (Math.abs(Date.now() / 1000 - timestamp) > TOLERANCE_SECONDS) return null;

  const expected = await sign(secret, `${timestamp}.${raw}`);
  const matches = (parts.v1 ?? []).some((candidate) => sameHex(candidate, expected));
  if (!matches) return null;

  try {
    return JSON.parse(raw) as { type?: string; data?: { object?: Record<string, unknown> } };
  } catch {
    return null;
  }
}

function periodEndIso(value: unknown): string | null {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

export const Route = createFileRoute("/api/purify/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!secret || !url || !serviceKey) {
          console.error("[purify] webhook is not configured");
          return Response.json({ error: "Purify webhook is not configured." }, { status: 503 });
        }

        const raw = await request.text();
        const event = await verifiedEvent(raw, request.headers.get("stripe-signature"), secret);
        if (!event) {
          return Response.json({ error: "Invalid signature." }, { status: 400 });
        }

        const admin = createClient<Database>(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const profiles = untypedFrom(admin)("profiles");
        const object = (event.data?.object ?? {}) as {
          client_reference_id?: string;
          customer?: string;
          subscription?: string;
          metadata?: { user_id?: string };
          subscription_details?: { current_period_end?: number };
          status?: string;
          lines?: { data?: Array<{ period?: { end?: number } }> };
          items?: { data?: Array<{ current_period_end?: number }> };
        };
        const type = event.type ?? "";

        const grant = async (userId: string, patch: Record<string, unknown>) => {
          const { error } = await profiles.update(patch).eq("id", userId);
          if (error) console.error("[purify] could not update entitlement", error.message);
        };

        const findByCustomer = async (customerId: unknown) => {
          if (typeof customerId !== "string" || !customerId) return null;
          const { data } = await profiles
            .select("id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();
          return (data as { id?: string } | null)?.id ?? null;
        };

        try {
          if (type === "checkout.session.completed") {
            const userId = String(object.client_reference_id ?? object.metadata?.user_id ?? "");
            const until =
              periodEndIso(object.subscription_details?.current_period_end) ??
              new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();
            if (userId) {
              await grant(userId, {
                purify_until: until,
                stripe_customer_id: typeof object.customer === "string" ? object.customer : null,
                stripe_subscription_id:
                  typeof object.subscription === "string" ? object.subscription : null,
              });
            }
          } else if (type === "invoice.paid") {
            const userId = await findByCustomer(object.customer);
            const until = periodEndIso(object.lines?.data?.[0]?.period?.end) ?? null;
            if (userId && until) await grant(userId, { purify_until: until });
          } else if (
            type === "customer.subscription.updated" ||
            type === "customer.subscription.deleted"
          ) {
            const userId = await findByCustomer(object.customer);
            const status = String(object.status ?? "");
            const live =
              type !== "customer.subscription.deleted" &&
              ["active", "trialing", "past_due"].includes(status);
            const until = live ? periodEndIso(object.items?.data?.[0]?.current_period_end) : null;
            if (userId) await grant(userId, { purify_until: live ? until : null });
          }
        } catch (error) {
          console.error("[purify] webhook handler failed", error);
          return Response.json({ error: "Could not process the event." }, { status: 500 });
        }

        return Response.json({ received: true });
      },
    },
  },
});
