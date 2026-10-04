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
    visibility?: "public" | "close_friends" | null;
    quote_post_id?: string | null;
    remix_of?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const caption = (data.caption ?? "").toString().trim().slice(0, 2000) || null;
    const media_type: "image" | "video" | "none" =
      data.media_type === "image" || data.media_type === "video" ? data.media_type : "none";
    const media_url =
      data.media_url && typeof data.media_url === "string" ? data.media_url.slice(0, 2048) : null;
    const visibility: "public" | "close_friends" =
      data.visibility === "close_friends" ? "close_friends" : "public";
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const quote_post_id = data.quote_post_id && uuid.test(data.quote_post_id) ? data.quote_post_id : null;
    const remix_of = data.remix_of && uuid.test(data.remix_of) ? data.remix_of : null;
    if (!caption && !media_url && !quote_post_id) throw new Error("Add a caption or media before posting");

    const { data: row, error } = await supabase
      .from("posts")
      .insert({ author_id: userId, caption, media_url, media_type, visibility, quote_post_id, remix_of })
      .select()
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return row;
  });