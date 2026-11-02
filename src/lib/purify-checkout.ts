/**
 * The one place that starts a Purify Checkout session.
 *
 * The pricing page and the paywall sheet both use it, so neither grows its own
 * copy of the endpoint, the headers or the error messages. Billing is off until
 * the Stripe keys exist; the API answers 503 and this throws that message
 * verbatim so the member reads the real reason.
 */
export async function startPurifyCheckout(accessToken?: string): Promise<string> {
  const response = await fetch("/api/purify/checkout", {
    method: "POST",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  const body = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!response.ok) throw new Error(body.error || "Couldn't start checkout.");
  if (!body.url) throw new Error("Stripe did not return a checkout link.");
  return body.url;
}
