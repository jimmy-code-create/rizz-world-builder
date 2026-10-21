-- Discord-style standing banner gradients, stored as a preset id rather than
-- a second uploaded asset. An uploaded banner still wins on every surface.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banner_gradient text;

COMMENT ON COLUMN public.profiles.banner_gradient IS
  'Optional banner gradient preset id (signal, aurora, ember, ocean, orchid, moon, gold). Ignored when banner_url is set.';

-- Keep the card RPC in sync: gradients, accent and the featured badge all ride
-- with the profile payload so every preview paints the same banner.
CREATE OR REPLACE FUNCTION public.get_profile_card(_user_id uuid, _viewer uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_profile jsonb;
  v_result jsonb;
BEGIN
  SELECT to_jsonb(p) INTO v_profile
  FROM public.profiles p
  WHERE p.id = _user_id;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('deleted', true);
  END IF;

  SELECT jsonb_build_object(
    'profile', jsonb_build_object(
      'id', v_profile->>'id',
      'username', v_profile->>'username',
      'display_name', v_profile->>'display_name',
      'avatar_url', v_profile->>'avatar_url',
      'banner_url', v_profile->>'banner_url',
      'banner_gradient', v_profile->>'banner_gradient',
      'accent_color', v_profile->>'accent_color',
      'bio', v_profile->>'bio',
      'pronouns', v_profile->>'pronouns',
      'status_text', v_profile->>'status_text',
      'featured_badge', v_profile->>'featured_badge',
      'verified', EXISTS (
        SELECT 1 FROM public.user_badges ub
        JOIN public.badges b ON b.id = ub.badge_id
        WHERE ub.user_id = _user_id AND b.slug IN ('verified', 'verified_creator')
      ),
      'created_at', v_profile->>'created_at',
      'rizz_score', coalesce((v_profile->>'rizz_score')::integer, 0),
      'paw_balance', coalesce((v_profile->>'paw_balance')::integer, 0),
      'paw_earned', coalesce((v_profile->>'paw_earned')::integer, 0),
      'badges', coalesce(v_profile->'badges', '[]'::jsonb)
    ),
    'rank', (
      SELECT count(*) + 1 FROM public.profiles p2
      WHERE coalesce(p2.paw_earned, 0) > coalesce((v_profile->>'paw_earned')::integer, 0)
        AND p2.username IS NOT NULL
    ),
    'followers', (SELECT count(*) FROM public.follows WHERE following_id = _user_id),
    'following', (SELECT count(*) FROM public.follows WHERE follower_id = _user_id),
    'mutual_preview', (
      SELECT coalesce(jsonb_agg(t ORDER BY t.username), '[]'::jsonb) FROM (
        SELECT p3.id, p3.username, p3.display_name, p3.avatar_url
        FROM public.follows f1
        JOIN public.follows f2 ON f2.follower_id = _viewer AND f2.following_id = f1.follower_id
        JOIN public.profiles p3 ON p3.id = f1.follower_id
        WHERE f1.following_id = _user_id AND _viewer IS NOT NULL AND _viewer <> _user_id
        LIMIT 3
      ) t
    ),
    'mutual_total', (
      SELECT count(*) FROM public.follows f1
      JOIN public.follows f2 ON f2.follower_id = _viewer AND f2.following_id = f1.follower_id
      WHERE f1.following_id = _user_id AND _viewer IS NOT NULL AND _viewer <> _user_id
    ),
    'earned_badges', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'slug', b.slug, 'name', b.name, 'icon', b.icon,
        'color', b.color, 'description', b.description
      ) ORDER BY b.tier DESC), '[]'::jsonb)
      FROM public.user_badges ub
      JOIN public.badges b ON b.id = ub.badge_id
      WHERE ub.user_id = _user_id
      LIMIT 8
    ),
    'viewer_follows', EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = _viewer AND following_id = _user_id
    ),
    'followed_by_viewer_target', EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = _user_id AND following_id = _viewer
    ),
    'blocked_by_viewer', EXISTS (
      SELECT 1 FROM public.blocks
      WHERE blocker_id = _viewer AND blocked_id = _user_id
    ),
    'blocked_viewer', EXISTS (
      SELECT 1 FROM public.blocks
      WHERE blocker_id = _user_id AND blocked_id = _viewer
    ),
    'muted_by_viewer', EXISTS (
      SELECT 1 FROM public.mutes
      WHERE muter_id = _viewer AND muted_id = _user_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_profile_card(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_card(uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
