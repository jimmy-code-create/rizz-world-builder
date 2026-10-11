-- ============================================================================
-- @ mentions → notifications
-- When a realm message, group message, or post caption includes @username,
-- insert a `mention` notification for that user (skipping self-mentions).
-- ============================================================================

-- ---------------------------------------------------------------- helpers --

CREATE OR REPLACE FUNCTION public.notify_mentions(
  _body text,
  _actor uuid,
  _type text,
  _data jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF _body IS NULL OR _actor IS NULL THEN
    RETURN;
  END IF;

  WITH extracted AS (
    SELECT DISTINCT lower(m[1]) AS username
    FROM regexp_matches(_body, '@([a-zA-Z0-9_]{2,32})', 'g') AS m
  ),
  targets AS (
    SELECT p.id
    FROM public.profiles AS p
    JOIN extracted ON lower(p.username) = extracted.username
    WHERE p.id <> _actor
  )
  INSERT INTO public.notifications (user_id, actor_id, type, title, body, data)
  SELECT
    t.id,
    _actor,
    _type,
    'Mentioned you',
    left(_body, 140),
    _data
  FROM targets AS t
  ON CONFLICT DO NOTHING;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_mentions(text, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_mentions(text, uuid, text, jsonb) TO authenticated;

-- ------------------------------------------------- realm (channel) messages --

CREATE OR REPLACE FUNCTION public.notify_realm_message_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  PERFORM public.notify_mentions(
    NEW.body,
    NEW.sender_id,
    'mention',
    jsonb_build_object('source', 'realm', 'message_id', NEW.id, 'realm_id', NEW.realm_id)
  );
  RETURN NEW;
END;
$function$;

-- NOTE: `public.messages.author_id` was renamed to `sender_id` in
-- 20261011120000_rename_channels_to_realms.sql; the trigger auth check uses
-- that column below.

-- ------------------------------------------------------- group chat messages --

CREATE OR REPLACE FUNCTION public.notify_group_message_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.body = OLD.body THEN
    RETURN NEW;
  END IF;
  PERFORM public.notify_mentions(
    NEW.body,
    NEW.author_id,
    'mention',
    jsonb_build_object('source', 'group', 'message_id', NEW.id, 'group_id', NEW.group_id)
  );
  RETURN NEW;
END;
$function$;

-- ------------------------------------------------------------------- posts --

CREATE OR REPLACE FUNCTION public.notify_post_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_author uuid := NEW.author_id;
BEGIN
  PERFORM public.notify_mentions(
    COALESCE(NEW.caption, ''),
    v_author,
    'mention',
    jsonb_build_object('source', 'post', 'post_id', NEW.id)
  );
  RETURN NEW;
END;
$function$;

-- ----------------------------------------------------------------- triggers --

DROP TRIGGER IF EXISTS trg_realm_message_mentions ON public.messages;
CREATE TRIGGER trg_realm_message_mentions
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_realm_message_mentions();

DROP TRIGGER IF EXISTS trg_group_message_mentions ON public.group_messages;
CREATE TRIGGER trg_group_message_mentions
AFTER INSERT ON public.group_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_group_message_mentions();

DROP TRIGGER IF EXISTS trg_post_mentions ON public.posts;
CREATE TRIGGER trg_post_mentions
AFTER INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.notify_post_mentions();

-- ------------------------------------------------------------------ indexes --

CREATE INDEX IF NOT EXISTS idx_notifications_user_type_read
  ON public.notifications (user_id, type, read, created_at DESC);

-- Keep realtime for other surfaces up to date: `notifications` is already in
-- supabase_realtime (verified in earlier migration).
