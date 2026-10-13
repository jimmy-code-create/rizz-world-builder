-- Stories: real likes, a working view counter, and a full audience model.
--
-- Three separate bugs are fixed here.
--
-- 1. There was no story like at all. `story_reactions` covers emoji reactions,
--    but a tap-to-like with a count had nothing behind it: `stories` had
--    `view_count` and no `like_count`, and no `story_likes` table. So a "like"
--    button either did nothing or only re-rendered a local flag.
--
-- 2. `bump_story_views` never incremented anything. It is a plain trigger, so
--    the UPDATE on `stories` ran as the *viewer*, and the only UPDATE policy on
--    `stories` is the author's — RLS matched zero rows and `view_count` stayed
--    at 0 forever. The same trigger shape is used for likes below, so both are
--    now SECURITY DEFINER and do their job.
--
-- 3. Privacy was binary (`post_visibility`: public / close_friends). Stories
--    needed "followers only" and a hide-from list on top of that. Both are
--    enforced in RLS, not just in the client query, because a private story
--    must not be readable by a direct PostgREST call either.

-- ============ 1. story columns ============

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;

-- People this story is hidden from, regardless of the audience.
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS hidden_from uuid[] NOT NULL DEFAULT '{}';

-- The audience for a story is stored in the existing `visibility` column so a
-- single value decides who can see it; adding the enum member keeps older rows
-- (and the posts that share the type) exactly as they were.
ALTER TYPE public.post_visibility ADD VALUE IF NOT EXISTS 'followers';

-- ============ 2. audience helpers ============

-- "followers only" means the *viewer* follows the author.
CREATE OR REPLACE FUNCTION public.is_follower(_owner uuid, _viewer uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.follows
    WHERE following_id = _owner AND follower_id = _viewer
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_story(
  _author uuid,
  _visibility public.post_visibility,
  _hidden_from uuid[]
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    -- The author always sees their own story, including in their own viewers list.
    _author = auth.uid()
    OR (
      NOT public.is_blocked_pair(_author, auth.uid())
      -- An explicit hide-from wins over any audience.
      AND NOT (auth.uid() = ANY(coalesce(_hidden_from, '{}'::uuid[])))
      -- Compared as text on purpose: `ALTER TYPE ... ADD VALUE` in this same
      -- migration cannot be *used* as an enum literal until it is committed, so
      -- casting to text keeps this function creatable in one transaction.
      AND CASE _visibility::text
            WHEN 'public' THEN true
            WHEN 'followers' THEN public.is_follower(_author, auth.uid())
            ELSE public.is_close_friend(_author, auth.uid())
          END
    )
$$;

-- Drop the old expiry-only/close-friend-only policies and replace them with the
-- audience-aware pair below.
DROP POLICY IF EXISTS "stories_select_visible" ON public.stories;
DROP POLICY IF EXISTS "stories_select_public_anon" ON public.stories;
DROP POLICY IF EXISTS "active stories viewable" ON public.stories;

CREATE POLICY "stories_select_visible" ON public.stories
  FOR SELECT TO authenticated
  USING (expires_at > now() AND public.can_view_story(author_id, visibility, hidden_from));

CREATE POLICY "stories_select_public_anon" ON public.stories
  FOR SELECT TO anon
  USING (expires_at > now() AND visibility = 'public' AND coalesce(array_length(hidden_from, 1), 0) = 0);

-- The author is the only one who may edit a story (its audience, or nothing else).
DROP POLICY IF EXISTS "authors update own stories" ON public.stories;
CREATE POLICY "authors update own stories" ON public.stories
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- ============ 3. story likes ============

CREATE TABLE IF NOT EXISTS public.story_likes (
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);

CREATE INDEX IF NOT EXISTS story_likes_story_idx ON public.story_likes (story_id);
CREATE INDEX IF NOT EXISTS story_likes_user_idx ON public.story_likes (user_id);

REVOKE ALL ON public.story_likes FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON public.story_likes TO authenticated;
GRANT ALL ON public.story_likes TO service_role;

ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;

-- You can see your own likes; the author can see who liked their story (that is
-- what the viewer/like panel shows). Everybody else only ever reads the count
-- from `stories.like_count`, which is why this stays narrow.
DROP POLICY IF EXISTS "story_likes_select" ON public.story_likes;
CREATE POLICY "story_likes_select" ON public.story_likes
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_likes.story_id AND s.author_id = auth.uid())
  );

DROP POLICY IF EXISTS "story_likes_insert" ON public.story_likes;
CREATE POLICY "story_likes_insert" ON public.story_likes
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.expires_at > now())
  );

DROP POLICY IF EXISTS "story_likes_delete" ON public.story_likes;
CREATE POLICY "story_likes_delete" ON public.story_likes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============ 4. counters that actually move ============

-- Was a plain trigger, so RLS filtered its UPDATE to zero rows (see the header).
CREATE OR REPLACE FUNCTION public.bump_story_views() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.stories SET view_count = view_count + 1 WHERE id = NEW.story_id;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.bump_story_likes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.stories SET like_count = like_count + 1 WHERE id = NEW.story_id;
    RETURN NEW;
  END IF;
  UPDATE public.stories SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.story_id;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS bump_story_likes_t ON public.story_likes;
CREATE TRIGGER bump_story_likes_t
  AFTER INSERT OR DELETE ON public.story_likes
  FOR EACH ROW EXECUTE FUNCTION public.bump_story_likes();

-- A one-off repair: every existing story was sitting on a view count that the
-- broken trigger never advanced. Recompute from the rows that were recorded.
UPDATE public.stories s
SET view_count = (
  SELECT count(*) FROM public.story_views v WHERE v.story_id = s.id
)
WHERE s.view_count <> (SELECT count(*) FROM public.story_views v WHERE v.story_id = s.id);

-- ============ 5. realtime ============

-- `like_count` changes must reach the author watching their own story.
ALTER TABLE public.stories REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.story_likes;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
