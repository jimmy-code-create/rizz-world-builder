import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server-side validated post creation. Kept in its own thin module so the
 * server-function splitter never strips runtime siblings (that previously
 * broke uploads from the reels/post composer).
 */
export const createPostValidated = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    caption?: string | null;
    media_url?: string | null;
    media_type?: "image" | "video" | "none" | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const caption = (data.caption ?? "").toString().trim().slice(0, 2000) || null;
    const media_type: "image" | "video" | "none" =
      data.media_type === "image" || data.media_type === "video" ? data.media_type : "none";
    const media_url =
      data.media_url && typeof data.media_url === "string" ? data.media_url.slice(0, 2048) : null;
    if (!caption && !media_url) throw new Error("Add a caption or media before posting");

    const { data: row, error } = await supabase
      .from("posts")
      .insert({ author_id: userId, caption, media_url, media_type })
      .select()
      .single();
    if (error) {
      const msg = error.message || "";
      if (/out of range|integer|numeric/i.test(msg)) throw new Error("A number was too large. Try a shorter caption.");
      if (/value too long|too long/i.test(msg)) throw new Error("Caption or link is too long. Shorten it and try again.");
      if (/violates.*row-level/i.test(msg)) throw new Error("You don't have permission to post right now. Sign back in.");
      if (/foreign key/i.test(msg)) throw new Error("Your profile isn't fully set up yet. Reload the page.");
      throw new Error(`Couldn't post: ${msg}`);
    }
    return row;
  });