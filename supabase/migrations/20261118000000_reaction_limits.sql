-- Reaction limits.
--
-- The UI caps a person at eight reactions on one message/post and one super
-- reaction on a post. This migration makes those rules true in the database
-- too, so a second client cannot exceed them by calling the table directly.
--
-- Chat reactions live in two tables: message_reactions for realms/groups and
-- dm_reactions for DMs. Both get the same eight-emoji ceiling. Post reactions
-- share post_reactions, where the ceiling counts every row (normal and super)
-- and the partial unique index allows at most one super per person per post.

-- ---------------------------------------------------------------- chat limits
CREATE OR REPLACE FUNCTION public.enforce_message_reaction_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _used integer;
BEGIN
  -- Bot reactions have no user to limit.
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.message_reactions
    WHERE message_type = NEW.message_type
      AND message_id = NEW.message_id
      AND user_id = NEW.user_id
      AND emoji = NEW.emoji
  ) THEN
    RETURN NEW;
  END IF;

  SELECT count(DISTINCT emoji) INTO _used
  FROM public.message_reactions
  WHERE message_type = NEW.message_type
    AND message_id = NEW.message_id
    AND user_id = NEW.user_id;

  IF _used >= 8 THEN
    RAISE EXCEPTION 'Up to 8 reactions per message';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_message_reaction_limit ON public.message_reactions;
CREATE TRIGGER enforce_message_reaction_limit
  BEFORE INSERT ON public.message_reactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_message_reaction_limit();

CREATE OR REPLACE FUNCTION public.enforce_dm_reaction_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _used integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.dm_reactions
    WHERE message_id = NEW.message_id
      AND user_id = NEW.user_id
      AND emoji = NEW.emoji
  ) THEN
    RETURN NEW;
  END IF;

  SELECT count(DISTINCT emoji) INTO _used
  FROM public.dm_reactions
  WHERE message_id = NEW.message_id
    AND user_id = NEW.user_id;

  IF _used >= 8 THEN
    RAISE EXCEPTION 'Up to 8 reactions per message';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_dm_reaction_limit ON public.dm_reactions;
CREATE TRIGGER enforce_dm_reaction_limit
  BEFORE INSERT ON public.dm_reactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_dm_reaction_limit();

-- --------------------------------------------------------------- post limits
CREATE OR REPLACE FUNCTION public.enforce_post_reaction_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _used integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.post_reactions
    WHERE post_id = NEW.post_id
      AND user_id = NEW.user_id
      AND emoji = NEW.emoji
  ) THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO _used
  FROM public.post_reactions
  WHERE post_id = NEW.post_id
    AND user_id = NEW.user_id;

  IF _used >= 8 THEN
    RAISE EXCEPTION 'Up to 8 reactions per post';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_post_reaction_limit ON public.post_reactions;
CREATE TRIGGER enforce_post_reaction_limit
  BEFORE INSERT ON public.post_reactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_post_reaction_limit();

-- Older data may already contain more than one super per person on a post.
-- Keep the newest and clear the rest before adding the uniqueness rule.
WITH ranked AS (
  SELECT ctid,
         row_number() OVER (
           PARTITION BY post_id, user_id
           ORDER BY created_at DESC NULLS LAST
         ) AS position
  FROM public.post_reactions
  WHERE kind = 'super'
)
DELETE FROM public.post_reactions p
USING ranked r
WHERE p.ctid = r.ctid
  AND r.position > 1;

DROP INDEX IF EXISTS public.post_reactions_one_super_per_user;
CREATE UNIQUE INDEX post_reactions_one_super_per_user
  ON public.post_reactions (post_id, user_id)
  WHERE kind = 'super';

-- Moving a super to another emoji replaces it instead of adding a second row.
-- Picking the same emoji again still removes it.
CREATE OR REPLACE FUNCTION public.toggle_post_super_reaction(_post_id uuid, _emoji text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _kind text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to react';
  END IF;
  IF _emoji IS NULL OR length(_emoji) = 0 OR length(_emoji) > 64 THEN
    RAISE EXCEPTION 'That reaction is not valid';
  END IF;

  SELECT kind INTO _kind
    FROM public.post_reactions
   WHERE post_id = _post_id AND user_id = _uid AND emoji = _emoji;

  IF _kind = 'super' THEN
    DELETE FROM public.post_reactions
     WHERE post_id = _post_id AND user_id = _uid AND emoji = _emoji;
    RETURN false;
  END IF;

  -- One super at a time: another emoji's super gives way to this pick.
  DELETE FROM public.post_reactions
   WHERE post_id = _post_id AND user_id = _uid AND kind = 'super';

  IF _kind = 'normal' THEN
    DELETE FROM public.post_reactions
     WHERE post_id = _post_id AND user_id = _uid AND emoji = _emoji;
  END IF;

  INSERT INTO public.post_reactions (post_id, user_id, emoji, kind)
  VALUES (_post_id, _uid, _emoji, 'super');

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_post_super_reaction(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_post_super_reaction(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
