-- ============================================================================
-- PART 2: presence status and custom status.
--
--  * user_presence holds each account's status (online / idle / dnd /
--    invisible), whether the user picked it by hand, and the custom status.
--  * Invisible is enforced here, not in the UI: the SELECT policy hides an
--    invisible row from everyone but its owner, so other clients never receive
--    the real status — not from a query and not from the realtime channel.
--  * Writes only through the RPCs below (authenticated has SELECT and nothing
--    else), so a client cannot set another account's status.
--  * Expired custom statuses are never returned as current (they are filtered
--    on read) and are purged on every presence write.
--
-- Safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'online'
    CHECK (status IN ('online', 'idle', 'dnd', 'invisible')),
  /** true when the user picked the status themselves, so auto idle leaves it alone. */
  manual boolean NOT NULL DEFAULT false,
  custom_status_emoji text,
  custom_status_text text,
  custom_status_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  CONSTRAINT user_presence_custom_status_length
    CHECK (custom_status_text IS NULL OR char_length(custom_status_text) <= 60)
);

-- Prevents anyone else from reading your real status while you're invisible.
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence REPLICA IDENTITY FULL;
REVOKE ALL ON public.user_presence FROM anon;
GRANT SELECT ON public.user_presence TO authenticated;

DROP POLICY IF EXISTS user_presence_read_visible ON public.user_presence;
CREATE POLICY user_presence_read_visible ON public.user_presence
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR status <> 'invisible');

CREATE INDEX IF NOT EXISTS idx_user_presence_status ON public.user_presence (status);
CREATE INDEX IF NOT EXISTS idx_user_presence_custom_status_expiry
  ON public.user_presence (custom_status_expires_at)
  WHERE custom_status_expires_at IS NOT NULL;

-- --------------------------------------------------------------- set status
CREATE OR REPLACE FUNCTION public.set_presence_status(_status text, _manual boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_status text := lower(coalesce(_status, 'online'));
  v_manual boolean := coalesce(_manual, true);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to change your status';
  END IF;
  IF v_status NOT IN ('online', 'idle', 'dnd', 'invisible') THEN
    RAISE EXCEPTION 'Unknown status';
  END IF;

  INSERT INTO public.user_presence (user_id, status, manual, updated_at, last_seen_at)
  VALUES (auth.uid(), v_status, v_manual, now(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET
      -- An automatic (idle/online) change never overrides a hand-picked status.
      status = CASE
        WHEN NOT v_manual AND public.user_presence.manual THEN public.user_presence.status
        ELSE EXCLUDED.status
      END,
      manual = CASE
        WHEN v_manual THEN true
        ELSE public.user_presence.manual
      END,
      last_seen_at = CASE
        WHEN NOT v_manual AND public.user_presence.manual THEN public.user_presence.last_seen_at
        ELSE now()
      END,
      updated_at = now();

  -- Expired custom statuses clear themselves on the next presence write.
  UPDATE public.user_presence
  SET custom_status_emoji = NULL,
      custom_status_text = NULL,
      custom_status_expires_at = NULL,
      updated_at = now()
  WHERE custom_status_expires_at IS NOT NULL
    AND custom_status_expires_at <= now();
END;
$function$;

-- ---------------------------------------------------------- custom status
CREATE OR REPLACE FUNCTION public.set_custom_status(
  _emoji text,
  _text text,
  _expires_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_emoji text := nullif(btrim(coalesce(_emoji, '')), '');
  v_text text := nullif(btrim(coalesce(_text, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to set a status';
  END IF;
  IF v_emoji IS NULL AND v_text IS NULL THEN
    RAISE EXCEPTION 'Add an emoji or a few words first';
  END IF;
  IF char_length(coalesce(v_emoji, '')) > 16 THEN
    RAISE EXCEPTION 'That emoji is too long';
  END IF;
  IF char_length(coalesce(v_text, '')) > 60 THEN
    RAISE EXCEPTION 'Custom statuses can be up to 60 characters';
  END IF;
  IF _expires_at IS NOT NULL AND _expires_at <= now() THEN
    RAISE EXCEPTION 'That expiry is already in the past';
  END IF;

  INSERT INTO public.user_presence (
    user_id, status, custom_status_emoji, custom_status_text, custom_status_expires_at, updated_at
  )
  VALUES (auth.uid(), 'online', v_emoji, v_text, _expires_at, now())
  ON CONFLICT (user_id) DO UPDATE
    SET custom_status_emoji = EXCLUDED.custom_status_emoji,
        custom_status_text = EXCLUDED.custom_status_text,
        custom_status_expires_at = EXCLUDED.custom_status_expires_at,
        updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.clear_custom_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to clear your status';
  END IF;

  UPDATE public.user_presence
  SET custom_status_emoji = NULL,
      custom_status_text = NULL,
      custom_status_expires_at = NULL,
      updated_at = now()
  WHERE user_id = auth.uid();
END;
$function$;

-- ----------------------------------------------------- helpers for senders
/**
 * True when the account is in Do not disturb. Callers (chat chimes, the call
 * ringer, the push Worker) use it to decide whether to make noise. An invisible
 * account reads as false here, so invisibility never leaks through this helper.
 */
CREATE OR REPLACE FUNCTION public.is_user_do_not_disturb(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT coalesce(
    (SELECT p.status = 'dnd' FROM public.user_presence AS p WHERE p.user_id = _user_id),
    false
  );
$function$;

REVOKE ALL ON FUNCTION public.set_presence_status(text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_custom_status(text, text, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clear_custom_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_user_do_not_disturb(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.set_presence_status(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_custom_status(text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_custom_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_do_not_disturb(uuid) TO authenticated, service_role;

-- Realtime: status changes (including clearing one) arrive without a refresh.
-- Row level security applies to these events too, so an invisible status is
-- never broadcast to anyone but its owner.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_presence'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
