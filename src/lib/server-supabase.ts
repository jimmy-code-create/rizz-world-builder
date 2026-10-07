import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AuthorizedSupabase = {
  client: SupabaseClient<Database>;
  userId: string;
};

export async function getAuthorizedSupabase(request: Request): Promise<AuthorizedSupabase | Response> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return Response.json({ error: "Not signed in." }, { status: 401 });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return Response.json({ error: "Account service is not configured." }, { status: 503 });
  }

  const client = createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string") {
    return Response.json({ error: "Sign in again to continue." }, { status: 401 });
  }

  return { client, userId };
}
