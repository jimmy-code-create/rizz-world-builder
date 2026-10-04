GRANT EXECUTE ON FUNCTION public.extract_hashtags() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.on_first_post() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.award_badge(uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.bump_post_reactions() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.bump_post_likes() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.bump_post_comments() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.bump_poll_votes() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.bump_remix_count() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.touch_updated_at() TO authenticated, anon;