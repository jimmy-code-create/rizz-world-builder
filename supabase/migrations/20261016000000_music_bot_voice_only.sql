-- ============================================================================
-- MUSIC BOT belongs to voice channels
--
-- Why: /play queued into whatever channel it was typed in, and both music RPCs
-- refused voice rooms outright ("That is not a text channel of this realm"), so
-- the feature could not run where music actually belongs: while everybody sits
-- in the same voice channel.
--
-- What changes:
--   * music_add and run_music_bot_command now REQUIRE a voice channel of the
--     realm. A text channel, or the realm's own channel, is refused.
--   * realm_slash_commands offers MUSIC BOT's commands in voice channels only,
--     and offers every other bot in text channels only, so a menu entry can no
--     longer appear where the matching RPC would refuse it.
--
-- Everything else is unchanged: the queue stays per channel (so two voice
-- channels have two independent queues), and the house bot's rules are as they
-- were.
-- ============================================================================

-- --------------------------------------------------- 1. /play (music_add)
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
  v_room_kind text;
  v_queued integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to add a song');
  END IF;
  IF NOT public.is_realm_member(_realm_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Join this realm first');
  END IF;

  -- Voice channels only: the queue, the card and the playback all belong to the
  -- call everybody is sitting in.
  SELECT r.kind INTO v_room_kind
  FROM public.realm_rooms r
  WHERE r.id = _realm_room_id AND r.realm_id = _realm_id;
  IF v_room_kind IS DISTINCT FROM 'voice' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The music bot only works in a voice channel');
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

-- ------------------------------------- 2. /queue, /np, /skip, /stop
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
  v_room_kind text;
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

  SELECT r.kind INTO v_room_kind
  FROM public.realm_rooms r
  WHERE r.id = _realm_room_id AND r.realm_id = _realm_id;
  IF v_room_kind IS DISTINCT FROM 'voice' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The music bot only works in a voice channel');
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

-- ------------------------------------------- 3. who is offered where
/**
 * The commands a channel offers.
 *
 * A voice channel offers MUSIC BOT and nothing else; a text channel (and the
 * realm's own channel) offers every other bot and never MUSIC BOT. Without this
 * the composer in a text channel still listed /play, and running it failed.
 */
CREATE OR REPLACE FUNCTION public.realm_slash_commands(_realm_id uuid, _realm_room_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT CASE
    WHEN NOT public.is_realm_member(_realm_id) THEN '[]'::jsonb
    ELSE coalesce(
      jsonb_agg(
        jsonb_build_object(
          'command_id', c.id,
          'name', c.name,
          'description', c.description,
          'options', c.options,
          'bot_id', b.id,
          'bot_name', b.name,
          'bot_avatar_url', b.avatar_url,
          'is_builtin', b.is_builtin
        )
        ORDER BY b.is_builtin DESC, b.name, c.name
      ),
      '[]'::jsonb
    )
  END
  FROM public.bot_commands c
  JOIN public.bots b ON b.id = c.bot_id
  JOIN public.realm_bot_installs i
    ON i.bot_id = b.id AND i.realm_id = _realm_id AND i.enabled
  WHERE c.enabled_globally
    AND public.bot_command_allowed_in_channel(_realm_id, _realm_room_id, c.id)
    AND CASE
      WHEN EXISTS (
        SELECT 1 FROM public.realm_rooms r
        WHERE r.id = _realm_room_id AND r.realm_id = _realm_id AND r.kind = 'voice'
      ) THEN b.name = 'MUSIC BOT'
      ELSE b.name <> 'MUSIC BOT'
    END;
$function$;

REVOKE ALL ON FUNCTION public.music_add(uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.run_music_bot_command(text, text, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.realm_slash_commands(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.music_add(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_music_bot_command(text, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.realm_slash_commands(uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
