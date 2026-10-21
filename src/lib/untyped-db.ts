/**
 * Escape hatch for tables and functions a *pending* migration adds (realm
 * webhook bots, their rate limits, get_profile_card, get_leaderboard…).
 *
 * The generated types only know shipped schema. Casting the client itself to
 * `never` produced values TypeScript refuses to call, so each call site carried
 * a `@ts-expect-error` that quietly stopped applying and turned into a build
 * error of its own. The cast lives here once, next to the reason for it, so call
 * sites read normally: `untypedFrom(supabase)("realm_bots").select(…)`.
 */

/** Any Supabase client, typed or not — only the two members below are read. */
type UntypedClient = { from: unknown; rpc: unknown };

/* eslint-disable @typescript-eslint/no-explicit-any */
export function untypedFrom(client: UntypedClient): (table: string) => any {
  // Call through the client, never with a detached function: PostgrestClient
  // keeps its URL/auth on `this`, so `const rpc = client.rpc` loses `this.rest`
  // and throws "Cannot read properties of undefined (reading 'rest')".
  return (table: string) => (client.from as any).call(client, table);
}

export function untypedRpc(
  client: UntypedClient,
): (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }> {
  return (fn: string, args?: Record<string, unknown>) =>
    (client.rpc as any).call(client, fn, args);
}
/* eslint-enable @typescript-eslint/no-explicit-any */
