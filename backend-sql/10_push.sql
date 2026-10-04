-- RIZZ Web Push setup. Safe to re-run.
-- Rollback notes are at the end; no existing messages or profiles are deleted.

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  platform text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON public.push_subscriptions(user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subscriptions_select_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_select_own ON public.push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS push_subscriptions_insert_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_insert_own ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS push_subscriptions_update_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_update_own ON public.push_subscriptions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS push_subscriptions_delete_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_delete_own ON public.push_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;

CREATE TABLE IF NOT EXISTS public.notification_prefs (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  dms boolean NOT NULL DEFAULT true,
  calls boolean NOT NULL DEFAULT true,
  group_mentions boolean NOT NULL DEFAULT true,
  quiet_start time,
  quiet_end time,
  muted_conversations uuid[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_prefs_select_own ON public.notification_prefs;
CREATE POLICY notification_prefs_select_own ON public.notification_prefs
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS notification_prefs_insert_own ON public.notification_prefs;
CREATE POLICY notification_prefs_insert_own ON public.notification_prefs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS notification_prefs_update_own ON public.notification_prefs;
CREATE POLICY notification_prefs_update_own ON public.notification_prefs
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE ON public.notification_prefs TO authenticated;

-- One row per deployment. Insert the URL and shared secret only after the
-- Worker is deployed; keep the real secret out of this repository.
CREATE TABLE IF NOT EXISTS private.push_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  worker_url text NOT NULL,
  shared_secret text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.push_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.push_config FROM PUBLIC, anon, authenticated;

-- Sends one authenticated Worker request per eligible recipient so preference
-- filtering and endpoint removal cannot cross between users.
CREATE OR REPLACE FUNCTION private.send_push(_user_ids uuid[], _payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid;
  v_config private.push_config%ROWTYPE;
  v_pref public.notification_prefs%ROWTYPE;
  v_subscriptions jsonb;
  v_kind text := coalesce(_payload->>'type', 'message');
  v_actor uuid := nullif(_payload->>'actor_id', '')::uuid;
  v_conversation uuid := nullif(_payload->>'conversation_id', '')::uuid;
  v_quiet boolean;
BEGIN
  SELECT * INTO v_config FROM private.push_config WHERE singleton = true;
  IF NOT FOUND OR v_config.worker_url IS NULL OR v_config.shared_secret IS NULL THEN
    RAISE WARNING 'Push was skipped: private.push_config is not configured';
    RETURN;
  END IF;

  FOREACH v_user_id IN ARRAY coalesce(_user_ids, '{}') LOOP
    SELECT * INTO v_pref FROM public.notification_prefs WHERE user_id = v_user_id;
    v_quiet := v_pref.quiet_start IS NOT NULL
      AND v_pref.quiet_end IS NOT NULL
      AND CASE
        WHEN v_pref.quiet_start <= v_pref.quiet_end
          THEN localtime >= v_pref.quiet_start AND localtime < v_pref.quiet_end
        ELSE localtime >= v_pref.quiet_start OR localtime < v_pref.quiet_end
      END;

    IF (v_kind = 'message' AND coalesce(v_pref.dms, true) = false)
       OR (v_kind IN ('call', 'call_cancel') AND coalesce(v_pref.calls, true) = false)
       OR (v_kind = 'group_mention' AND coalesce(v_pref.group_mentions, true) = false)
       OR (v_quiet AND v_kind NOT IN ('call_cancel', 'test'))
       OR (v_conversation IS NOT NULL AND v_conversation = ANY(coalesce(v_pref.muted_conversations, '{}')))
       OR (v_actor IS NOT NULL AND EXISTS (
         SELECT 1 FROM public.blocks b
         WHERE (b.blocker_id = v_user_id AND b.blocked_id = v_actor)
            OR (b.blocker_id = v_actor AND b.blocked_id = v_user_id)
       ))
    THEN
      CONTINUE;
    END IF;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'endpoint', s.endpoint,
      'expirationTime', NULL,
      'keys', jsonb_build_object('p256dh', s.p256dh, 'auth', s.auth)
    )), '[]'::jsonb)
    INTO v_subscriptions
    FROM public.push_subscriptions s
    WHERE s.user_id = v_user_id;

    IF jsonb_array_length(v_subscriptions) > 0 THEN
      PERFORM net.http_post(
        url := rtrim(v_config.worker_url, '/') || '/push',
        body := jsonb_build_object('subscriptions', v_subscriptions, 'payload', _payload),
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-push-secret', v_config.shared_secret
        ),
        timeout_milliseconds := 3000
      );
      UPDATE public.push_subscriptions SET last_used_at = now()
      WHERE user_id = v_user_id;
    END IF;
  END LOOP;
END;
$function$;
REVOKE ALL ON FUNCTION private.send_push(uuid[], jsonb) FROM PUBLIC, anon, authenticated;

-- The app's existing call flow uses Realtime signaling and had no persisted
-- call row. This table supplies a safe status lifecycle for push/cancel events.
CREATE TABLE IF NOT EXISTS public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  callee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ringing'
    CHECK (status IN ('ringing', 'active', 'ended', 'declined', 'missed')),
  video boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (caller_id <> callee_id)
);
CREATE INDEX IF NOT EXISTS calls_participant_created_idx
  ON public.calls(caller_id, callee_id, created_at DESC);
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS calls_select_participant ON public.calls;
CREATE POLICY calls_select_participant ON public.calls
  FOR SELECT TO authenticated USING (auth.uid() IN (caller_id, callee_id));
GRANT SELECT ON public.calls TO authenticated;

CREATE OR REPLACE FUNCTION public.begin_call(_callee_id uuid, _video boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE v_call_id uuid;
BEGIN
  IF auth.uid() IS NULL OR _callee_id IS NULL OR _callee_id = auth.uid() THEN
    RAISE EXCEPTION 'A valid signed-in caller and recipient are required';
  END IF;
  IF public.is_blocked_pair(auth.uid(), _callee_id) THEN
    RAISE EXCEPTION 'Calls are unavailable for this conversation';
  END IF;
  INSERT INTO public.calls(caller_id, callee_id, video)
  VALUES (auth.uid(), _callee_id, coalesce(_video, false))
  RETURNING id INTO v_call_id;
  RETURN v_call_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.begin_call(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_call(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_call_status(_call_id uuid, _status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE v_call public.calls%ROWTYPE;
BEGIN
  IF _status NOT IN ('active', 'ended', 'declined', 'missed') THEN
    RAISE EXCEPTION 'Unsupported call status';
  END IF;
  SELECT * INTO v_call FROM public.calls WHERE id = _call_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() NOT IN (v_call.caller_id, v_call.callee_id) THEN
    RAISE EXCEPTION 'Call not found or not available';
  END IF;
  IF v_call.status IN ('ended', 'declined', 'missed') THEN RETURN; END IF;
  IF _status = 'declined' AND auth.uid() <> v_call.callee_id THEN
    RAISE EXCEPTION 'Only the recipient can decline a call';
  END IF;
  IF _status = 'missed' AND auth.uid() <> v_call.callee_id THEN
    RAISE EXCEPTION 'Only the recipient can mark a call missed';
  END IF;
  UPDATE public.calls SET status = _status, updated_at = now() WHERE id = _call_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.set_call_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_call_status(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.push_new_direct_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE v_sender text; v_body text;
BEGIN
  SELECT coalesce(nullif(display_name, ''), username) INTO v_sender
  FROM public.profiles WHERE id = NEW.sender_id;
  v_body := CASE
    WHEN NEW.attachment_url IS NOT NULL THEN 'Sent a photo'
    WHEN NEW.audio_url IS NOT NULL THEN 'Voice message'
    ELSE left(coalesce(nullif(btrim(NEW.body), ''), 'New message'), 80)
  END;
  PERFORM private.send_push(
    ARRAY[NEW.recipient_id],
    jsonb_build_object(
      'type', 'message',
      'title', coalesce(v_sender, 'New message'),
      'body', v_body,
      'tag', NEW.sender_id::text,
      'conversation_id', NEW.sender_id::text,
      'url', '/dm/' || NEW.sender_id::text,
      'actor_id', NEW.sender_id::text
    )
  );
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS push_direct_message_after_insert ON public.direct_messages;
CREATE TRIGGER push_direct_message_after_insert
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.push_new_direct_message();

CREATE OR REPLACE FUNCTION public.push_call_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE v_caller text;
BEGIN
  SELECT coalesce(nullif(display_name, ''), username) INTO v_caller
  FROM public.profiles WHERE id = NEW.caller_id;

  IF TG_OP = 'INSERT' AND NEW.status = 'ringing' THEN
    PERFORM private.send_push(
      ARRAY[NEW.callee_id],
      jsonb_build_object(
        'type', 'call', 'title', coalesce(v_caller, 'Incoming call'),
        'body', CASE WHEN NEW.video THEN 'Incoming video call' ELSE 'Incoming call' END,
        'tag', 'call:' || NEW.id::text, 'url', '/call/' || NEW.caller_id::text,
        'conversation_id', NEW.caller_id::text, 'actor_id', NEW.caller_id::text,
        'call_id', NEW.id::text, 'requireInteraction', true
      )
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
        AND NEW.status IN ('active', 'ended', 'declined', 'missed') THEN
    PERFORM private.send_push(
      ARRAY[NEW.caller_id, NEW.callee_id],
      jsonb_build_object('type', 'call_cancel', 'tag', 'call:' || NEW.id::text)
    );
    IF NEW.status = 'missed' THEN
      PERFORM private.send_push(
        ARRAY[NEW.callee_id],
        jsonb_build_object(
          'type', 'call', 'title', 'Missed call',
          'body', coalesce(v_caller, 'You missed a call'),
          'tag', 'missed:' || NEW.id::text,
          'url', '/dm/' || NEW.caller_id::text,
          'conversation_id', NEW.caller_id::text,
          'actor_id', NEW.caller_id::text
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS push_call_after_insert ON public.calls;
CREATE TRIGGER push_call_after_insert AFTER INSERT ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.push_call_status();
DROP TRIGGER IF EXISTS push_call_after_status_update ON public.calls;
CREATE TRIGGER push_call_after_status_update AFTER UPDATE OF status ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.push_call_status();

CREATE OR REPLACE FUNCTION public.send_test_push()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to send a test notification'; END IF;
  PERFORM private.send_push(
    ARRAY[auth.uid()],
    jsonb_build_object(
      'type', 'test', 'title', 'RIZZ notifications are ready',
      'body', 'This is a test notification on this device.',
      'tag', 'rizz-test', 'url', '/settings'
    )
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.send_test_push() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_test_push() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Verification
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname IN ('public', 'private')
  AND tablename IN ('push_subscriptions', 'notification_prefs', 'calls', 'push_config')
ORDER BY schemaname, tablename;
SELECT tgname FROM pg_trigger
WHERE NOT tgisinternal AND tgname IN (
  'push_direct_message_after_insert', 'push_call_after_insert', 'push_call_after_status_update'
);

-- Rollback (only if push is being removed): drop the two push triggers, then
-- drop public.send_test_push(), public.push_call_status(),
-- public.push_new_direct_message(), private.send_push(),
-- public.set_call_status(), public.begin_call(), public.calls,
-- private.push_config, public.notification_prefs, and public.push_subscriptions.
-- Keep pg_net if any other feature in the Supabase project uses it.