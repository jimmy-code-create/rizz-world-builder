-- ============================================================================
-- Polls in DMs and groups.
--
-- Realm polls already existed (`realm_polls` + `realm_poll_votes`, created in
-- 20261015030000_phase5_features.sql) but they are scoped by `realm_id`, which
-- a DM or a group does not have. This file adds the same idea for the two
-- private chat surfaces:
--
--   * `direct_messages` and `group_messages` gain a nullable `card` payload, so
--     a poll renders instantly from the message itself (the realm chat has
--     worked this way since Phase 5);
--   * `chat_polls` names its target explicitly — a group, or the two people in
--     a DM — and `chat_poll_votes` holds one row per option picked;
--   * two RPCs own every write, re-checking membership, blocks and the closing
--     time. Clients never insert a poll or a vote directly.
--
-- Additive only: no column is dropped or renamed, and re-running is safe.
-- ============================================================================

-- ------------------------------------------- 1. messages can carry a card
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS card jsonb;
ALTER TABLE public.group_messages  ADD COLUMN IF NOT EXISTS card jsonb;

-- ------------------------------------------------------------- 2. the poll
CREATE TABLE IF NOT EXISTS public.chat_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('dm', 'group')),
  -- Exactly one target: a group, or the two people in a DM.
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  dm_a uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  dm_b uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Points into `direct_messages` or `group_messages` depending on `kind`;
  -- there is no single table to point a foreign key at.
  message_id uuid NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL,
  multi boolean NOT NULL DEFAULT false,
  closes_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_polls_target_check CHECK (
    (kind = 'dm' AND group_id IS NULL AND dm_a IS NOT NULL AND dm_b IS NOT NULL AND dm_a <> dm_b)
    OR
    (kind = 'group' AND group_id IS NOT NULL AND dm_a IS NULL AND dm_b IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_polls_message_unique
  ON public.chat_polls (message_id);
CREATE INDEX IF NOT EXISTS idx_chat_polls_group
  ON public.chat_polls (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_polls_dm
  ON public.chat_polls (dm_a, dm_b, created_at DESC);

CREATE TABLE IF NOT EXISTS public.chat_poll_votes (
  poll_id uuid NOT NULL REFERENCES public.chat_polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  option_index integer NOT NULL CHECK (option_index >= 0 AND option_index < 40),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id, option_index)
);

CREATE INDEX IF NOT EXISTS idx_chat_poll_votes_poll
  ON public.chat_poll_votes (poll_id);

-- ------------------------------------------------------------ 3. who reads
ALTER TABLE public.chat_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_polls_read ON public.chat_polls;
CREATE POLICY chat_polls_read ON public.chat_polls
  FOR SELECT TO authenticated
  USING (
    (kind = 'dm' AND auth.uid() IN (dm_a, dm_b))
    OR (kind = 'group' AND public.is_group_member(group_id, auth.uid()))
  );

DROP POLICY IF EXISTS chat_poll_votes_read ON public.chat_poll_votes;
CREATE POLICY chat_poll_votes_read ON public.chat_poll_votes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_polls p
      WHERE p.id = poll_id
        AND (
          (p.kind = 'dm' AND auth.uid() IN (p.dm_a, p.dm_b))
          OR (p.kind = 'group' AND public.is_group_member(p.group_id, auth.uid()))
        )
    )
  );

-- Writes only ever happen through the RPCs below.
REVOKE ALL ON public.chat_polls FROM PUBLIC, anon;
REVOKE ALL ON public.chat_poll_votes FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.chat_polls FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.chat_poll_votes FROM authenticated;
GRANT SELECT ON public.chat_polls TO authenticated;
GRANT SELECT ON public.chat_poll_votes TO authenticated;

-- ------------------------------------------------- 4. a poll can be reached
/**
 * Is this poll readable by the caller? Same rules as the RLS policies above,
 * written once so the two RPCs cannot drift from them.
 */
CREATE OR REPLACE FUNCTION public.chat_poll_visible(_poll public.chat_polls)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT CASE
    WHEN _poll.kind = 'dm' THEN auth.uid() IS NOT NULL AND auth.uid() IN (_poll.dm_a, _poll.dm_b)
    WHEN _poll.kind = 'group' THEN public.is_group_member(_poll.group_id, auth.uid())
    ELSE false
  END;
$fn$;

REVOKE ALL ON FUNCTION public.chat_poll_visible(public.chat_polls) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_poll_visible(public.chat_polls) TO authenticated;

-- ------------------------------------------------------- 5. create a poll
/**
 * Creates the poll and its message in one step.
 *
 * `_kind = 'dm'` needs `_other_user` (the peer); `_kind = 'group'` needs
 * `_group_id`. A blocked pair cannot start a poll, which keeps the DM block
 * rule true for this new message type as well.
 */
CREATE OR REPLACE FUNCTION public.create_chat_poll(
  _kind text,
  _group_id uuid,
  _other_user uuid,
  _question text,
  _options jsonb,
  _multi boolean DEFAULT false,
  _minutes integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_kind text := lower(btrim(coalesce(_kind, '')));
  v_question text := btrim(coalesce(_question, ''));
  v_options jsonb := '[]'::jsonb;
  v_closes timestamptz;
  v_poll_id uuid;
  v_message_id uuid;
  v_card jsonb;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to start a poll');
  END IF;
  IF v_kind NOT IN ('dm', 'group') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That chat cannot hold a poll');
  END IF;
  IF char_length(v_question) < 1 OR char_length(v_question) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ask a question first');
  END IF;
  IF jsonb_typeof(_options) IS DISTINCT FROM 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Add at least two options');
  END IF;

  -- Trim, drop blanks, and keep the order the member typed.
  SELECT coalesce(jsonb_agg(opt ORDER BY ord), '[]'::jsonb) INTO v_options
  FROM (
    SELECT btrim(value) AS opt, ord
    FROM jsonb_array_elements_text(_options) WITH ORDINALITY AS t(value, ord)
    WHERE btrim(value) <> ''
  ) cleaned
  WHERE char_length(opt) <= 80;

  IF jsonb_array_length(v_options) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A poll needs at least 2 options');
  END IF;
  IF jsonb_array_length(v_options) > 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A poll takes at most 6 options');
  END IF;
  IF (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(v_options)) <> jsonb_array_length(v_options) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Give each option different wording');
  END IF;

  IF coalesce(_minutes, 0) > 0 THEN
    v_closes := now() + make_interval(mins => least(_minutes, 20160));
  END IF;

  IF v_kind = 'dm' THEN
    IF _other_user IS NULL OR _other_user = v_user THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Pick who you are asking');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _other_user) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'That account no longer exists');
    END IF;
    IF public.is_blocked_pair(v_user, _other_user) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'You cannot message this account');
    END IF;

    INSERT INTO public.direct_messages (sender_id, recipient_id, body)
    VALUES (v_user, _other_user, '📊 ' || left(v_question, 180))
    RETURNING id INTO v_message_id;

    INSERT INTO public.chat_polls (kind, dm_a, dm_b, message_id, created_by, question, options, multi, closes_at)
    VALUES ('dm', least(v_user, _other_user), greatest(v_user, _other_user), v_message_id, v_user, v_question, v_options, coalesce(_multi, false), v_closes)
    RETURNING id INTO v_poll_id;
  ELSE
    IF _group_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Pick a group first');
    END IF;
    IF NOT public.is_group_member(_group_id, v_user) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Join this group to start a poll');
    END IF;

    INSERT INTO public.group_messages (group_id, author_id, body)
    VALUES (_group_id, v_user, '📊 ' || left(v_question, 180))
    RETURNING id INTO v_message_id;

    INSERT INTO public.chat_polls (kind, group_id, message_id, created_by, question, options, multi, closes_at)
    VALUES ('group', _group_id, v_message_id, v_user, v_question, v_options, coalesce(_multi, false), v_closes)
    RETURNING id INTO v_poll_id;
  END IF;

  -- The card is what the transcript renders; it is written after the poll row
  -- exists so it can name it.
  v_card := jsonb_build_object(
    'type', 'poll',
    'pollId', v_poll_id,
    'question', v_question,
    'options', v_options,
    'multi', coalesce(_multi, false),
    'closesAt', v_closes
  );

  IF v_kind = 'dm' THEN
    UPDATE public.direct_messages SET card = v_card WHERE id = v_message_id;
  ELSE
    UPDATE public.group_messages SET card = v_card WHERE id = v_message_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'poll_id', v_poll_id, 'message_id', v_message_id);
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_chat_poll(text, uuid, uuid, text, jsonb, boolean, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_chat_poll(text, uuid, uuid, text, jsonb, boolean, integer) TO authenticated;

-- --------------------------------------------------------- 6. cast a vote
/**
 * Casts (or clears) one vote. Single-choice polls replace the previous vote;
 * multi-choice polls toggle the chosen option. Blocks, membership and the
 * closing time are re-checked here, not trusted from the client.
 */
CREATE OR REPLACE FUNCTION public.vote_chat_poll(_poll_id uuid, _option integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_poll public.chat_polls%ROWTYPE;
  v_mine boolean;
  v_count integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to vote');
  END IF;
  SELECT * INTO v_poll FROM public.chat_polls WHERE id = _poll_id;
  IF v_poll.id IS NULL OR NOT public.chat_poll_visible(v_poll) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That poll no longer exists');
  END IF;
  IF v_poll.kind = 'dm' AND public.is_blocked_pair(v_poll.dm_a, v_poll.dm_b) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot reply to this conversation');
  END IF;
  IF v_poll.closes_at IS NOT NULL AND v_poll.closes_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This poll has closed');
  END IF;
  IF _option IS NULL OR _option < 0 OR _option >= jsonb_array_length(v_poll.options) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pick one of the options');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.chat_poll_votes
    WHERE poll_id = v_poll.id AND user_id = v_user AND option_index = _option
  ) INTO v_mine;

  IF v_poll.multi THEN
    IF v_mine THEN
      DELETE FROM public.chat_poll_votes
      WHERE poll_id = v_poll.id AND user_id = v_user AND option_index = _option;
    ELSE
      INSERT INTO public.chat_poll_votes (poll_id, user_id, option_index)
      VALUES (v_poll.id, v_user, _option)
      ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    DELETE FROM public.chat_poll_votes WHERE poll_id = v_poll.id AND user_id = v_user;
    INSERT INTO public.chat_poll_votes (poll_id, user_id, option_index)
    VALUES (v_poll.id, v_user, _option)
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT count(*) INTO v_count FROM public.chat_poll_votes WHERE poll_id = v_poll.id;
  RETURN jsonb_build_object('ok', true, 'poll_id', v_poll.id, 'votes', v_count);
END;
$fn$;

REVOKE ALL ON FUNCTION public.vote_chat_poll(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vote_chat_poll(uuid, integer) TO authenticated;

-- ------------------------------------------------------------ 7. realtime
-- Live tallies need the vote rows streamed, and a closed poll needs its row.
DO $pub$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['chat_polls', 'chat_poll_votes'] LOOP
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN undefined_table THEN NULL;
      END;
    END LOOP;
  END IF;
END
$pub$;
