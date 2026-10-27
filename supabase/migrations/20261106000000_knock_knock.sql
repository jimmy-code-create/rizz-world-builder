-- ============================================================================
-- KNOCK KNOCK — "are you around?" before you type.
--
--  * ping_presence() is the heartbeat that makes "app open" measurable. The
--    presence row already records a status, but a status alone cannot tell an
--    account that closed the tab an hour ago from one that is watching YouTube
--    in another tab: both look idle. A client with the app open pings every
--    couple of minutes, so last_seen_at becomes the honest answer to "is their
--    app actually open right now".
--  * knocks are the doorbell. One row per knock, answered once by the recipient,
--    kept in the conversation so a knock you slept through is still there with
--    the answer attached instead of vanishing like a toast.
--
-- Safe to re-run.
-- ============================================================================

-- ------------------------------------------------------- heartbeat (app open)
CREATE OR REPLACE FUNCTION public.ping_presence()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_at timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.user_presence (user_id, status, updated_at, last_seen_at)
  VALUES (auth.uid(), 'online', v_at, v_at)
  ON CONFLICT (user_id) DO UPDATE
    SET last_seen_at = v_at;

  RETURN v_at;
END;
$function$;

-- ------------------------------------------------------------------- knocks
CREATE TABLE IF NOT EXISTS public.knocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  /** Who knocked. */
  from_user uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  /** Whose door it is. */
  to_user uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  /** Optional one-liner that rides along with the knock. */
  note text,
  /** Null while the door is still unanswered. */
  response text
    CHECK (response IS NULL OR response IN ('come_in', 'later', 'busy')),
  responded_at timestamptz,
  /** True once the recipient has looked at it (their own door UI or the thread). */
  seen boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knocks_not_self CHECK (from_user <> to_user),
  CONSTRAINT knocks_note_length CHECK (note IS NULL OR char_length(note) <= 120)
);

CREATE INDEX IF NOT EXISTS idx_knocks_pair
  ON public.knocks (from_user, to_user, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knocks_inbox
  ON public.knocks (to_user, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knocks_pending
  ON public.knocks (to_user, created_at DESC)
  WHERE response IS NULL;

ALTER TABLE public.knocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knocks REPLICA IDENTITY FULL;
REVOKE ALL ON public.knocks FROM anon;
-- Both sides of a knock may read it; nobody writes rows directly (RPCs only).
GRANT SELECT ON public.knocks TO authenticated;

DROP POLICY IF EXISTS knocks_read_own ON public.knocks;
CREATE POLICY knocks_read_own ON public.knocks
  FOR SELECT TO authenticated
  USING (from_user = auth.uid() OR to_user = auth.uid());

-- ------------------------------------------------------------------ send it
/**
 * Knocks on someone's door and files a notification on their side.
 *
 * Returns the created row so the sender can draw it immediately instead of
 * waiting for the realtime echo. Blocks are honoured in both directions, and a
 * knock is rate limited per person: this is a doorbell, not a mash button.
 */
CREATE OR REPLACE FUNCTION public.send_knock(_to uuid, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_from uuid := auth.uid();
  v_note text := nullif(btrim(coalesce(_note, '')), '');
  v_row public.knocks;
  v_name text;
BEGIN
  IF v_from IS NULL THEN
    RAISE EXCEPTION 'Sign in to knock';
  END IF;
  IF _to IS NULL OR _to = v_from THEN
    RAISE EXCEPTION 'Knock on someone else''s door';
  END IF;
  IF v_note IS NOT NULL AND char_length(v_note) > 120 THEN
    RAISE EXCEPTION 'Keep the note under 120 characters';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.blocks AS b
    WHERE (b.blocker_id = _to AND b.blocked_id = v_from)
       OR (b.blocker_id = v_from AND b.blocked_id = _to)
  ) THEN
    RAISE EXCEPTION 'You can''t knock on that door';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.knocks AS k
    WHERE k.from_user = v_from
      AND k.to_user = _to
      AND k.created_at > now() - interval '30 seconds'
  ) THEN
    RAISE EXCEPTION 'Knocked just now — give them a second';
  END IF;

  IF (
    SELECT count(*) FROM public.knocks AS k
    WHERE k.from_user = v_from AND k.created_at > now() - interval '1 hour'
  ) >= 15 THEN
    RAISE EXCEPTION 'That''s a lot of knocking — send a message instead';
  END IF;

  INSERT INTO public.knocks (from_user, to_user, note)
  VALUES (v_from, _to, v_note)
  RETURNING * INTO v_row;

  SELECT p.username INTO v_name FROM public.profiles AS p WHERE p.id = v_from;

  INSERT INTO public.notifications (user_id, actor_id, type, title, body, data)
  VALUES (
    _to,
    v_from,
    'knock',
    '👋 Knock knock',
    coalesce(v_note, '@' || coalesce(v_name, 'someone') || ' is at your door'),
    jsonb_build_object('source', 'knock', 'knock_id', v_row.id, 'from_user', v_from)
  );

  RETURN to_jsonb(v_row);
END;
$function$;

-- ---------------------------------------------------------------- answer it
CREATE OR REPLACE FUNCTION public.respond_knock(_knock_id uuid, _response text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_response text := lower(coalesce(_response, ''));
  v_row public.knocks;
  v_title text;
  v_body text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to answer';
  END IF;
  IF v_response NOT IN ('come_in', 'later', 'busy') THEN
    RAISE EXCEPTION 'Unknown answer';
  END IF;

  UPDATE public.knocks
  SET response = v_response,
      responded_at = now(),
      seen = true
  WHERE id = _knock_id
    AND to_user = auth.uid()
    AND response IS NULL
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'That knock is already answered';
  END IF;

  IF v_response = 'come_in' THEN
    v_title := '🚪 Door''s open';
    v_body := '@' || coalesce((SELECT p.username FROM public.profiles AS p WHERE p.id = auth.uid()), 'they') || ' let you in';
  ELSIF v_response = 'later' THEN
    v_title := '⏳ Give them a minute';
    v_body := '@' || coalesce((SELECT p.username FROM public.profiles AS p WHERE p.id = auth.uid()), 'they') || ' will be right there';
  ELSE
    v_title := '✋ Not right now';
    v_body := '@' || coalesce((SELECT p.username FROM public.profiles AS p WHERE p.id = auth.uid()), 'they') || ' is busy at the moment';
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, title, body, data)
  VALUES (
    v_row.from_user,
    auth.uid(),
    'knock_reply',
    v_title,
    v_body,
    jsonb_build_object('source', 'knock', 'knock_id', v_row.id, 'response', v_response)
  );
END;
$function$;

-- --------------------------------------------------------------- saw it
/** The recipient looked at the door: every knock from that peer is now seen. */
CREATE OR REPLACE FUNCTION public.mark_knocks_seen(_peer uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL OR _peer IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.knocks
  SET seen = true
  WHERE to_user = auth.uid()
    AND from_user = _peer
    AND seen = false;
END;
$function$;

REVOKE ALL ON FUNCTION public.ping_presence() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_knock(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_knock(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_knocks_seen(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.ping_presence() TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_knock(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_knock(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_knocks_seen(uuid) TO authenticated;

-- Realtime: a knock lands in the open thread (and as a doorbell) without a poll.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'knocks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.knocks;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
