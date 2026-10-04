ALTER TABLE public.group_invites
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_invites TO authenticated;
GRANT ALL ON public.group_invites TO service_role;
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_messages TO authenticated;
GRANT ALL ON public.group_messages TO service_role;

CREATE INDEX IF NOT EXISTS idx_blocks_blocker_blocked
  ON public.blocks (blocker_id, blocked_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_group_created
  ON public.group_messages (group_id, created_at DESC);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "blocks_select_own" ON public.blocks;
DROP POLICY IF EXISTS "blocks_insert_own" ON public.blocks;
DROP POLICY IF EXISTS "blocks_delete_own" ON public.blocks;
CREATE POLICY "blocks_select_own" ON public.blocks
  FOR SELECT TO authenticated
  USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);
CREATE POLICY "blocks_insert_own" ON public.blocks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = blocker_id AND blocker_id <> blocked_id);
CREATE POLICY "blocks_delete_own" ON public.blocks
  FOR DELETE TO authenticated
  USING (auth.uid() = blocker_id);

ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members read group messages" ON public.group_messages;
DROP POLICY IF EXISTS "members post group messages" ON public.group_messages;
DROP POLICY IF EXISTS "authors delete own group msgs" ON public.group_messages;
CREATE POLICY "members read group messages" ON public.group_messages
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "members post group messages" ON public.group_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND public.is_group_member(group_id, auth.uid()));
CREATE POLICY "authors delete own group msgs" ON public.group_messages
  FOR DELETE TO authenticated
  USING (auth.uid() = author_id AND public.is_group_member(group_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.accept_group_invite(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_code text := lower(btrim(_code));
  v_invite public.group_invites%ROWTYPE;
  v_group_id uuid;
  v_member_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'invalid: sign in to join this group';
  END IF;

  v_code := regexp_replace(v_code, '^.*\/join\/', '');
  v_code := split_part(split_part(v_code, '?', 1), '#', 1);

  SELECT * INTO v_invite
  FROM public.group_invites
  WHERE lower(code) = v_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid: invite not found';
  END IF;

  IF v_invite.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'revoked: invite revoked';
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at <= now() THEN
    RAISE EXCEPTION 'expired: invite expired';
  END IF;

  IF v_invite.max_uses IS NOT NULL AND v_invite.uses >= v_invite.max_uses THEN
    RAISE EXCEPTION 'expired: invite has reached its use limit';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = v_invite.group_id
      AND public.is_blocked_pair(v_actor, gm.user_id)
  ) THEN
    RAISE EXCEPTION 'blocked: you cannot join this group';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = v_invite.group_id AND user_id = v_actor
  ) THEN
    RAISE EXCEPTION 'already_member: you are already a member';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.group_members gm
    JOIN public.follows f1
      ON f1.follower_id = v_actor AND f1.following_id = gm.user_id
    JOIN public.follows f2
      ON f2.follower_id = gm.user_id AND f2.following_id = v_actor
    WHERE gm.group_id = v_invite.group_id
  ) THEN
    RAISE EXCEPTION 'not_friends: you must mutually follow at least one current member';
  END IF;

  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_invite.group_id, v_actor, 'member')
  RETURNING group_id, user_id INTO v_group_id, v_member_id;

  UPDATE public.group_invites
  SET uses = uses + 1
  WHERE id = v_invite.id;

  RETURN v_group_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'already_member: you are already a member';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_group_invite_preview(_code text)
RETURNS TABLE (
  group_id uuid,
  group_name text,
  topic text,
  icon_url text,
  accent_color text,
  member_count integer,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.id,
    g.name,
    g.topic,
    g.icon_url,
    g.accent_color,
    g.member_count,
    CASE
      WHEN i.id IS NULL THEN 'revoked_or_invalid'
      WHEN i.revoked_at IS NOT NULL THEN 'revoked_or_invalid'
      WHEN i.expires_at IS NOT NULL AND i.expires_at <= now() THEN 'expired'
      WHEN i.max_uses IS NOT NULL AND i.uses >= i.max_uses THEN 'limit_reached'
      WHEN auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = i.group_id AND gm.user_id = auth.uid()
      ) THEN 'already_member'
      ELSE 'valid'
    END
  FROM (SELECT lower(regexp_replace(split_part(split_part(btrim(_code), '?', 1), '#', 1), '^.*\/join\/', '')) AS code) input
  LEFT JOIN public.group_invites i ON lower(i.code) = input.code
  LEFT JOIN public.groups g ON g.id = i.group_id;
$$;

CREATE OR REPLACE FUNCTION public.preview_group_invite(_code text)
RETURNS TABLE (
  group_id uuid,
  group_name text,
  topic text,
  icon_url text,
  accent_color text,
  member_count integer,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.get_group_invite_preview(_code);
$$;

REVOKE ALL ON FUNCTION public.accept_group_invite(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_group_invite(text) TO authenticated;
REVOKE ALL ON FUNCTION public.get_group_invite_preview(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_invite_preview(text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.preview_group_invite(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preview_group_invite(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_blocked_pair(uuid, uuid) TO authenticated;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;