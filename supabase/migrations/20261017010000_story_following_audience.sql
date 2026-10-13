-- Allow authors to share stories only with people they follow ("following only").
ALTER TYPE public.post_visibility ADD VALUE IF NOT EXISTS 'following';

-- "following only" means the *author* follows the viewer ("only who we are following can see the story").
CREATE OR REPLACE FUNCTION public.is_following(_owner uuid, _viewer uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.follows
    WHERE following_id = _viewer AND follower_id = _owner
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_story(
  _author uuid,
  _visibility public.post_visibility,
  _hidden_from uuid[]
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    -- The author always sees their own story.
    _author = auth.uid()
    OR (
      NOT public.is_blocked_pair(_author, auth.uid())
      -- An explicit hide-from wins over any audience.
      AND NOT (auth.uid() = ANY(coalesce(_hidden_from, '{}'::uuid[])))
      AND CASE _visibility::text
            WHEN 'public' THEN true
            WHEN 'followers' THEN public.is_follower(_author, auth.uid())
            WHEN 'following' THEN public.is_following(_author, auth.uid())
            ELSE public.is_close_friend(_author, auth.uid())
          END
    )
$$;
