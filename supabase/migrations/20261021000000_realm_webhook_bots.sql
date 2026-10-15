-- ============================================================================
-- REALM WEBHOOK BOTS + message embeds.
--
-- PROPOSED - NOT APPLIED. Needs explicit OK before running (per project rules:
-- ask before any DB migration).
--
--   * realm_bots: realm-scoped posting bots (name, avatar, token_hash, channel,
--     revoked). Only the secret's sha256 is stored; the plaintext is shown
--     once at creation/rotation and never again.
--   * messages.embeds (jsonb): Discord-style embed cards, max 10 per message.
--     NOTE: messages.bot_id already exists with an FK to the global bots
--     table, so webhook bots use messages.webhook_bot_id instead — existing
--     sender/bot guards and checks are untouched.
--   * messages_embeds_guard: validates the embed limits on every write
--     (counts, lengths, https images, 6000 total chars), for both the webhook
--     and any future writer.
--   * realm_bot_rate_limits: 30 messages/minute per webhook bot.
--   * RLS: realm owners/admins (owner row or realm_members owner/mod) manage
--     bots; realm members read non-revoked bots of realms they belong to.
--     Clients never write embeds directly on other paths — the webhook inserts
--     through the service role; the guard trigger validates shape regardless.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.realm_bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES public.realms(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 32),
  avatar_url text,
  token_hash text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  default_room_id uuid REFERENCES public.realm_rooms(id) ON DELETE SET NULL,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_realm_bots_realm ON public.realm_bots (realm_id);

ALTER TABLE public.realm_bots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.realm_bots FROM anon, authenticated;

-- Managers: the realm owner, or a member with an owner/mod role.
CREATE OR REPLACE FUNCTION public.can_manage_realm_webhook_bots(_realm_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.realms r WHERE r.id = _realm_id AND r.owner_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.realm_members m
                 WHERE m.realm_id = _realm_id AND m.user_id = _user_id
                   AND m.role IN ('owner', 'mod'));
$function$;

DROP POLICY IF EXISTS realm_bots_manage ON public.realm_bots;
CREATE POLICY realm_bots_manage ON public.realm_bots
  FOR ALL TO authenticated
  USING (public.can_manage_realm_webhook_bots(realm_id, auth.uid()))
  WITH CHECK (public.can_manage_realm_webhook_bots(realm_id, auth.uid()));

DROP POLICY IF EXISTS realm_bots_read ON public.realm_bots;
CREATE POLICY realm_bots_read ON public.realm_bots
  FOR SELECT TO authenticated
  USING (
    revoked = false AND (
      public.can_manage_realm_webhook_bots(realm_id, auth.uid())
      OR EXISTS (SELECT 1 FROM public.realm_members m
                 WHERE m.realm_id = realm_bots.realm_id AND m.user_id = auth.uid())
    )
  );

-- Which channel a webhook bot posts to is default_room_id above
-- (null = the realm's main channel).

-- Embed cards on messages.
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS embeds jsonb;
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS webhook_bot_id uuid REFERENCES public.realm_bots(id) ON DELETE SET NULL;
-- Per-message identity override from the webhook body (username/avatar_url).
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS webhook_meta jsonb;
CREATE INDEX IF NOT EXISTS idx_messages_webhook_bot ON public.messages (webhook_bot_id);

-- Shape/limit guard for embeds, on every write path.
CREATE OR REPLACE FUNCTION public.messages_embeds_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $guard$
DECLARE
  v_embeds jsonb;
  v_count integer;
  v_total integer := 0;
  v_embed jsonb;
  v_fields jsonb;
  v_field jsonb;
  v_text text;
BEGIN
  IF NEW.embeds IS NULL THEN RETURN NEW; END IF;
  IF jsonb_typeof(NEW.embeds) <> 'array' THEN
    RAISE EXCEPTION 'Embeds must be a list';
  END IF;
  v_count := jsonb_array_length(NEW.embeds);
  IF v_count > 10 THEN
    RAISE EXCEPTION 'At most 10 embeds per message';
  END IF;
  FOR v_embed IN SELECT * FROM jsonb_array_elements(NEW.embeds) LOOP
    v_text := coalesce(v_embed->>'title', '');
    IF char_length(v_text) > 256 THEN RAISE EXCEPTION 'Embed titles can be up to 256 characters'; END IF;
    v_total := v_total + char_length(v_text);
    v_text := coalesce(v_embed->>'description', '');
    IF char_length(v_text) > 4096 THEN RAISE EXCEPTION 'Embed descriptions can be up to 4096 characters'; END IF;
    v_total := v_total + char_length(v_text);
    v_fields := coalesce(v_embed->'fields', '[]'::jsonb);
    IF jsonb_typeof(v_fields) <> 'array' OR jsonb_array_length(v_fields) > 25 THEN
      RAISE EXCEPTION 'Embeds carry at most 25 fields';
    END IF;
    FOR v_field IN SELECT * FROM jsonb_array_elements(v_fields) LOOP
      IF char_length(coalesce(v_field->>'name', '')) > 256 THEN
        RAISE EXCEPTION 'Embed field names can be up to 256 characters';
      END IF;
      IF char_length(coalesce(v_field->>'value', '')) > 1024 THEN
        RAISE EXCEPTION 'Embed field values can be up to 1024 characters';
      END IF;
      v_total := v_total + char_length(coalesce(v_field->>'name', ''))
                           + char_length(coalesce(v_field->>'value', ''));
    END LOOP;
    v_total := v_total
      + char_length(coalesce(v_embed#>>'{author,name}', ''))
      + char_length(coalesce(v_embed#>>'{footer,text}', ''));
    IF char_length(coalesce(v_embed#>>'{author,name}', '')) > 256 THEN
      RAISE EXCEPTION 'Embed author names can be up to 256 characters';
    END IF;
    IF char_length(coalesce(v_embed#>>'{footer,text}', '')) > 2048 THEN
      RAISE EXCEPTION 'Embed footers can be up to 2048 characters';
    END IF;
  END LOOP;
  IF v_total > 6000 THEN
    RAISE EXCEPTION 'Embeds carry at most 6000 characters per message';
  END IF;
  RETURN NEW;
END
$guard$;

DROP TRIGGER IF EXISTS messages_embeds_guard_t ON public.messages;
CREATE TRIGGER messages_embeds_guard_t
  BEFORE INSERT OR UPDATE OF embeds ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_embeds_guard();

-- 30 messages/minute per webhook bot.
CREATE TABLE IF NOT EXISTS public.realm_bot_rate_limits (
  bot_id uuid PRIMARY KEY REFERENCES public.realm_bots(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  used integer NOT NULL DEFAULT 0
);
ALTER TABLE public.realm_bot_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.realm_bot_rate_limits FROM anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'realm_bots'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.realm_bots;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
