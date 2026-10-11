-- ============================================================================
-- Fix: chat reaction RPCs are missing from the database.
--
-- Symptom: reacting in DMs failed with
--   "Could not find the function public.toggle_dm_reaction(_emoji, _message_id)
--    in the schema cache"
--
-- Root cause: the reaction RPCs only ever existed in the loose files under
-- `backend-sql/` (10_push.sql, 11_reactions_likes.sql, 12_comment_counts.sql,
-- 13_tts.sql), which live outside `supabase/migrations/` and were never applied
-- to this project. The tables themselves do exist, which is why the app looked
-- half-working.
--
-- This migration creates the chat reaction RPCs the app actually calls, with the
-- exact signature it sends (`_message_id uuid`, `_emoji text`), and repairs the
-- parts of `backend-sql/11_reactions_likes.sql` that no longer match the schema:
--   * that file scoped realm reactions through `messages.channel_id` and
--     `channel_members`, but the realm rename replaced them with `messages.realm_id`
--     and `realm_members`. Verified against `src/integrations/supabase/types.ts`
--     (messages.realm_id: uuid, realm_members(realm_id, user_id, role)).
-- Column types verified: dm_reactions(message_id uuid, user_id uuid, emoji text),
-- direct_messages(sender_id uuid, recipient_id uuid), group_messages(id uuid,
-- group_id uuid, author_id uuid), messages(id uuid, realm_id uuid, sender_id uuid).
--
-- Safe to re-run. No reaction rows are modified by this file.
-- ============================================================================

-- ---------------------------------------------------------------- dm_reactions
-- Unique (message_id, user_id, emoji) is required for the ON CONFLICT toggle.
-- The original primary key already provides it; this only adds one if a future
-- schema change drops it.
DO $$
DECLARE
  v_has_unique boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.dm_reactions'::regclass
      AND c.contype IN ('p', 'u')
      AND (
        SELECT array_agg(a.attname ORDER BY a.attname)
        FROM unnest(c.conkey) AS k
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
      ) = ARRAY['emoji', 'message_id', 'user_id']
  ) INTO v_has_unique;

  IF NOT v_has_unique THEN
    ALTER TABLE public.dm_reactions
      ADD CONSTRAINT dm_reactions_message_user_emoji_key UNIQUE (message_id, user_id, emoji);
  END IF;
END $$;

ALTER TABLE public.dm_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_reactions REPLICA IDENTITY FULL;

-- Only the two people in the conversation may read its reactions. The original
-- policy was `USING (true)`, which exposed every DM reaction to everyone.
DROP POLICY IF EXISTS "dm reactions viewable" ON public.dm_reactions;
DROP POLICY IF EXISTS dm_reactions_select_members ON public.dm_reactions;
CREATE POLICY dm_reactions_select_members ON public.dm_reactions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.direct_messages dm
      WHERE dm.id = message_id
        AND auth.uid() IN (dm.sender_id, dm.recipient_id)
        AND NOT public.is_blocked_pair(dm.sender_id, dm.recipient_id)
    )
  );

-- All writes go through the SECURITY DEFINER RPCs below, so the permissive
-- self-insert / self-delete policies are removed.
DROP POLICY IF EXISTS "users react own dms" ON public.dm_reactions;
DROP POLICY IF EXISTS "users unreact own" ON public.dm_reactions;
DROP POLICY IF EXISTS dm_reactions_insert_self ON public.dm_reactions;
DROP POLICY IF EXISTS dm_reactions_delete_self ON public.dm_reactions;

-- ----------------------------------------------------------- message_reactions
-- One table serves realm, group and DM-scoped message reactions.
ALTER TABLE public.message_reactions
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'channel';

-- The old foreign key pointed every reaction at a realm message id; group and DM
-- reactions need to live in the same table.
ALTER TABLE public.message_reactions DROP CONSTRAINT IF EXISTS message_reactions_message_id_fkey;
ALTER TABLE public.message_reactions DROP CONSTRAINT IF EXISTS message_reactions_pkey;

CREATE UNIQUE INDEX IF NOT EXISTS message_reactions_scoped_unique
  ON public.message_reactions (message_type, message_id, user_id, emoji);

ALTER TABLE public.message_reactions DROP CONSTRAINT IF EXISTS message_reactions_type_check;
ALTER TABLE public.message_reactions
  ADD CONSTRAINT message_reactions_type_check
  CHECK (message_type IN ('channel', 'realm', 'dm', 'group'));

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;

-- Two possible community emojis are <= 16 chars; anything wilder is rejected.
ALTER TABLE public.message_reactions DROP CONSTRAINT IF EXISTS message_reactions_emoji_len_check;
ALTER TABLE public.message_reactions
  ADD CONSTRAINT message_reactions_emoji_len_check
  CHECK (length(emoji) BETWEEN 1 AND 16);

-- Replace the old blanket policy with a conversation-membership policy.
DROP POLICY IF EXISTS "reactions viewable" ON public.message_reactions;
DROP POLICY IF EXISTS "users react as self" ON public.message_reactions;
DROP POLICY IF EXISTS "users unreact self" ON public.message_reactions;
DROP POLICY IF EXISTS message_reactions_member_select ON public.message_reactions;
CREATE POLICY message_reactions_member_select ON public.message_reactions
  FOR SELECT TO authenticated USING (
    CASE message_type
      WHEN 'group' THEN EXISTS (
        SELECT 1 FROM public.group_messages gm
        WHERE gm.id = message_id AND public.is_group_member(gm.group_id, auth.uid())
      )
      WHEN 'dm' THEN EXISTS (
        SELECT 1 FROM public.direct_messages dm
        WHERE dm.id = message_id AND auth.uid() IN (dm.sender_id, dm.recipient_id)
      )
      ELSE EXISTS (
        SELECT 1 FROM public.messages m
        JOIN public.realm_members rm ON rm.realm_id = m.realm_id
        WHERE m.id = message_id AND rm.user_id = auth.uid()
      )
    END
  );

-- ------------------------------------------------------------------ RPC: DMs
-- Signature the app sends: supabase.rpc("toggle_dm_reaction", { _message_id, _emoji })
CREATE OR REPLACE FUNCTION public.toggle_dm_reaction(_message_id uuid, _emoji text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_sender uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to react';
  END IF;
  IF length(coalesce(_emoji, '')) NOT BETWEEN 1 AND 16 THEN
    RAISE EXCEPTION 'Invalid reaction';
  END IF;

  -- Only the two people in this DM conversation may react.
  SELECT dm.sender_id INTO v_sender
  FROM public.direct_messages dm
  WHERE dm.id = _message_id AND auth.uid() IN (dm.sender_id, dm.recipient_id);

  IF NOT FOUND OR public.is_blocked_pair(auth.uid(), v_sender) THEN
    RAISE EXCEPTION 'Message not found or not available to this user';
  END IF;

  -- Toggle: one reaction per (user, emoji) per message.
  IF EXISTS (
    SELECT 1 FROM public.dm_reactions
    WHERE message_id = _message_id AND user_id = auth.uid() AND emoji = _emoji
  ) THEN
    DELETE FROM public.dm_reactions
    WHERE message_id = _message_id AND user_id = auth.uid() AND emoji = _emoji;
  ELSE
    INSERT INTO public.dm_reactions (message_id, user_id, emoji)
    VALUES (_message_id, auth.uid(), _emoji)
    ON CONFLICT (message_id, user_id, emoji) DO NOTHING;
  END IF;

  -- Return the updated reactions for the message.
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
      FROM public.dm_reactions
      WHERE message_id = _message_id
      GROUP BY emoji
    ) grouped
  );
END;
$function$;

-- ------------------------------------------------------- RPC: realm + group
-- Signature the app sends:
--   supabase.rpc("toggle_message_reaction", { _message_id, _emoji, _message_type })
-- _message_type: 'realm' (or legacy 'channel'), 'group', or 'dm'.
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

  IF NOT v_allowed OR public.is_blocked_pair(auth.uid(), v_author) THEN
    RAISE EXCEPTION 'Message not found or not available to this user';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.message_reactions
    WHERE message_type = v_scope AND message_id = _message_id
      AND user_id = auth.uid() AND emoji = _emoji
  ) THEN
    DELETE FROM public.message_reactions
    WHERE message_type = v_scope AND message_id = _message_id
      AND user_id = auth.uid() AND emoji = _emoji;
  ELSE
    INSERT INTO public.message_reactions (message_type, message_id, user_id, emoji)
    VALUES (v_scope, _message_id, auth.uid(), _emoji)
    ON CONFLICT (message_type, message_id, user_id, emoji) DO NOTHING;
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
REVOKE ALL ON FUNCTION public.toggle_dm_reaction(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.toggle_message_reaction(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_dm_reaction(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_message_reaction(uuid, text, text) TO authenticated;

GRANT SELECT ON public.dm_reactions, public.message_reactions TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.dm_reactions, public.message_reactions FROM authenticated, anon;

-- --------------------------------------------------------------- realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'dm_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_reactions;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
