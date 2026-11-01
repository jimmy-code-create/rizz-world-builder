-- Super reactions.
--
-- A Purify member can send an emoji as a "super" reaction: it is a real row,
-- so it survives a reload and shows to everyone, and the existing count
-- trigger picks it up with no extra bookkeeping.
--
-- One row per (post, member, emoji) stays the rule — a super reaction replaces
-- that member's normal reaction for the same emoji instead of stacking next to
-- it. That keeps the primary key untouched and makes the toggle simple:
--   no row        -> insert super
--   normal row    -> delete + re-insert as super (RLS has no UPDATE policy)
--   super row     -> delete
-- The Purify check itself lives in the app (VITE_PURIFY_ENFORCED), the same as
-- every other Purify gate; this function only enforces identity and shape.

ALTER TABLE public.post_reactions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'normal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.post_reactions'::regclass
      AND conname = 'post_reactions_kind_check'
  ) THEN
    ALTER TABLE public.post_reactions
      ADD CONSTRAINT post_reactions_kind_check CHECK (kind IN ('normal', 'super'));
  END IF;
END $$;

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
