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
          .select("id, username, display_name, avatar_url, banner_url, bio, rizz_score, accent_color, theme_preset, theme_mode, ui_density, reduced_motion, trial_active, trial_ends_at, tutorial_seen, interests")
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
