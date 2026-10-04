
-- Notifications: only authenticated users acting as themselves can insert
DROP POLICY "System inserts notifications" ON public.notifications;
CREATE POLICY "Authed insert notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = actor_id);

-- Storage: restrict listing to specific objects (public read still works for direct URLs)
DROP POLICY "Post media public read" ON storage.objects;
DROP POLICY "Avatars public read" ON storage.objects;
CREATE POLICY "Post media read" ON storage.objects FOR SELECT
  USING (bucket_id = 'post-media' AND auth.role() IS NOT NULL);
CREATE POLICY "Avatars read" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars' AND auth.role() IS NOT NULL);

-- Revoke public/authenticated execute on trigger-only functions
REVOKE EXECUTE ON FUNCTION public.bump_post_likes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_post_comments() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_post_reactions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
