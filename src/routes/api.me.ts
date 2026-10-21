import { createFileRoute } from "@tanstack/react-router";
import { getAuthorizedSupabase } from "@/lib/server-supabase";

export const Route = createFileRoute("/api/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await getAuthorizedSupabase(request);
        if (auth instanceof Response) return auth;

        const { data: profile, error } = await auth.client
          .from("profiles")
          // `*` tolerates optional columns (banner_gradient) before a migration
          // is applied, instead of failing sign-in for the whole app.
          .select("*")
          .eq("id", auth.userId)
          .maybeSingle();
        if (error) {
          console.error("[/api/me] profile lookup failed", error);
          return Response.json({ error: "Couldn't load your account." }, { status: 500 });
        }

        return Response.json(
          { profile },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
