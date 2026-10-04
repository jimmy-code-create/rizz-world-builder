-- 1. posts: drop blanket policy, replace with visibility-aware public policy
DROP POLICY IF EXISTS "Posts viewable by everyone" ON public.posts;
CREATE POLICY "posts_select_public_anon" ON public.posts
  FOR SELECT TO anon USING (visibility = 'public');

-- 2. stories: drop blanket policy, keep expiry in visibility-aware policies
DROP POLICY IF EXISTS "active stories viewable" ON public.stories;
DROP POLICY IF EXISTS "stories_select_visible" ON public.stories;
CREATE POLICY "stories_select_visible" ON public.stories
  FOR SELECT TO authenticated
  USING (expires_at > now() AND public.can_view_author(author_id, visibility));
CREATE POLICY "stories_select_public_anon" ON public.stories
  FOR SELECT TO anon
  USING (expires_at > now() AND visibility = 'public');

-- 3. group_invites: only group members/admins can read
DROP POLICY IF EXISTS "invites readable" ON public.group_invites;
CREATE POLICY "invites readable by members" ON public.group_invites
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

-- 4. user_roles: own role or admins only
DROP POLICY IF EXISTS "Roles viewable by everyone" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
REVOKE SELECT ON public.user_roles FROM anon;

-- 5. storage read policies: require actual authentication
DROP POLICY IF EXISTS "Avatars read" ON storage.objects;
CREATE POLICY "Avatars read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "Post media read" ON storage.objects;
CREATE POLICY "Post media read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'post-media');

-- 6. revoke direct EXECUTE on privileged SECURITY DEFINER functions not used by RLS
REVOKE EXECUTE ON FUNCTION public.award_badge(uuid, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.pick_giveaway_winners(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enforce_group_friends() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.extract_hashtags() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.on_channel_created() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.on_first_drop_claim() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.on_first_post() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.on_rizz_change() FROM anon, authenticated, public;