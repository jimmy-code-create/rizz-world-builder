# RIZZ frontend backend requirements

These are additive Supabase changes for the current frontend. Apply them in
Lovable/Supabase before using invite previews, per-user message deletion,
unsending, or DM image uploads. Do not drop or rename existing tables or data.
The frontend uses only browser APIs and the existing Supabase connection; no
paid APIs or AI services are required.

## 0. Account onboarding fields required by `/api/me`

The authenticated profile endpoint selects `tutorial_seen` and `interests`.
The migration `supabase/migrations/20261007100000_profile_onboarding_preferences.sql`
must be applied to the Supabase project used by the deployed app. If it is not,
the profile query fails and the app cannot route the signed-in user past the
account-loading screen.

The expected profile fields are:

```sql
ALTER TABLE public.profiles
  ALTER COLUMN username DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS tutorial_seen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}';
```

Apply the existing migration through the project's normal Supabase deployment
process; do not use browser storage as a substitute for these account fields.

## Voice relay configuration

The existing `/api/turn-credentials` route can return TURN credentials when the
deployment has `TURN_SERVER_URLS` and `TURN_SHARED_SECRET` configured. The TURN
service must support time-limited HMAC credentials. Without both settings, the
app uses STUN only, which may fail on restrictive mobile networks. Keep the
shared secret in the deployment's secret manager, never in frontend code or
committed files.

## 1. Safe group-invite previews

**Why:** The invite page must show the group and distinguish a usable, expired,
revoked/invalid, used-up, or already-joined invite without adding a visitor to
the group just by opening the link.

**Frontend expects:** RPC `preview_group_invite(_code text)` returning one row
with `status`, `group_id`, `group_name`, `topic`, `icon_url`, `accent_color`,
and `member_count`. Status values are `valid`, `already_member`, `expired`,
`limit_reached`, and `revoked_or_invalid`. A deleted invite is treated as
revoked. The existing `accept_group_invite(_code text)` remains responsible
for joining and enforcing its current membership/friends-only rules.

```sql
CREATE OR REPLACE FUNCTION public.preview_group_invite(_code text)
RETURNS TABLE (
  status text,
  group_id uuid,
  group_name text,
  topic text,
  icon_url text,
  accent_color text,
  member_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_invite public.group_invites%ROWTYPE;
  v_group public.groups%ROWTYPE;
  v_status text;
  v_code text;
BEGIN
  v_code := lower(regexp_replace(coalesce(_code, ''), '[^a-zA-Z0-9]', '', 'g'));

  SELECT i.* INTO v_invite
  FROM public.group_invites AS i
  WHERE lower(i.code) = v_code
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'revoked_or_invalid'::text, NULL::uuid, NULL::text,
      NULL::text, NULL::text, NULL::text, NULL::integer;
    RETURN;
  END IF;

  SELECT g.* INTO v_group
  FROM public.groups AS g
  WHERE g.id = v_invite.group_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'revoked_or_invalid'::text, NULL::uuid, NULL::text,
      NULL::text, NULL::text, NULL::text, NULL::integer;
    RETURN;
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at <= now() THEN
    v_status := 'expired';
  ELSIF v_invite.max_uses IS NOT NULL AND v_invite.uses >= v_invite.max_uses THEN
    v_status := 'limit_reached';
  ELSIF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.group_members AS gm
    WHERE gm.group_id = v_group.id AND gm.user_id = auth.uid()
  ) THEN
    v_status := 'already_member';
  ELSE
    v_status := 'valid';
  END IF;

  RETURN QUERY SELECT v_status, v_group.id, v_group.name, v_group.topic,
    v_group.icon_url, v_group.accent_color, v_group.member_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.preview_group_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_group_invite(text) TO anon, authenticated;
```

## 2. Delete a message for yourself or unsend it

**Why:** The current DM and group-message tables do not record a per-user hide
or an unsent state. Hard-deleting a row removes it for everyone and cannot
show the requested “This message was unsent” placeholder.

**Frontend expects:** `deleted_at` on both message tables, per-user hide tables,
and the four RPCs below. Unsend is limited to the original author and replaces
the body while clearing media. Hide is limited to an existing participant.
Only the caller can read their hide rows.

```sql
ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE TABLE IF NOT EXISTS public.direct_message_hides (
  message_id uuid NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_direct_message_hides_user_message
  ON public.direct_message_hides (user_id, message_id);

ALTER TABLE public.direct_message_hides ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.direct_message_hides TO authenticated;
DROP POLICY IF EXISTS "users read their own DM hides" ON public.direct_message_hides;
CREATE POLICY "users read their own DM hides"
  ON public.direct_message_hides FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.group_message_hides (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_message_hides_user_group_message
  ON public.group_message_hides (user_id, group_id, message_id);

ALTER TABLE public.group_message_hides ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.group_message_hides TO authenticated;
DROP POLICY IF EXISTS "users read their own group message hides" ON public.group_message_hides;
CREATE POLICY "users read their own group message hides"
  ON public.group_message_hides FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.hide_direct_message_for_me(_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.direct_messages AS dm
    WHERE dm.id = _message_id
      AND (dm.sender_id = auth.uid() OR dm.recipient_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'message not found or not available to this user';
  END IF;

  INSERT INTO public.direct_message_hides (message_id, user_id)
  VALUES (_message_id, auth.uid())
  ON CONFLICT (message_id, user_id) DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.unsend_direct_message(_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  UPDATE public.direct_messages
  SET body = 'This message was unsent',
      attachment_url = NULL,
      audio_url = NULL,
      duration_ms = NULL,
      deleted_at = now()
  WHERE id = _message_id
    AND sender_id = auth.uid()
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'message not found or you cannot unsend it';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.hide_group_message_for_me(_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_group_id uuid;
BEGIN
  SELECT gm.group_id INTO v_group_id
  FROM public.group_messages AS gm
  WHERE gm.id = _message_id;

  IF v_group_id IS NULL OR auth.uid() IS NULL
     OR NOT public.is_group_member(v_group_id, auth.uid()) THEN
    RAISE EXCEPTION 'message not found or not available to this user';
  END IF;

  INSERT INTO public.group_message_hides (group_id, message_id, user_id)
  VALUES (v_group_id, _message_id, auth.uid())
  ON CONFLICT (message_id, user_id) DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.unsend_group_message(_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  UPDATE public.group_messages
  SET body = 'This message was unsent',
      attachment_url = NULL,
      deleted_at = now()
  WHERE id = _message_id
    AND author_id = auth.uid()
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'message not found or you cannot unsend it';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.hide_direct_message_for_me(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unsend_direct_message(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hide_group_message_for_me(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unsend_group_message(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hide_direct_message_for_me(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unsend_direct_message(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hide_group_message_for_me(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unsend_group_message(uuid) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_group_messages_group_created_id
  ON public.group_messages (group_id, created_at DESC, id DESC);

ALTER TABLE public.group_messages REPLICA IDENTITY FULL;
DO $publication$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'group_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
  END IF;
END;
$publication$;
```

## 3. Direct-message image uploads

**Why:** The frontend compresses images in the browser, then uploads them to
`chat-media` before inserting the resulting public URL into the existing
`direct_messages.attachment_url` column.

**Frontend expects:** A public `chat-media` bucket and authenticated uploads
only into the caller's UUID-named folder. The browser sends JPEG files only;
this adds no external image-processing service.

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-media', 'chat-media', true, 15728640, ARRAY['image/jpeg'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "chat media upload to own folder" ON storage.objects;
CREATE POLICY "chat media upload to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "chat media delete from own folder" ON storage.objects;
CREATE POLICY "chat media delete from own folder"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

The bucket is public so existing chat rows can display their image URL without
a signed-URL refresh flow. Users must understand that anyone with an image URL
can view that image. If public media is not acceptable, do not apply this
bucket setup; the frontend will show a friendly upload error.

## Existing backend features the frontend reuses

- Group joining continues to use the existing `accept_group_invite(_code text)`
  security-definer function. Do not add a second joining path; test that the
  existing function checks expiry, use limits, friendship rules, and duplicate
  membership.
- Story replies are direct messages using the existing `direct_messages.story_id`
  column; no new reply table is required.
- Story viewer details read existing `story_views` rows and profile display
  fields. Story expiry remains the existing 24-hour `expires_at` behavior.

## Lovable apply-and-test checklist

1. Apply the SQL above as an additive migration; keep all existing rows.
2. Confirm the four RPCs and `preview_group_invite` exist, RLS is enabled on
   both hide tables, and `chat-media` has the stated upload policy.
3. Test an active invite, an expired invite, an invite opened by an existing
   member, and an invalid/revoked invite.
4. In a test DM and group, hide one message for yourself and unsend one authored
   message. Confirm the hidden row remains visible to the other participant
   and the unsent placeholder appears for both.
5. Upload one image to `chat-media` as an authenticated user and confirm a
   second user can display the posted URL.