-- ============================================================================
-- Fix: "Couldn't react, try again" on every realm (and group) reaction.
--
-- Root cause, reproduced against a real Postgres:
--
--   20261014000000_realm_bots.sql replaced the plain unique index
--     message_reactions_scoped_unique (message_type, message_id, user_id, emoji)
--   with two PARTIAL indexes:
--     message_reactions_user_unique ... WHERE user_id IS NOT NULL
--     message_reactions_bot_unique  ... WHERE bot_id   IS NOT NULL
--
--   toggle_message_reaction() still inserts with
--     ON CONFLICT (message_type, message_id, user_id, emoji) DO NOTHING
--   and Postgres only accepts a partial index as that arbiter when the conflict
--   target repeats the index predicate. Without it every add fails at execution
--   with:
--     ERROR 42P10: there is no unique or exclusion constraint matching the
--     ON CONFLICT specification
--
--   PostgREST surfaces that 42P10 as a 400 on the RPC call, and the app showed
--   its friendly "Couldn't react, try again" toast. Removing a reaction (the
--   DELETE branch) never reached the broken INSERT, and DM reactions stayed
--   healthy because dm_reactions uses a plain, non-partial unique constraint —
--   which is why only realms looked broken.
--
-- This migration:
--   1. re-asserts both partial actor indexes (IF NOT EXISTS, so it also
--      repairs a database where 20261014000000 only half-applied),
--   2. recreates toggle_message_reaction() with a conflict target that matches
--      the human index exactly,
--   3. makes bot and system messages explicitly reactable: a NULL author is
--      never "blocked", so reacting to them cannot fail on the block check.
--
-- Safe to re-run. No rows are deleted or rewritten.
-- ============================================================================

-- ------------------------- the two actor indexes the toggle inserts against
CREATE UNIQUE INDEX IF NOT EXISTS message_reactions_user_unique
  ON public.message_reactions (message_type, message_id, user_id, emoji)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS message_reactions_bot_unique
  ON public.message_reactions (message_type, message_id, bot_id, emoji)
  WHERE bot_id IS NOT NULL;

-- ------------------------------------------- RPC: realm + group (+ dm scope)
CREATE OR REPLACE FUNCTION public.toggle_message_reaction(
  _message_id uuid,
  _emoji text,
  _message_type text DEFAULT 'realm'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_author uuid;
  v_allowed boolean := false;
  v_scope text := CASE WHEN _message_type = 'channel' THEN 'realm' ELSE coalesce(_message_type, 'realm') END;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to react';
  END IF;
  IF length(coalesce(_emoji, '')) NOT BETWEEN 1 AND 16 THEN
    RAISE EXCEPTION 'Invalid reaction';
  END IF;
  IF v_scope NOT IN ('realm', 'group', 'dm') THEN
    RAISE EXCEPTION 'Invalid reaction scope';
  END IF;

  IF v_scope = 'realm' THEN
    -- Realm membership is realm_members (the old channel_members table is gone).
    SELECT m.sender_id INTO v_author
    FROM public.messages m
    JOIN public.realm_members rm ON rm.realm_id = m.realm_id AND rm.user_id = auth.uid()
    WHERE m.id = _message_id;
    v_allowed := FOUND;
  ELSIF v_scope = 'group' THEN
    SELECT gm.author_id INTO v_author
    FROM public.group_messages gm
    WHERE gm.id = _message_id AND public.is_group_member(gm.group_id, auth.uid());
    v_allowed := FOUND;
  ELSE
    SELECT dm.sender_id INTO v_author
    FROM public.direct_messages dm
    WHERE dm.id = _message_id AND auth.uid() IN (dm.sender_id, dm.recipient_id);
    v_allowed := FOUND;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Message not found or not available to this user';
  END IF;

  -- Bot and system messages have no human author: there is nobody to block and
  -- they must be reactable like any other message. `is_blocked_pair` also has
  -- to stay untouched for real authors.
  IF v_author IS NOT NULL AND public.is_blocked_pair(auth.uid(), v_author) THEN
    RAISE EXCEPTION 'Reactions are not available for this message';
  END IF;

  -- Add acts as a toggle: an existing (message, user, emoji) row is removed.
  IF EXISTS (
    SELECT 1 FROM public.message_reactions
    WHERE message_type = v_scope AND message_id = _message_id
      AND user_id = auth.uid() AND emoji = _emoji
  ) THEN
    DELETE FROM public.message_reactions
    WHERE message_type = v_scope AND message_id = _message_id
      AND user_id = auth.uid() AND emoji = _emoji;
  ELSE
    -- The conflict target repeats the partial index's predicate; that, and not
    -- a different index, is what fixes the 42P10 error.
    INSERT INTO public.message_reactions (message_type, message_id, user_id, emoji)
    VALUES (v_scope, _message_id, auth.uid(), _emoji)
    ON CONFLICT (message_type, message_id, user_id, emoji) WHERE user_id IS NOT NULL DO NOTHING;
  END IF;

  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'emoji', grouped.emoji,
      'count', grouped.reaction_count,
      'mine', grouped.mine
    ) ORDER BY grouped.emoji), '[]'::jsonb)
    FROM (
      SELECT emoji,
        count(*)::integer AS reaction_count,
        bool_or(user_id = auth.uid()) AS mine
      FROM public.message_reactions
      WHERE message_type = v_scope AND message_id = _message_id
      GROUP BY emoji
    ) grouped
  );
END;
$function$;

-- ------------------------------------------------------------------- grants
REVOKE ALL ON FUNCTION public.toggle_message_reaction(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_message_reaction(uuid, text, text) TO authenticated;

GRANT SELECT ON public.message_reactions TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.message_reactions FROM authenticated, anon;

NOTIFY pgrst, 'reload schema';
