-- ============================================================================
-- PART 1: link previews.
--
--  * link_previews is a server-only cache: the browser never fetches a link, the
--    /api/link-preview route does (with SSRF guards) and stores the result here
--    so each URL is fetched once. No policies are granted, so authenticated and
--    anon clients cannot read or write it at all.
--  * link_preview_hides records "this message's preview was removed", written
--    only through hide_link_preview() so the sender/realm-mod rule is enforced
--    in the database, not the UI.
--
-- Safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.link_previews (
  url text PRIMARY KEY,
  domain text NOT NULL,
  kind text NOT NULL DEFAULT 'link' CHECK (kind IN ('link', 'image', 'video')),
  title text,
  description text,
  site_name text,
  image_url text,
  failed boolean NOT NULL DEFAULT false,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.link_previews ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies: only the server (service role) touches this table.
REVOKE ALL ON public.link_previews FROM authenticated, anon;
GRANT ALL ON public.link_previews TO service_role;

CREATE INDEX IF NOT EXISTS idx_link_previews_fetched_at ON public.link_previews (fetched_at DESC);

-- ------------------------------------------------------- per-message removal
CREATE TABLE IF NOT EXISTS public.link_preview_hides (
  message_id uuid NOT NULL,
  message_scope text NOT NULL CHECK (message_scope IN ('dm', 'realm', 'group')),
  hidden_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, message_scope)
);

GRANT SELECT ON public.link_preview_hides TO authenticated;
GRANT ALL ON public.link_preview_hides TO service_role;
ALTER TABLE public.link_preview_hides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_preview_hides REPLICA IDENTITY FULL;

-- Who may read a removal flag: whoever can read that message.
DROP POLICY IF EXISTS link_preview_hides_select ON public.link_preview_hides;
CREATE POLICY link_preview_hides_select ON public.link_preview_hides
  FOR SELECT TO authenticated USING (
    CASE message_scope
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

-- Writes only through the RPC below.
DROP POLICY IF EXISTS link_preview_hides_insert_self ON public.link_preview_hides;

CREATE OR REPLACE FUNCTION public.hide_link_preview(_message_id uuid, _scope text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_allowed boolean := false;
  v_scope text := coalesce(_scope, 'realm');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to change this message';
  END IF;
  IF v_scope NOT IN ('dm', 'realm', 'group') THEN
    RAISE EXCEPTION 'Invalid message scope';
  END IF;

  IF v_scope = 'dm' THEN
    -- The sender may always clear a preview from their own message.
    SELECT true INTO v_allowed FROM public.direct_messages dm
    WHERE dm.id = _message_id AND dm.sender_id = auth.uid();
  ELSIF v_scope = 'group' THEN
    SELECT true INTO v_allowed FROM public.group_messages gm
    WHERE gm.id = _message_id AND gm.author_id = auth.uid();
  ELSE
    -- Realm: the sender, or an owner/mod of that realm.
    SELECT true INTO v_allowed FROM public.messages m
    WHERE m.id = _message_id
      AND (
        m.sender_id = auth.uid()
        OR public.is_realm_moderator(m.realm_id, auth.uid())
      );
  END IF;

  IF coalesce(v_allowed, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Only the sender or a realm admin can remove that preview';
  END IF;

  INSERT INTO public.link_preview_hides (message_id, message_scope, hidden_by)
  VALUES (_message_id, v_scope, auth.uid())
  ON CONFLICT (message_id, message_scope) DO NOTHING;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.hide_link_preview(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hide_link_preview(uuid, text) TO authenticated;

-- Realtime so a removed preview disappears for everyone.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'link_preview_hides'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.link_preview_hides;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
