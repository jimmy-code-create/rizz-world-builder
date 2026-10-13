-- ============================================================
-- PHASE 5: polls, threads, scheduled messages, custom emoji and
--          stickers, reaction roles, XP/levels, message search,
--          bot ratings, the welcome bot and the music bot.
-- Additive migration. No table is dropped or renamed.
-- ============================================================

-- ---------------------------------------------- 0. messages extras
-- `card` is the shared rich-payload column: a poll, a track, anything that
-- needs more than text. `thread_root`/`parent_id` make a thread out of the
-- existing messages table instead of adding a second message store.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS card jsonb,
  ADD COLUMN IF NOT EXISTS thread_root uuid,
  ADD COLUMN IF NOT EXISTS parent_id uuid,
  ADD COLUMN IF NOT EXISTS reply_count integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_thread_root_fkey'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_thread_root_fkey
      FOREIGN KEY (thread_root) REFERENCES public.messages(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_parent_id_fkey'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_parent_id_fkey
      FOREIGN KEY (parent_id) REFERENCES public.messages(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_thread_root
  ON public.messages (thread_root) WHERE thread_root IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_realm_created
  ON public.messages (realm_id, created_at DESC);

/** Keeps the root message's reply counter honest on both edges. */
CREATE OR REPLACE FUNCTION public.messages_thread_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.thread_root IS NOT NULL AND NEW.thread_root <> NEW.id THEN
    UPDATE public.messages SET reply_count = reply_count + 1 WHERE id = NEW.thread_root;
  ELSIF TG_OP = 'DELETE' AND OLD.thread_root IS NOT NULL THEN
    UPDATE public.messages SET reply_count = greatest(reply_count - 1, 0) WHERE id = OLD.thread_root;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$fn$;

DROP TRIGGER IF EXISTS messages_thread_count_t ON public.messages;
CREATE TRIGGER messages_thread_count_t
  AFTER INSERT OR DELETE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_thread_count();

REVOKE ALL ON FUNCTION public.messages_thread_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.messages_thread_count() TO authenticated;

-- --------------------------------------------------------- 1. polls
CREATE TABLE IF NOT EXISTS public.realm_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES public.realms(id) ON DELETE CASCADE,
  realm_room_id uuid REFERENCES public.realm_rooms(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL,
  multi boolean NOT NULL DEFAULT false,
  closes_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_realm_polls_realm ON public.realm_polls (realm_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_realm_polls_message ON public.realm_polls (message_id);

CREATE TABLE IF NOT EXISTS public.realm_poll_votes (
  poll_id uuid NOT NULL REFERENCES public.realm_polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  option_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id, option_index)
);

ALTER TABLE public.realm_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realm_poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS realm_polls_read ON public.realm_polls;
CREATE POLICY realm_polls_read ON public.realm_polls
  FOR SELECT TO authenticated
  USING (public.can_read_realm(realm_id));

DROP POLICY IF EXISTS realm_poll_votes_read ON public.realm_poll_votes;
CREATE POLICY realm_poll_votes_read ON public.realm_poll_votes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.realm_polls p
      WHERE p.id = poll_id AND public.can_read_realm(p.realm_id)
    )
  );

-- Writes only ever happen through the RPCs below.
REVOKE ALL ON public.realm_polls FROM PUBLIC, anon;
REVOKE ALL ON public.realm_poll_votes FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.realm_polls FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.realm_poll_votes FROM authenticated;
GRANT SELECT ON public.realm_polls TO authenticated;
GRANT SELECT ON public.realm_poll_votes TO authenticated;

/**
 * Creates a poll and its message in one step.
 *
 * The question is everything before the first `|`, the options are what
 * follows: `/poll Pizza tonight? | Yes | No | Only if it is free`.
 */
CREATE OR REPLACE FUNCTION public.create_realm_poll(
  _realm_id uuid,
  _realm_room_id uuid,
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
  v_question text := btrim(coalesce(_question, ''));
  v_options jsonb := '[]'::jsonb;
  v_item text;
  v_poll_id uuid;
  v_message_id uuid;
  v_closes timestamptz;
  v_room_ok boolean;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to start a poll');
  END IF;
  IF NOT public.is_realm_member(_realm_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Join this realm to start a poll');
  END IF;
  IF _realm_room_id IS NOT NULL THEN
    SELECT (r.kind <> 'voice') INTO v_room_ok
    FROM public.realm_rooms r WHERE r.id = _realm_room_id AND r.realm_id = _realm_id;
    IF coalesce(v_room_ok, false) IS NOT TRUE THEN
      RETURN jsonb_build_object('ok', false, 'error', 'That is not a text channel of this realm');
    END IF;
  END IF;
  IF NOT public.channel_write_allowed(_realm_id, _realm_room_id, v_user) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A moderator turned off writing here for you');
  END IF;
  IF char_length(v_question) < 1 OR char_length(v_question) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ask a question of 1 to 200 characters');
  END IF;

  IF jsonb_typeof(_options) <> 'array' OR jsonb_array_length(_options) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A poll needs at least two options');
  END IF;
  IF jsonb_array_length(_options) > 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A poll can have at most six options');
  END IF;
  -- Rebuild the option list so every entry is trimmed, and reject blanks.
  v_options := '[]'::jsonb;
  FOR v_item IN SELECT jsonb_array_elements_text(_options) LOOP
    v_item := btrim(v_item);
    IF char_length(v_item) < 1 OR char_length(v_item) > 60 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Options must be 1 to 60 characters each');
    END IF;
    v_options := v_options || jsonb_build_array(v_item);
  END LOOP;
  IF (SELECT count(DISTINCT t.value) FROM jsonb_array_elements_text(v_options) AS t(value))
     <> jsonb_array_length(v_options) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Give each option different wording');
  END IF;

  IF coalesce(_minutes, 0) > 0 THEN
    v_closes := now() + make_interval(mins => least(_minutes, 20160));
  END IF;

  INSERT INTO public.realm_polls (realm_id, realm_room_id, created_by, question, options, multi, closes_at)
  VALUES (_realm_id, _realm_room_id, v_user, v_question, v_options, coalesce(_multi, false), v_closes)
  RETURNING id INTO v_poll_id;

  INSERT INTO public.messages (realm_id, realm_room_id, sender_id, body, card)
  VALUES (
    _realm_id,
    _realm_room_id,
    v_user,
    '📊 ' || left(v_question, 180),
    jsonb_build_object(
      'type', 'poll',
      'pollId', v_poll_id,
      'question', v_question,
      'options', v_options,
      'multi', coalesce(_multi, false),
      'closesAt', v_closes
    )
  )
  RETURNING id INTO v_message_id;

  UPDATE public.realm_polls SET message_id = v_message_id WHERE id = v_poll_id;

  RETURN jsonb_build_object('ok', true, 'poll_id', v_poll_id, 'message_id', v_message_id);
END;
$fn$;

/**
 * Casts (or clears) one vote. Single-choice polls replace the previous vote;
 * multi-choice polls toggle the chosen option.
 */
CREATE OR REPLACE FUNCTION public.vote_realm_poll(_poll_id uuid, _option integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_poll public.realm_polls%ROWTYPE;
  v_mine boolean;
  v_count integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to vote');
  END IF;
  SELECT * INTO v_poll FROM public.realm_polls WHERE id = _poll_id;
  IF v_poll.id IS NULL OR NOT public.can_read_realm(v_poll.realm_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That poll no longer exists');
  END IF;
  IF NOT public.is_realm_member(v_poll.realm_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Join this realm to vote');
  END IF;
  IF v_poll.closes_at IS NOT NULL AND v_poll.closes_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This poll has closed');
  END IF;
  IF _option IS NULL OR _option < 0 OR _option >= jsonb_array_length(v_poll.options) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pick one of the options');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.realm_poll_votes
    WHERE poll_id = v_poll.id AND user_id = v_user AND option_index = _option
  ) INTO v_mine;

  IF v_poll.multi THEN
    IF v_mine THEN
      DELETE FROM public.realm_poll_votes
      WHERE poll_id = v_poll.id AND user_id = v_user AND option_index = _option;
    ELSE
      INSERT INTO public.realm_poll_votes (poll_id, user_id, option_index)
      VALUES (v_poll.id, v_user, _option)
      ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    DELETE FROM public.realm_poll_votes WHERE poll_id = v_poll.id AND user_id = v_user;
    INSERT INTO public.realm_poll_votes (poll_id, user_id, option_index)
    VALUES (v_poll.id, v_user, _option)
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT count(*) INTO v_count FROM public.realm_poll_votes WHERE poll_id = v_poll.id;
  RETURN jsonb_build_object('ok', true, 'poll_id', v_poll.id, 'votes', v_count);
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_realm_poll(uuid, uuid, text, jsonb, boolean, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vote_realm_poll(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_realm_poll(uuid, uuid, text, jsonb, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vote_realm_poll(uuid, integer) TO authenticated;

-- ---------------------------------------- 2. scheduled messages
CREATE TABLE IF NOT EXISTS public.realm_scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES public.realms(id) ON DELETE CASCADE,
  realm_room_id uuid REFERENCES public.realm_rooms(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sent_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.realm_scheduled_messages DROP CONSTRAINT IF EXISTS realm_scheduled_status_check;
  ALTER TABLE public.realm_scheduled_messages
    ADD CONSTRAINT realm_scheduled_status_check
    CHECK (status IN ('pending', 'sent', 'cancelled', 'failed'));
END $$;

CREATE INDEX IF NOT EXISTS idx_realm_scheduled_due
  ON public.realm_scheduled_messages (scheduled_for)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_realm_scheduled_realm
  ON public.realm_scheduled_messages (realm_id, realm_room_id);

ALTER TABLE public.realm_scheduled_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS realm_scheduled_read ON public.realm_scheduled_messages;
CREATE POLICY realm_scheduled_read ON public.realm_scheduled_messages
  FOR SELECT TO authenticated
  USING (
    public.can_read_realm(realm_id)
    AND (
      created_by = auth.uid()
      OR public.realm_can(realm_id, auth.uid(), 'moderate_messages')
    )
  );

REVOKE ALL ON public.realm_scheduled_messages FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.realm_scheduled_messages FROM authenticated;
GRANT SELECT ON public.realm_scheduled_messages TO authenticated;

CREATE OR REPLACE FUNCTION public.schedule_realm_message(
  _realm_id uuid,
  _realm_room_id uuid,
  _body text,
  _scheduled_for timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_body text := btrim(coalesce(_body, ''));
  v_room_ok boolean;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to schedule a message');
  END IF;
  IF NOT public.is_realm_member(_realm_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Join this realm first');
  END IF;
  IF _realm_room_id IS NOT NULL THEN
    SELECT (r.kind <> 'voice') INTO v_room_ok
    FROM public.realm_rooms r WHERE r.id = _realm_room_id AND r.realm_id = _realm_id;
    IF coalesce(v_room_ok, false) IS NOT TRUE THEN
      RETURN jsonb_build_object('ok', false, 'error', 'That is not a text channel of this realm');
    END IF;
  END IF;
  IF NOT public.channel_write_allowed(_realm_id, _realm_room_id, v_user) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A moderator turned off writing here for you');
  END IF;
  IF char_length(v_body) < 1 OR char_length(v_body) > 500 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Messages are limited to 500 characters');
  END IF;
  IF _scheduled_for IS NULL OR _scheduled_for < now() + interval '1 minute' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pick a time at least a minute from now');
  END IF;
  IF _scheduled_for > now() + interval '30 days' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Messages can be scheduled up to 30 days ahead');
  END IF;

  INSERT INTO public.realm_scheduled_messages (realm_id, realm_room_id, created_by, body, scheduled_for)
  VALUES (_realm_id, _realm_room_id, v_user, v_body, _scheduled_for)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'scheduled_for', _scheduled_for);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.cancel_realm_message(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_row public.realm_scheduled_messages%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in first');
  END IF;
  SELECT * INTO v_row FROM public.realm_scheduled_messages WHERE id = _id;
  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That scheduled message no longer exists');
  END IF;
  IF v_row.created_by <> v_user AND NOT public.realm_can(v_row.realm_id, v_user, 'moderate_messages') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only the author or a moderator can cancel it');
  END IF;
  IF v_row.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That message has already been dealt with');
  END IF;

  UPDATE public.realm_scheduled_messages SET status = 'cancelled' WHERE id = _id;
  RETURN jsonb_build_object('ok', true);
END;
$fn$;

/**
 * Sends everything that is due. There is no cron here: the app calls this
 * opportunistically (same pattern as end_stale_voice_rooms), so a scheduled
 * message still lands as soon as anyone with the app open looks at the realm.
 */
CREATE OR REPLACE FUNCTION public.send_due_scheduled_messages(_limit integer DEFAULT 25)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_row public.realm_scheduled_messages%ROWTYPE;
  v_sent integer := 0;
  v_message uuid;
BEGIN
  FOR v_row IN
    SELECT * FROM public.realm_scheduled_messages
    WHERE status = 'pending' AND scheduled_for <= now()
    ORDER BY scheduled_for
    LIMIT greatest(coalesce(_limit, 25), 1)
  LOOP
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM public.realm_members m
        WHERE m.realm_id = v_row.realm_id AND m.user_id = v_row.created_by
      ) THEN
        UPDATE public.realm_scheduled_messages SET status = 'cancelled' WHERE id = v_row.id;
        CONTINUE;
      END IF;
      IF NOT public.channel_write_allowed(v_row.realm_id, v_row.realm_room_id, v_row.created_by) THEN
        UPDATE public.realm_scheduled_messages SET status = 'failed' WHERE id = v_row.id;
        CONTINUE;
      END IF;

      INSERT INTO public.messages (realm_id, realm_room_id, sender_id, body)
      VALUES (v_row.realm_id, v_row.realm_room_id, v_row.created_by, v_row.body)
      RETURNING id INTO v_message;

      UPDATE public.realm_scheduled_messages
      SET status = 'sent', sent_message_id = v_message
      WHERE id = v_row.id;
      v_sent := v_sent + 1;
    EXCEPTION WHEN OTHERS THEN
      -- One poisoned row must not stop the rest of the batch.
      UPDATE public.realm_scheduled_messages SET status = 'failed' WHERE id = v_row.id;
    END;
  END LOOP;
  RETURN v_sent;
END;
$fn$;

REVOKE ALL ON FUNCTION public.schedule_realm_message(uuid, uuid, text, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_realm_message(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_due_scheduled_messages(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_realm_message(uuid, uuid, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_realm_message(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_due_scheduled_messages(integer) TO authenticated, anon;

-- --------------------------------------- 3. custom emoji & stickers
CREATE TABLE IF NOT EXISTS public.realm_custom_emoji (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES public.realms(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  kind text NOT NULL DEFAULT 'emoji',
  created_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT realm_custom_emoji_name_check CHECK (name ~ '^[a-z0-9_]{2,32}$'),
  CONSTRAINT realm_custom_emoji_kind_check CHECK (kind IN ('emoji', 'sticker')),
  UNIQUE (realm_id, name)
);

ALTER TABLE public.realm_custom_emoji ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS realm_custom_emoji_read ON public.realm_custom_emoji;
CREATE POLICY realm_custom_emoji_read ON public.realm_custom_emoji
  FOR SELECT TO authenticated
  USING (public.can_read_realm(realm_id));

REVOKE ALL ON public.realm_custom_emoji FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.realm_custom_emoji FROM authenticated;
GRANT SELECT ON public.realm_custom_emoji TO authenticated;

CREATE OR REPLACE FUNCTION public.save_realm_emoji(
  _realm_id uuid,
  _name text,
  _url text,
  _kind text DEFAULT 'emoji'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_name text := lower(btrim(coalesce(_name, '')));
  v_kind text := CASE WHEN _kind = 'sticker' THEN 'sticker' ELSE 'emoji' END;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in first');
  END IF;
  IF NOT public.realm_can_moderate(_realm_id, v_user) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only moderators can add custom emoji');
  END IF;
  IF v_name !~ '^[a-z0-9_]{2,32}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Names use a-z, 0-9 and _ (2 to 32 characters)');
  END IF;
  IF coalesce(_url, '') !~ '^https://' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That image link is not valid');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.realm_custom_emoji WHERE realm_id = _realm_id AND name = v_name
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This realm already has :' || v_name || ':');
  END IF;

  INSERT INTO public.realm_custom_emoji (realm_id, name, url, kind, created_by)
  VALUES (_realm_id, v_name, _url, v_kind, v_user)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'name', v_name, 'kind', v_kind);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.delete_realm_emoji(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_row public.realm_custom_emoji%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in first');
  END IF;
  SELECT * INTO v_row FROM public.realm_custom_emoji WHERE id = _id;
  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', true);
  END IF;
  IF NOT public.realm_can_moderate(v_row.realm_id, v_user) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only moderators can remove custom emoji');
  END IF;
  DELETE FROM public.realm_custom_emoji WHERE id = _id;
  RETURN jsonb_build_object('ok', true);
END;
$fn$;

REVOKE ALL ON FUNCTION public.save_realm_emoji(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_realm_emoji(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_realm_emoji(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_realm_emoji(uuid) TO authenticated;

-- Storage: emoji live in their own public bucket, image types only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('realm-emoji', 'realm-emoji', true, 3145728, ARRAY['image/png', 'image/webp', 'image/jpeg', 'image/gif'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "realm emoji upload to own folder" ON storage.objects;
CREATE POLICY "realm emoji upload to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'realm-emoji'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "realm emoji delete from own folder" ON storage.objects;
CREATE POLICY "realm emoji delete from own folder"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'realm-emoji'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "realm emoji read" ON storage.objects;
CREATE POLICY "realm emoji read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'realm-emoji');

-- ------------------------------------------------ 4. reaction roles
CREATE TABLE IF NOT EXISTS public.realm_reaction_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES public.realms(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  role text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT realm_reaction_roles_role_check CHECK (role IN ('mod', 'member')),
  UNIQUE (realm_id, message_id, emoji)
);

ALTER TABLE public.realm_reaction_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS realm_reaction_roles_read ON public.realm_reaction_roles;
CREATE POLICY realm_reaction_roles_read ON public.realm_reaction_roles
  FOR SELECT TO authenticated
  USING (public.can_read_realm(realm_id));

REVOKE ALL ON public.realm_reaction_roles FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.realm_reaction_roles FROM authenticated;
GRANT SELECT ON public.realm_reaction_roles TO authenticated;

/**
 * Reacting grants the role, un-reacting takes back exactly that role — and
 * never demotes an owner or somebody who already holds a higher one.
 */
CREATE OR REPLACE FUNCTION public.apply_reaction_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_realm uuid;
  v_role text;
  v_actor uuid;
  v_owner uuid;
BEGIN
  v_actor := COALESCE(NEW.user_id, OLD.user_id);
  IF v_actor IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF COALESCE(NEW.message_type, OLD.message_type) IS DISTINCT FROM 'realm' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT m.realm_id, r.owner_id INTO v_realm, v_owner
  FROM public.messages m
  JOIN public.realms r ON r.id = m.realm_id
  WHERE m.id = COALESCE(NEW.message_id, OLD.message_id);

  IF v_realm IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT rr.role INTO v_role
    FROM public.realm_reaction_roles rr
    WHERE rr.realm_id = v_realm AND rr.message_id = NEW.message_id AND rr.emoji = NEW.emoji;

    IF v_role IS NOT NULL AND v_actor <> v_owner THEN
      UPDATE public.realm_members
      SET role = v_role::realm_role
      WHERE realm_id = v_realm
        AND user_id = v_actor
        AND role <> 'owner'
        AND NOT (v_role = 'member' AND role = 'mod')
        AND role IS DISTINCT FROM v_role::realm_role;
    END IF;
  ELSE
    SELECT rr.role INTO v_role
    FROM public.realm_reaction_roles rr
    WHERE rr.realm_id = v_realm AND rr.message_id = OLD.message_id AND rr.emoji = OLD.emoji;

    IF v_role = 'mod' AND v_actor <> v_owner THEN
      UPDATE public.realm_members
      SET role = 'member'
      WHERE realm_id = v_realm AND user_id = v_actor AND role = 'mod';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$fn$;

DROP TRIGGER IF EXISTS apply_reaction_roles_t ON public.message_reactions;
CREATE TRIGGER apply_reaction_roles_t
  AFTER INSERT OR DELETE ON public.message_reactions
  FOR EACH ROW EXECUTE FUNCTION public.apply_reaction_roles();

REVOKE ALL ON FUNCTION public.apply_reaction_roles() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_reaction_roles() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_realm_reaction_role(
  _message_id uuid,
  _emoji text,
  _role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_realm uuid;
  v_emoji text := left(btrim(coalesce(_emoji, '')), 16);
  v_role text := btrim(coalesce(_role, ''));
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in first');
  END IF;
  IF v_role NOT IN ('mod', 'member') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pick the member or the moderator role');
  END IF;
  IF char_length(v_emoji) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pick an emoji');
  END IF;

  SELECT realm_id INTO v_realm FROM public.messages WHERE id = _message_id AND realm_id IS NOT NULL;
  IF v_realm IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That message is not here any more');
  END IF;
  IF NOT public.realm_can_moderate(v_realm, v_user) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only moderators can set reaction roles');
  END IF;

  INSERT INTO public.realm_reaction_roles (realm_id, message_id, emoji, role, created_by)
  VALUES (v_realm, _message_id, v_emoji, v_role, v_user)
  ON CONFLICT (realm_id, message_id, emoji)
  DO UPDATE SET role = EXCLUDED.role, created_by = EXCLUDED.created_by
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.delete_realm_reaction_role(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_row public.realm_reaction_roles%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in first');
  END IF;
  SELECT * INTO v_row FROM public.realm_reaction_roles WHERE id = _id;
  IF v_row.id IS NULL THEN RETURN jsonb_build_object('ok', true); END IF;
  IF NOT public.realm_can_moderate(v_row.realm_id, v_user) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only moderators can change reaction roles');
  END IF;
  DELETE FROM public.realm_reaction_roles WHERE id = _id;
  RETURN jsonb_build_object('ok', true);
END;
$fn$;

REVOKE ALL ON FUNCTION public.set_realm_reaction_role(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_realm_reaction_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_realm_reaction_role(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_realm_reaction_role(uuid) TO authenticated;

-- --------------------------------------------------- 5. XP & levels
ALTER TABLE public.realms
  ADD COLUMN IF NOT EXISTS xp_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS welcome_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS welcome_message text;

CREATE TABLE IF NOT EXISTS public.realm_xp (
  realm_id uuid NOT NULL REFERENCES public.realms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  xp integer NOT NULL DEFAULT 0,
  messages integer NOT NULL DEFAULT 0,
  last_awarded_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (realm_id, user_id)
);

ALTER TABLE public.realm_xp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS realm_xp_read ON public.realm_xp;
CREATE POLICY realm_xp_read ON public.realm_xp
  FOR SELECT TO authenticated
  USING (public.can_read_realm(realm_id));

REVOKE ALL ON public.realm_xp FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.realm_xp FROM authenticated;
GRANT SELECT ON public.realm_xp TO authenticated;

/** Level N needs 50·(N−1)² XP, so level 5 is a real milestone. */
CREATE OR REPLACE FUNCTION public.realm_level_for(_xp integer)
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $fn$ SELECT greatest(1, floor(sqrt(greatest(coalesce(_xp, 0), 0) / 50.0))::int + 1) $fn$;

CREATE OR REPLACE FUNCTION public.realm_xp_award()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF NEW.sender_id IS NULL OR NEW.realm_id IS NULL OR coalesce(NEW.system, false) THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.realms r WHERE r.id = NEW.realm_id AND r.xp_enabled) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.realm_xp (realm_id, user_id, xp, messages, last_awarded_at, updated_at)
  VALUES (NEW.realm_id, NEW.sender_id, 20, 1, now(), now())
  ON CONFLICT (realm_id, user_id) DO UPDATE SET
    xp = CASE
      WHEN public.realm_xp.last_awarded_at IS NULL
        OR public.realm_xp.last_awarded_at < now() - interval '60 seconds'
        THEN public.realm_xp.xp + 20
      ELSE public.realm_xp.xp
    END,
    messages = public.realm_xp.messages + 1,
    last_awarded_at = now(),
    updated_at = now();

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS realm_xp_award_t ON public.messages;
CREATE TRIGGER realm_xp_award_t
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.realm_xp_award();

REVOKE ALL ON FUNCTION public.realm_xp_award() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.realm_xp_award() TO authenticated;
REVOKE ALL ON FUNCTION public.realm_level_for(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.realm_level_for(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.realm_leaderboard(_realm_id uuid, _limit integer DEFAULT 25)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  xp integer,
  messages integer,
  level integer,
  rank integer,
  is_me boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH ranked AS (
    SELECT
      x.user_id AS uid,
      coalesce(p.display_name, p.username, 'Member') AS dn,
      coalesce(p.username, '') AS un,
      p.avatar_url AS av,
      x.xp AS total_xp,
      x.messages AS msg_count,
      public.realm_level_for(x.xp) AS lvl,
      row_number() OVER (ORDER BY x.xp DESC, x.user_id) AS position
    FROM public.realm_xp x
    JOIN public.profiles p ON p.id = x.user_id
    WHERE x.realm_id = _realm_id
  )
  SELECT uid, dn, un, av, total_xp, msg_count, lvl, position::int, (uid = auth.uid())
  FROM ranked
  ORDER BY position
  LIMIT greatest(coalesce(_limit, 25), 1);
$fn$;

CREATE OR REPLACE FUNCTION public.my_realm_xp(_realm_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH ranked AS (
    SELECT x.user_id AS uid, x.xp AS total_xp, x.messages AS msg_count,
           row_number() OVER (ORDER BY x.xp DESC, x.user_id) AS position
    FROM public.realm_xp x
    WHERE x.realm_id = _realm_id
  )
  SELECT coalesce(
    jsonb_build_object(
      'ok', true,
      'xp', r.total_xp,
      'messages', r.msg_count,
      'rank', r.position::int,
      'level', public.realm_level_for(r.total_xp)
    ),
    jsonb_build_object('ok', true, 'xp', 0, 'messages', 0, 'rank', null, 'level', 1)
  )
  FROM ranked r
  WHERE r.uid = auth.uid()
  UNION ALL
  SELECT jsonb_build_object('ok', true, 'xp', 0, 'messages', 0, 'rank', null, 'level', 1)
  WHERE NOT EXISTS (SELECT 1 FROM ranked r2 WHERE r2.uid = auth.uid())
  LIMIT 1;
$fn$;

CREATE OR REPLACE FUNCTION public.set_realm_xp_enabled(_realm_id uuid, _enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in first');
  END IF;
  IF NOT public.realm_can_moderate(_realm_id, auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only moderators can change that');
  END IF;
  UPDATE public.realms SET xp_enabled = coalesce(_enabled, false) WHERE id = _realm_id;
  RETURN jsonb_build_object('ok', true);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.set_realm_welcome(
  _realm_id uuid,
  _enabled boolean,
  _message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in first');
  END IF;
  IF NOT public.realm_can_moderate(_realm_id, auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only moderators can change that');
  END IF;
  UPDATE public.realms
  SET welcome_enabled = coalesce(_enabled, false),
      welcome_message = nullif(left(btrim(coalesce(_message, '')), 300), '')
  WHERE id = _realm_id;
  RETURN jsonb_build_object('ok', true);
END;
$fn$;

REVOKE ALL ON FUNCTION public.realm_leaderboard(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_realm_xp(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_realm_xp_enabled(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_realm_welcome(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.realm_leaderboard(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_realm_xp(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_realm_xp_enabled(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_realm_welcome(uuid, boolean, text) TO authenticated;

-- ------------------------------------------------ 6. message search
/**
 * Searches a realm's messages as the caller: the function is SECURITY DEFINER
 * but re-checks realm access and hides private channels the caller may not see.
 * Thread replies are returned with their root so the UI can jump there.
 */
CREATE OR REPLACE FUNCTION public.search_realm_messages(
  _realm_id uuid,
  _query text,
  _realm_room_id uuid DEFAULT NULL,
  _limit integer DEFAULT 30
)
RETURNS TABLE (
  id uuid,
  realm_room_id uuid,
  room_name text,
  body text,
  card jsonb,
  thread_root uuid,
  reply_count integer,
  created_at timestamptz,
  sender_id uuid,
  author_name text,
  bot_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_term text;
BEGIN
  IF auth.uid() IS NULL OR _realm_id IS NULL THEN RETURN; END IF;
  IF NOT public.can_read_realm(_realm_id) THEN RETURN; END IF;

  v_term := replace(replace(replace(btrim(coalesce(_query, '')), '\', '\\'), '%', '\%'), '_', '\_');
  IF char_length(v_term) < 2 THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.realm_room_id,
    coalesce(rr.name, r.name, 'general'),
    left(coalesce(m.body, ''), 400),
    m.card,
    m.thread_root,
    m.reply_count,
    m.created_at,
    m.sender_id,
    CASE
      WHEN m.sender_id IS NULL THEN coalesce(b.name, 'Bot')
      ELSE coalesce(p.display_name, p.username, 'Member')
    END,
    coalesce(b.name, '')
  FROM public.messages m
  JOIN public.realms r ON r.id = m.realm_id
  LEFT JOIN public.realm_rooms rr ON rr.id = m.realm_room_id
  LEFT JOIN public.profiles p ON p.id = m.sender_id
  LEFT JOIN public.bots b ON b.id = m.bot_id
  WHERE m.realm_id = _realm_id
    AND coalesce(m.body, '') <> ''
    AND (_realm_room_id IS NULL OR m.realm_room_id = _realm_room_id)
    AND (
      m.realm_room_id IS NULL
      OR rr.id IS NULL
      OR NOT rr.is_private
      OR public.realm_can(m.realm_id, auth.uid(), 'view_private_channels')
    )
    AND (
      m.body ILIKE '%' || v_term || '%'
      OR m.card::text ILIKE '%' || v_term || '%'
    )
  ORDER BY m.created_at DESC
  LIMIT least(coalesce(_limit, 30), 50);
END;
$fn$;

REVOKE ALL ON FUNCTION public.search_realm_messages(uuid, text, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_realm_messages(uuid, text, uuid, integer) TO authenticated;

-- -------------------------------------------------- 7. bot ratings
CREATE TABLE IF NOT EXISTS public.bot_ratings (
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating smallint NOT NULL,
  review text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bot_id, user_id),
  CONSTRAINT bot_ratings_rating_check CHECK (rating BETWEEN 1 AND 5)
);

ALTER TABLE public.bot_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bot_ratings_read ON public.bot_ratings;
CREATE POLICY bot_ratings_read ON public.bot_ratings
  FOR SELECT TO authenticated
  USING (true);

REVOKE ALL ON public.bot_ratings FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.bot_ratings FROM authenticated;
GRANT SELECT ON public.bot_ratings TO authenticated;

CREATE OR REPLACE FUNCTION public.rate_bot(
  _bot_id uuid,
  _rating integer,
  _review text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_bot public.bots%ROWTYPE;
  v_review text := nullif(left(btrim(coalesce(_review, '')), 400), '');
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to rate a bot');
  END IF;
  IF _rating IS NULL OR _rating < 1 OR _rating > 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pick between 1 and 5 stars');
  END IF;
  SELECT * INTO v_bot FROM public.bots WHERE id = _bot_id;
  IF v_bot.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That bot no longer exists');
  END IF;
  IF v_bot.owner_id = v_user THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot rate your own bot');
  END IF;

  INSERT INTO public.bot_ratings (bot_id, user_id, rating, review, updated_at)
  VALUES (_bot_id, v_user, _rating::smallint, v_review, now())
  ON CONFLICT (bot_id, user_id)
  DO UPDATE SET rating = EXCLUDED.rating, review = EXCLUDED.review, updated_at = now();

  RETURN jsonb_build_object('ok', true, 'rating', _rating);
END;
$fn$;

REVOKE ALL ON FUNCTION public.rate_bot(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rate_bot(uuid, integer, text) TO authenticated;

/** Directory payload, now with the community rating and your own. */
CREATE OR REPLACE FUNCTION public.bot_directory(_search text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'bot_id', b.id,
        'name', b.name,
        'description', b.description,
        'avatar_url', b.avatar_url,
        'is_builtin', b.is_builtin,
        'owner_id', b.owner_id,
        'installs', (SELECT count(*) FROM public.realm_bot_installs i WHERE i.bot_id = b.id),
        'rating_avg', coalesce((SELECT round(avg(r.rating)::numeric, 1) FROM public.bot_ratings r WHERE r.bot_id = b.id), 0),
        'rating_count', (SELECT count(*) FROM public.bot_ratings r WHERE r.bot_id = b.id),
        'my_rating', (SELECT r.rating FROM public.bot_ratings r WHERE r.bot_id = b.id AND r.user_id = auth.uid()),
        'commands', coalesce(
          (
            SELECT jsonb_agg(
              jsonb_build_object('name', c.name, 'description', c.description)
              ORDER BY c.name
            )
            FROM public.bot_commands c
            WHERE c.bot_id = b.id AND c.enabled_globally
          ),
          '[]'::jsonb
        )
      )
      ORDER BY b.is_builtin DESC, b.name
    ),
    '[]'::jsonb
  )
  FROM public.bots b
  WHERE (b.is_builtin OR b.is_public OR b.owner_id = auth.uid())
    AND (
      coalesce(btrim(coalesce(_search, '')), '') = ''
      OR b.name ILIKE '%' || btrim(_search) || '%'
      OR b.description ILIKE '%' || btrim(_search) || '%'
    );
$function$;

-- ------------------------------------------------- 8. the welcome bot
INSERT INTO public.bots (name, description, owner_id, token_hash, token_prefix, is_builtin, is_public, scopes)
VALUES (
  'WELCOME',
  'Greets every new member in the default channel. Owners can switch it off or write their own greeting line.',
  NULL,
  'builtin:welcome',
  'builtin',
  true,
  true,
  ARRAY['messages.write']::text[]
)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.welcome_new_realm_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_realm public.realms%ROWTYPE;
  v_bot uuid;
  v_room uuid;
  v_name text;
  v_extra text;
  v_body text;
BEGIN
  SELECT * INTO v_realm FROM public.realms WHERE id = NEW.realm_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF NOT coalesce(v_realm.welcome_enabled, true) THEN RETURN NEW; END IF;
  -- The founder does not get a "you joined" message on their own realm.
  IF NEW.user_id = v_realm.owner_id THEN RETURN NEW; END IF;

  SELECT id INTO v_bot FROM public.bots WHERE is_builtin AND name = 'WELCOME';
  IF v_bot IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_room
  FROM public.realm_rooms
  WHERE realm_id = NEW.realm_id AND kind <> 'voice'
  ORDER BY is_default DESC, position ASC, created_at ASC
  LIMIT 1;

  SELECT coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.username), ''), 'a new face')
  INTO v_name
  FROM public.profiles p WHERE p.id = NEW.user_id;

  v_extra := nullif(btrim(coalesce(v_realm.welcome_message, '')), '');
  v_body := '👋 ' || coalesce(v_name, 'A new face') || ' just joined — say hi!';
  IF v_extra IS NOT NULL THEN
    v_body := v_body || E'\n' || v_extra;
  END IF;

  PERFORM public.bot_insert_message(v_bot, NEW.realm_id, v_room, v_body, NULL);
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS welcome_new_realm_member_t ON public.realm_members;
CREATE TRIGGER welcome_new_realm_member_t
  AFTER INSERT ON public.realm_members
  FOR EACH ROW EXECUTE FUNCTION public.welcome_new_realm_member();

REVOKE ALL ON FUNCTION public.welcome_new_realm_member() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.welcome_new_realm_member() TO authenticated;

-- ------------------------------------------------- 9. the music bot
INSERT INTO public.bots (name, description, owner_id, token_hash, token_prefix, is_builtin, is_public, scopes)
VALUES (
  'MUSIC BOT',
  'Queues songs for the channel: /play a title or a link, then check /queue, skip with /skip.',
  NULL,
  'builtin:music',
  'builtin',
  true,
  true,
  ARRAY['messages.write']::text[]
)
ON CONFLICT DO NOTHING;

INSERT INTO public.bot_commands (bot_id, name, description, options, enabled_globally)
SELECT b.id, c.name, c.description, c.options::jsonb, true
FROM public.bots b
CROSS JOIN (VALUES
  ('play', 'Add a song to the channel queue', '[{"name":"track","description":"A song title or a link","type":"string","required":true}]'),
  ('queue', 'Show the next songs in the queue', '[]'),
  ('np', 'What is playing right now', '[]'),
  ('skip', 'Skip the song at the front of the queue', '[]'),
  ('stop', 'Clear the queue', '[]')
) AS c(name, description, options)
WHERE b.is_builtin AND b.name = 'MUSIC BOT'
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.music_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES public.realms(id) ON DELETE CASCADE,
  realm_room_id uuid REFERENCES public.realm_rooms(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  artist text,
  url text,
  artwork_url text,
  preview_url text,
  duration_ms integer,
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT music_queue_status_check CHECK (status IN ('queued', 'played', 'skipped'))
);

CREATE INDEX IF NOT EXISTS idx_music_queue_live
  ON public.music_queue (realm_id, realm_room_id, position)
  WHERE status = 'queued';

ALTER TABLE public.music_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS music_queue_read ON public.music_queue;
CREATE POLICY music_queue_read ON public.music_queue
  FOR SELECT TO authenticated
  USING (public.can_read_realm(realm_id));

REVOKE ALL ON public.music_queue FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.music_queue FROM authenticated;
GRANT SELECT ON public.music_queue TO authenticated;

/**
 * Adds a track to the channel queue and posts the "now queued" card.
 * `_track` carries the resolved metadata (the server route fills it in).
 */
CREATE OR REPLACE FUNCTION public.music_add(
  _realm_id uuid,
  _realm_room_id uuid,
  _track jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_bot uuid;
  v_title text;
  v_artist text;
  v_url text;
  v_artwork text;
  v_preview text;
  v_duration integer;
  v_position integer;
  v_id uuid;
  v_message_id uuid;
  v_room_ok boolean;
  v_queued integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to add a song');
  END IF;
  IF NOT public.is_realm_member(_realm_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Join this realm first');
  END IF;
  IF _realm_room_id IS NOT NULL THEN
    SELECT (r.kind <> 'voice') INTO v_room_ok
    FROM public.realm_rooms r WHERE r.id = _realm_room_id AND r.realm_id = _realm_id;
    IF coalesce(v_room_ok, false) IS NOT TRUE THEN
      RETURN jsonb_build_object('ok', false, 'error', 'That is not a text channel of this realm');
    END IF;
  END IF;

  v_title := left(nullif(btrim(coalesce(_track->>'title', '')), ''), 160);
  IF v_title IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'I need a song title');
  END IF;
  v_artist := left(nullif(btrim(coalesce(_track->>'artist', '')), ''), 160);
  v_url := nullif(btrim(coalesce(_track->>'url', '')), '');
  v_artwork := nullif(btrim(coalesce(_track->>'artwork', '')), '');
  v_preview := nullif(btrim(coalesce(_track->>'preview', '')), '');
  v_duration := nullif((_track->>'duration')::integer, 0);

  SELECT id INTO v_bot FROM public.bots WHERE is_builtin AND name = 'MUSIC BOT';
  IF v_bot IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The music bot is not available');
  END IF;
  IF NOT public.bot_installed_in_realm(_realm_id, v_bot) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Add MUSIC BOT to this realm first');
  END IF;

  SELECT count(*) INTO v_queued
  FROM public.music_queue
  WHERE realm_id = _realm_id
    AND realm_room_id IS NOT DISTINCT FROM _realm_room_id
    AND status = 'queued';
  IF v_queued >= 30 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The queue is full — try /skip first');
  END IF;

  SELECT coalesce(max(position), 0) + 1 INTO v_position
  FROM public.music_queue
  WHERE realm_id = _realm_id
    AND realm_room_id IS NOT DISTINCT FROM _realm_room_id;

  INSERT INTO public.music_queue (
    realm_id, realm_room_id, position, title, artist, url, artwork_url, preview_url, duration_ms, requested_by
  ) VALUES (
    _realm_id, _realm_room_id, v_position, v_title, v_artist, v_url, v_artwork, v_preview, v_duration, v_user
  )
  RETURNING id INTO v_id;

  v_message_id := public.bot_insert_message(
    v_bot,
    _realm_id,
    _realm_room_id,
    '🎵 ' || v_title || CASE WHEN v_artist IS NOT NULL THEN ' — ' || v_artist ELSE '' END ||
      ' (queued #' || v_position || ')',
    jsonb_build_object(
      'type', 'track',
      'queueId', v_id,
      'title', v_title,
      'artist', v_artist,
      'url', v_url,
      'artwork', v_artwork,
      'preview', v_preview,
      'duration', v_duration,
      'position', v_position
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'queue_id', v_id,
    'message_id', v_message_id,
    'position', v_position
  );
END;
$fn$;

/** Everything except /play, which needs the server-side search. */
CREATE OR REPLACE FUNCTION public.run_music_bot_command(
  _command text,
  _args text,
  _realm_id uuid,
  _realm_room_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_bot uuid;
  v_name text := lower(btrim(coalesce(_command, '')));
  v_body text;
  v_room_ok boolean;
  v_count integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to use bot commands');
  END IF;
  IF _realm_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Slash commands only work inside a realm');
  END IF;
  IF NOT public.is_realm_member(_realm_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Join this realm to use its bot commands');
  END IF;
  IF _realm_room_id IS NOT NULL THEN
    SELECT (r.kind <> 'voice') INTO v_room_ok
    FROM public.realm_rooms r WHERE r.id = _realm_room_id AND r.realm_id = _realm_id;
    IF coalesce(v_room_ok, false) IS NOT TRUE THEN
      RETURN jsonb_build_object('ok', false, 'error', 'That is not a text channel of this realm');
    END IF;
  END IF;

  SELECT id INTO v_bot FROM public.bots WHERE is_builtin AND name = 'MUSIC BOT';
  IF v_bot IS NULL OR NOT public.bot_installed_in_realm(_realm_id, v_bot) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Add MUSIC BOT to this realm first');
  END IF;

  IF v_name IN ('queue', 'np') THEN
    WITH live AS (
      SELECT row_number() OVER (ORDER BY position) AS rn, title, artist, requested_by
      FROM public.music_queue
      WHERE realm_id = _realm_id
        AND realm_room_id IS NOT DISTINCT FROM _realm_room_id
        AND status = 'queued'
      ORDER BY position
      LIMIT 10
    )
    SELECT string_agg(
      (CASE WHEN rn = 1 THEN '▶️' ELSE rn::text || '.' END) || ' ' || title ||
        CASE WHEN artist IS NOT NULL THEN ' — ' || artist ELSE '' END,
      E'\n' ORDER BY rn
    )
    INTO v_body
    FROM live;

    IF v_body IS NULL THEN
      v_body := CASE
        WHEN v_name = 'np' THEN 'Nothing is queued. Try `/play <song>`.'
        ELSE 'The queue is empty. Try `/play <song>`.'
      END;
    ELSIF v_name = 'np' THEN
      v_body := '🎧 Now playing:' || E'\n' || v_body;
    ELSE
      v_body := '🎶 Up next:' || E'\n' || v_body;
    END IF;

  ELSIF v_name = 'skip' THEN
    WITH head AS (
      SELECT id, title, artist FROM public.music_queue
      WHERE realm_id = _realm_id
        AND realm_room_id IS NOT DISTINCT FROM _realm_room_id
        AND status = 'queued'
      ORDER BY position
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE public.music_queue q
    SET status = 'skipped'
    FROM head
    WHERE q.id = head.id
    RETURNING '⏭️ Skipped ' || head.title ||
      CASE WHEN head.artist IS NOT NULL THEN ' — ' || head.artist ELSE '' END
    INTO v_body;

    IF v_body IS NULL THEN
      v_body := 'Nothing to skip — the queue is empty.';
    END IF;

  ELSIF v_name = 'stop' THEN
    UPDATE public.music_queue
    SET status = 'skipped'
    WHERE realm_id = _realm_id
      AND realm_room_id IS NOT DISTINCT FROM _realm_room_id
      AND status = 'queued';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_body := '⏹️ Cleared ' || v_count || ' song' || CASE WHEN v_count = 1 THEN '' ELSE 's' END || ' from the queue.';

  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'That command is not available');
  END IF;

  RETURN jsonb_build_object('ok', true, 'message_id', public.bot_insert_message(v_bot, _realm_id, _realm_room_id, v_body, NULL), 'body', v_body);
END;
$fn$;

REVOKE ALL ON FUNCTION public.music_add(uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.run_music_bot_command(text, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.music_add(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_music_bot_command(text, text, uuid, uuid) TO authenticated;

-- bot_insert_message gains an optional rich payload (poll-free cards, etc).
DROP FUNCTION IF EXISTS public.bot_insert_message(uuid, uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.bot_insert_message(
  _bot_id uuid,
  _realm_id uuid,
  _realm_room_id uuid,
  _body text,
  _card jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_id uuid;
BEGIN
  PERFORM set_config('rizz.bot_writer', 'on', true);

  INSERT INTO public.messages (realm_id, realm_room_id, sender_id, bot_id, body, card)
  VALUES (_realm_id, _realm_room_id, NULL, _bot_id, _body, _card)
  RETURNING id INTO v_id;

  PERFORM set_config('rizz.bot_writer', 'off', true);
  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.bot_insert_message(uuid, uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------ 10. realtime + reload
DO $pub$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'realm_polls', 'realm_poll_votes', 'realm_scheduled_messages',
    'realm_custom_emoji', 'realm_reaction_roles', 'realm_xp', 'music_queue'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END
$pub$;

NOTIFY pgrst, 'reload schema';
