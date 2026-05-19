
REVOKE EXECUTE ON FUNCTION public.award_badge(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_first_post() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_first_drop_claim() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_channel_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_rizz_change() FROM PUBLIC, anon, authenticated;
