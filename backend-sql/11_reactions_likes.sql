-- RIZZ reaction and like RPCs. Safe to re-run; existing reaction rows remain.

-- The original table covered public-channel messages only. Add a scope so the
-- same authenticated RPC can safely handle channel, DM, and group messages.
ALTER TABLE public.message_reactions
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'channel';
ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS parent_comment_id uuid
    REFERENCES public.post_comments(id) ON DELETE CASCADE;
ALTER TABLE public.message_reactions
  DROP CONSTRAINT IF EXISTS message_reactions_message_id_fkey;
ALTER TABLE public.message_reactions
  DROP CONSTRAINT IF EXISTS message_reactions_pkey;
CREATE UNIQUE INDEX IF NOT EXISTS message_reactions_scoped_unique
  ON public.message_reactions(message_type, message_id, user_id, emoji);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.message_reactions'::regclass
      AND conname = 'message_reactions_type_check'
  ) THEN
    ALTER TABLE public.message_reactions
      ADD CONSTRAINT message_reactions_type_check
      CHECK (message_type IN ('channel', 'dm', 'group'));
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.comment_reactions (
  comment_id uuid NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (length(emoji) BETWEEN 1 AND 16),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id, emoji)
);
CREATE TABLE IF NOT EXISTS public.comment_likes (
  comment_id uuid NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

-- Clear permissive legacy policies on user-generated interaction rows before
-- installing the block-aware read policies below. All writes now go through
-- the security-definer RPCs in this file.
DO $policies$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'message_reactions', 'dm_reactions', 'post_reactions',
        'post_likes', 'story_reactions', 'comment_reactions', 'comment_likes'
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I',
      v_policy.policyname, v_policy.schemaname, v_policy.tablename);
  END LOOP;
END;
$policies$;

DROP POLICY IF EXISTS "reactions viewable" ON public.message_reactions;
DROP POLICY IF EXISTS "users react as self" ON public.message_reactions;
DROP POLICY IF EXISTS "users unreact self" ON public.message_reactions;
DROP POLICY IF EXISTS message_reactions_member_select ON public.message_reactions;
CREATE POLICY message_reactions_member_select ON public.message_reactions
  FOR SELECT TO authenticated USING (
    CASE message_type
      WHEN 'channel' THEN EXISTS (
        SELECT 1 FROM public.messages m
        JOIN public.channel_members cm ON cm.channel_id = m.channel_id
        WHERE m.id = message_id AND cm.user_id = auth.uid()
      )
      WHEN 'dm' THEN EXISTS (
        SELECT 1 FROM public.direct_messages dm
        WHERE dm.id = message_id AND auth.uid() IN (dm.sender_id, dm.recipient_id)
      )
      WHEN 'group' THEN EXISTS (
        SELECT 1 FROM public.group_messages gm
        WHERE gm.id = message_id AND public.is_group_member(gm.group_id, auth.uid())
      )
      ELSE false
    END
  );
DROP POLICY IF EXISTS dm_reactions_select_members ON public.dm_reactions;
DROP POLICY IF EXISTS "dm reactions viewable" ON public.dm_reactions;
CREATE POLICY dm_reactions_select_members ON public.dm_reactions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.direct_messages dm
      WHERE dm.id = message_id AND auth.uid() IN (dm.sender_id, dm.recipient_id)
        AND NOT public.is_blocked_pair(dm.sender_id, dm.recipient_id)
    )
  );
DROP POLICY IF EXISTS post_reactions_block_safe_select ON public.post_reactions;
DROP POLICY IF EXISTS "Reactions viewable by everyone" ON public.post_reactions;
CREATE POLICY post_reactions_block_safe_select ON public.post_reactions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_id AND NOT public.is_blocked_pair(p.author_id, auth.uid())
    )
  );
DROP POLICY IF EXISTS story_reactions_block_safe_select ON public.story_reactions;
DROP POLICY IF EXISTS "story_reactions_select" ON public.story_reactions;
CREATE POLICY story_reactions_block_safe_select ON public.story_reactions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_id
        AND NOT public.is_blocked_pair(s.author_id, auth.uid())
    )
  );
DROP POLICY IF EXISTS post_likes_block_safe_select ON public.post_likes;
CREATE POLICY post_likes_block_safe_select ON public.post_likes
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_id AND NOT public.is_blocked_pair(p.author_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS comment_reactions_select_members ON public.comment_reactions;
CREATE POLICY comment_reactions_select_members ON public.comment_reactions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.post_comments c
      JOIN public.posts p ON p.id = c.post_id
      WHERE c.id = comment_id
        AND NOT public.is_blocked_pair(c.author_id, auth.uid())
        AND NOT public.is_blocked_pair(p.author_id, auth.uid())
    )
  );
DROP POLICY IF EXISTS comment_likes_select_members ON public.comment_likes;
CREATE POLICY comment_likes_select_members ON public.comment_likes
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.post_comments c
      JOIN public.posts p ON p.id = c.post_id
      WHERE c.id = comment_id
        AND NOT public.is_blocked_pair(c.author_id, auth.uid())
        AND NOT public.is_blocked_pair(p.author_id, auth.uid())
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.message_reactions, public.dm_reactions,
  public.post_reactions, public.story_reactions, public.comment_reactions,
  public.comment_likes, public.post_likes FROM anon, authenticated;
GRANT SELECT ON public.message_reactions, public.dm_reactions, public.post_reactions,
  public.story_reactions, public.comment_reactions, public.comment_likes,
  public.post_likes TO authenticated;

CREATE OR REPLACE FUNCTION public.toggle_message_reaction(
  _message_id uuid,
  _emoji text,
  _message_type text DEFAULT 'channel'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_author uuid;
  v_allowed boolean := false;
BEGIN
  IF auth.uid() IS NULL OR length(coalesce(_emoji, '')) NOT BETWEEN 1 AND 16
     OR _message_type NOT IN ('channel', 'dm', 'group') THEN
    RAISE EXCEPTION 'Invalid reaction';
  END IF;

  IF _message_type = 'channel' THEN
    SELECT m.author_id INTO v_author
    FROM public.messages m
    JOIN public.channel_members cm ON cm.channel_id = m.channel_id AND cm.user_id = auth.uid()
    WHERE m.id = _message_id;
    v_allowed := FOUND;
  ELSIF _message_type = 'dm' THEN
    SELECT dm.sender_id INTO v_author FROM public.direct_messages dm
    WHERE dm.id = _message_id AND auth.uid() IN (dm.sender_id, dm.recipient_id);
    v_allowed := FOUND;
  ELSE
    SELECT gm.author_id INTO v_author FROM public.group_messages gm
    WHERE gm.id = _message_id AND public.is_group_member(gm.group_id, auth.uid());
    v_allowed := FOUND;
  END IF;

  IF NOT v_allowed OR public.is_blocked_pair(auth.uid(), v_author) THEN
    RAISE EXCEPTION 'Message not found or not available to this user';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.message_reactions
    WHERE message_type = _message_type AND message_id = _message_id
      AND user_id = auth.uid() AND emoji = _emoji
  ) THEN
    DELETE FROM public.message_reactions
    WHERE message_type = _message_type AND message_id = _message_id
      AND user_id = auth.uid() AND emoji = _emoji;
  ELSE
    INSERT INTO public.message_reactions(message_type, message_id, user_id, emoji)
    VALUES (_message_type, _message_id, auth.uid(), _emoji)
    ON CONFLICT (message_type, message_id, user_id, emoji) DO NOTHING;
  END IF;

  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'emoji', grouped.emoji, 'count', grouped.reaction_count, 'mine', grouped.mine
    ) ORDER BY grouped.emoji), '[]'::jsonb)
    FROM (
      SELECT emoji, count(*)::integer AS reaction_count,
        bool_or(user_id = auth.uid()) AS mine
      FROM public.message_reactions
      WHERE message_type = _message_type AND message_id = _message_id
      GROUP BY emoji
    ) grouped
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_dm_reaction(_message_id uuid, _emoji text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE v_sender uuid;
BEGIN
  IF auth.uid() IS NULL OR length(coalesce(_emoji, '')) NOT BETWEEN 1 AND 16 THEN
    RAISE EXCEPTION 'Invalid reaction';
  END IF;
  SELECT sender_id INTO v_sender FROM public.direct_messages
  WHERE id = _message_id AND auth.uid() IN (sender_id, recipient_id);
  IF NOT FOUND OR public.is_blocked_pair(auth.uid(), v_sender) THEN
    RAISE EXCEPTION 'Message not found or not available to this user';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.dm_reactions
    WHERE message_id = _message_id AND user_id = auth.uid() AND emoji = _emoji
  ) THEN
    DELETE FROM public.dm_reactions
    WHERE message_id = _message_id AND user_id = auth.uid() AND emoji = _emoji;
  ELSE
    INSERT INTO public.dm_reactions(message_id, user_id, emoji)
    VALUES (_message_id, auth.uid(), _emoji)
    ON CONFLICT (message_id, user_id, emoji) DO NOTHING;
  END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'emoji', grouped.emoji, 'count', grouped.reaction_count, 'mine', grouped.mine
    ) ORDER BY grouped.emoji), '[]'::jsonb)
    FROM (
      SELECT emoji, count(*)::integer AS reaction_count,
        bool_or(user_id = auth.uid()) AS mine
      FROM public.dm_reactions WHERE message_id = _message_id GROUP BY emoji
    ) grouped
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_post_reaction(_post_id uuid, _emoji text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE v_author uuid;
BEGIN
  IF auth.uid() IS NULL OR length(coalesce(_emoji, '')) NOT BETWEEN 1 AND 16 THEN
    RAISE EXCEPTION 'Invalid reaction';
  END IF;
  SELECT author_id INTO v_author FROM public.posts WHERE id = _post_id;
  IF NOT FOUND OR public.is_blocked_pair(auth.uid(), v_author) THEN
    RAISE EXCEPTION 'Post not found or not available to this user';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.post_reactions
    WHERE post_id = _post_id AND user_id = auth.uid() AND emoji = _emoji
  ) THEN
    DELETE FROM public.post_reactions
    WHERE post_id = _post_id AND user_id = auth.uid() AND emoji = _emoji;
  ELSE
    INSERT INTO public.post_reactions(post_id, user_id, emoji)
    VALUES (_post_id, auth.uid(), _emoji)
    ON CONFLICT (post_id, user_id, emoji) DO NOTHING;
  END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'emoji', grouped.emoji, 'count', grouped.reaction_count, 'mine', grouped.mine
    ) ORDER BY grouped.emoji), '[]'::jsonb)
    FROM (
      SELECT emoji, count(*)::integer AS reaction_count,
        bool_or(user_id = auth.uid()) AS mine
      FROM public.post_reactions WHERE post_id = _post_id GROUP BY emoji
    ) grouped
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_comment_reaction(_comment_id uuid, _emoji text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE v_author uuid; v_post_author uuid;
BEGIN
  IF auth.uid() IS NULL OR length(coalesce(_emoji, '')) NOT BETWEEN 1 AND 16 THEN
    RAISE EXCEPTION 'Invalid reaction';
  END IF;
  SELECT c.author_id, p.author_id INTO v_author, v_post_author
  FROM public.post_comments c JOIN public.posts p ON p.id = c.post_id
  WHERE c.id = _comment_id AND c.deleted_at IS NULL;
  IF NOT FOUND OR public.is_blocked_pair(auth.uid(), v_author)
     OR public.is_blocked_pair(auth.uid(), v_post_author) THEN
    RAISE EXCEPTION 'Comment not found or not available to this user';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.comment_reactions
    WHERE comment_id = _comment_id AND user_id = auth.uid() AND emoji = _emoji
  ) THEN
    DELETE FROM public.comment_reactions
    WHERE comment_id = _comment_id AND user_id = auth.uid() AND emoji = _emoji;
  ELSE
    INSERT INTO public.comment_reactions(comment_id, user_id, emoji)
    VALUES (_comment_id, auth.uid(), _emoji)
    ON CONFLICT (comment_id, user_id, emoji) DO NOTHING;
  END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'emoji', grouped.emoji, 'count', grouped.reaction_count, 'mine', grouped.mine
    ) ORDER BY grouped.emoji), '[]'::jsonb)
    FROM (
      SELECT emoji, count(*)::integer AS reaction_count,
        bool_or(user_id = auth.uid()) AS mine
      FROM public.comment_reactions WHERE comment_id = _comment_id GROUP BY emoji
    ) grouped
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_story_reaction(_story_id uuid, _emoji text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE v_author uuid;
BEGIN
  IF auth.uid() IS NULL OR length(coalesce(_emoji, '')) NOT BETWEEN 1 AND 16 THEN
    RAISE EXCEPTION 'Invalid reaction';
  END IF;
  SELECT author_id INTO v_author FROM public.stories
  WHERE id = _story_id AND expires_at > now();
  IF NOT FOUND OR public.is_blocked_pair(auth.uid(), v_author) THEN
    RAISE EXCEPTION 'Story not found or not available to this user';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.story_reactions
    WHERE story_id = _story_id AND user_id = auth.uid() AND emoji = _emoji
  ) THEN
    DELETE FROM public.story_reactions
    WHERE story_id = _story_id AND user_id = auth.uid() AND emoji = _emoji;
  ELSE
    INSERT INTO public.story_reactions(story_id, user_id, emoji)
    VALUES (_story_id, auth.uid(), _emoji)
    ON CONFLICT (story_id, user_id, emoji) DO NOTHING;
  END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'emoji', grouped.emoji, 'count', grouped.reaction_count, 'mine', grouped.mine
    ) ORDER BY grouped.emoji), '[]'::jsonb)
    FROM (
      SELECT emoji, count(*)::integer AS reaction_count,
        bool_or(user_id = auth.uid()) AS mine
      FROM public.story_reactions WHERE story_id = _story_id GROUP BY emoji
    ) grouped
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_comment_like(_comment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE v_author uuid; v_post_author uuid; v_liked boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to like a comment'; END IF;
  SELECT c.author_id, p.author_id INTO v_author, v_post_author
  FROM public.post_comments c JOIN public.posts p ON p.id = c.post_id
  WHERE c.id = _comment_id AND c.deleted_at IS NULL;
  IF NOT FOUND OR public.is_blocked_pair(auth.uid(), v_author)
     OR public.is_blocked_pair(auth.uid(), v_post_author) THEN
    RAISE EXCEPTION 'Comment not found or not available to this user';
  END IF;
  IF EXISTS (SELECT 1 FROM public.comment_likes WHERE comment_id = _comment_id AND user_id = auth.uid()) THEN
    DELETE FROM public.comment_likes WHERE comment_id = _comment_id AND user_id = auth.uid();
    v_liked := false;
  ELSE
    INSERT INTO public.comment_likes(comment_id, user_id)
    VALUES (_comment_id, auth.uid()) ON CONFLICT DO NOTHING;
    v_liked := true;
  END IF;
  RETURN jsonb_build_object(
    'liked', v_liked,
    'like_count', (SELECT count(*)::integer FROM public.comment_likes WHERE comment_id = _comment_id)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_like(_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE v_author uuid; v_liked boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to like a post'; END IF;
  SELECT author_id INTO v_author FROM public.posts WHERE id = _post_id;
  IF NOT FOUND OR public.is_blocked_pair(auth.uid(), v_author) THEN
    RAISE EXCEPTION 'Post not found or not available to this user';
  END IF;
  IF EXISTS (SELECT 1 FROM public.post_likes WHERE post_id = _post_id AND user_id = auth.uid()) THEN
    DELETE FROM public.post_likes WHERE post_id = _post_id AND user_id = auth.uid();
    v_liked := false;
  ELSE
    INSERT INTO public.post_likes(post_id, user_id)
    VALUES (_post_id, auth.uid()) ON CONFLICT DO NOTHING;
    v_liked := true;
  END IF;
  RETURN jsonb_build_object(
    'liked', v_liked,
    'like_count', (SELECT count(*)::integer FROM public.post_likes WHERE post_id = _post_id)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.toggle_message_reaction(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.toggle_dm_reaction(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.toggle_post_reaction(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.toggle_comment_reaction(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.toggle_story_reaction(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.toggle_comment_like(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.toggle_like(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_message_reaction(uuid, text, text),
  public.toggle_dm_reaction(uuid, text), public.toggle_post_reaction(uuid, text),
  public.toggle_comment_reaction(uuid, text), public.toggle_story_reaction(uuid, text),
  public.toggle_comment_like(uuid), public.toggle_like(uuid) TO authenticated;

ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.dm_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.post_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.story_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.comment_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.comment_likes REPLICA IDENTITY FULL;
DO $publication$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'message_reactions', 'dm_reactions', 'post_reactions',
    'story_reactions', 'comment_reactions', 'comment_likes'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
    END IF;
  END LOOP;
END;
$publication$;

NOTIFY pgrst, 'reload schema';

-- Verification
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename IN (
  'message_reactions', 'dm_reactions', 'post_reactions', 'story_reactions',
  'comment_reactions', 'comment_likes'
)
ORDER BY tablename;
SELECT proname, pg_get_function_identity_arguments(oid) AS arguments
FROM pg_proc WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('toggle_message_reaction', 'toggle_dm_reaction',
    'toggle_post_reaction', 'toggle_comment_reaction', 'toggle_story_reaction',
    'toggle_comment_like', 'toggle_like')
ORDER BY proname;

-- Rollback: drop the seven public RPCs, comment_likes, and comment_reactions;
-- restore the prior RLS policies if needed. Keep existing reaction data and
-- the message_reactions scope column unless a reviewed data migration removes it.