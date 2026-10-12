-- ============================================================================
-- PHASE 2: Realm settings + moderation.
--
-- Additive and safe to re-run. Everything here is enforced in Postgres: the
-- settings page is a client for these functions, not the security boundary.
--
-- What it adds:
--   * role colours + a permission bitfield on top of owner/mod/member, so the
--     owner can grant extra rights to members and take them away from mods;
--   * AutoMod: banned words, link filter, mention-spam limit, raid mode,
--     new-account gate, verification level, warn thresholds;
--   * warn/strike points, timeouts and their automatic consequences;
--   * an audit log and a mod-log channel that receives system messages;
--   * a reports queue any member can file and moderators can act on;
--   * per-channel slowmode, privacy and ordering;
--   * ownership transfer.
-- ============================================================================

-- ------------------------------------------------------ 1. columns + tables
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS system boolean NOT NULL DEFAULT false;

-- A system line ("@x banned @y") has neither a sender nor a bot.
DO $$
BEGIN
  ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_actor_check;
  ALTER TABLE public.messages
    ADD CONSTRAINT messages_actor_check
    CHECK (sender_id IS NOT NULL OR bot_id IS NOT NULL OR system);
END $$;

ALTER TABLE public.realm_members
  ADD COLUMN IF NOT EXISTS timeout_until timestamptz,
  ADD COLUMN IF NOT EXISTS warn_points integer NOT NULL DEFAULT 0;

ALTER TABLE public.realm_rooms
  ADD COLUMN IF NOT EXISTS slowmode_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

ALTER TABLE public.realms
  ADD COLUMN IF NOT EXISTS mod_log_room_id uuid REFERENCES public.realm_rooms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verification_level integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS warn_threshold integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS warn_timeout_minutes integer NOT NULL DEFAULT 60;

DO $$
BEGIN
  ALTER TABLE public.realm_rooms DROP CONSTRAINT IF EXISTS realm_rooms_slowmode_check;
  ALTER TABLE public.realm_rooms
    ADD CONSTRAINT realm_rooms_slowmode_check
    CHECK (slowmode_seconds BETWEEN 0 AND 21600);

  ALTER TABLE public.realms DROP CONSTRAINT IF EXISTS realms_verification_check;
  ALTER TABLE public.realms
    ADD CONSTRAINT realms_verification_check
    CHECK (verification_level BETWEEN 0 AND 4);

  ALTER TABLE public.realms DROP CONSTRAINT IF EXISTS realms_warn_check;
  ALTER TABLE public.realms
    ADD CONSTRAINT realms_warn_check
    CHECK (warn_threshold BETWEEN 0 AND 20 AND warn_timeout_minutes BETWEEN 0 AND 40320);
END $$;

-- ------------------------------------- 2. role colours + permission bitfield
CREATE TABLE IF NOT EXISTS public.realm_role_settings (
  realm_id uuid NOT NULL REFERENCES public.realms(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('mod', 'member')),
  color text,
  permissions text[] NOT NULL DEFAULT '{}'::text[],
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (realm_id, role)
);

-- The permission names used everywhere below.
CREATE OR REPLACE FUNCTION public.realm_all_permissions()
RETURNS text[]
LANGUAGE sql IMMUTABLE
AS $$ SELECT ARRAY[
  'manage_realm','manage_roles','manage_channels','manage_members','manage_bots',
  'moderate_messages','manage_automod','view_audit','pin_messages',
  'bypass_slowmode','bypass_link_filter','view_private_channels'
]::text[] $$;

CREATE OR REPLACE FUNCTION public.realm_owner_permissions()
RETURNS text[]
LANGUAGE sql IMMUTABLE
AS $$ SELECT public.realm_all_permissions() || ARRAY['transfer_ownership']::text[] $$;

/** Mods keep every moderation power they already had; the owner can revoke any. */
CREATE OR REPLACE FUNCTION public.realm_default_mod_permissions()
RETURNS text[]
LANGUAGE sql IMMUTABLE
AS $$ SELECT ARRAY[
  'manage_channels','manage_members','manage_bots','moderate_messages',
  'manage_automod','view_audit','pin_messages','bypass_slowmode',
  'bypass_link_filter','view_private_channels'
]::text[] $$;

CREATE OR REPLACE FUNCTION public.realm_seed_role_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $seed$
BEGIN
  INSERT INTO public.realm_role_settings (realm_id, role, permissions)
  VALUES (NEW.id, 'mod', public.realm_default_mod_permissions()),
         (NEW.id, 'member', '{}'::text[])
  ON CONFLICT (realm_id, role) DO NOTHING;
  RETURN NEW;
END
$seed$;

DROP TRIGGER IF EXISTS realm_seed_role_settings_t ON public.realms;
CREATE TRIGGER realm_seed_role_settings_t
  AFTER INSERT ON public.realms
  FOR EACH ROW EXECUTE FUNCTION public.realm_seed_role_settings();

-- Existing realms get their defaults too.
INSERT INTO public.realm_role_settings (realm_id, role, permissions)
SELECT r.id, 'mod', public.realm_default_mod_permissions() FROM public.realms r
ON CONFLICT (realm_id, role) DO NOTHING;
INSERT INTO public.realm_role_settings (realm_id, role, permissions)
SELECT r.id, 'member', '{}'::text[] FROM public.realms r
ON CONFLICT (realm_id, role) DO NOTHING;

-- ------------------------------------------------------------- 3. automod
CREATE TABLE IF NOT EXISTS public.realm_automod (
  realm_id uuid PRIMARY KEY REFERENCES public.realms(id) ON DELETE CASCADE,
  banned_words text[] NOT NULL DEFAULT '{}'::text[],
  block_links boolean NOT NULL DEFAULT false,
  mention_limit integer NOT NULL DEFAULT 0,
  raid_mode boolean NOT NULL DEFAULT false,
  min_account_age_days integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

DO $$
BEGIN
  ALTER TABLE public.realm_automod DROP CONSTRAINT IF EXISTS realm_automod_ranges;
  ALTER TABLE public.realm_automod
    ADD CONSTRAINT realm_automod_ranges
    CHECK (mention_limit BETWEEN 0 AND 50
       AND min_account_age_days BETWEEN 0 AND 3650);
END $$;

-- ------------------------------------------------------------- 4. audit log
CREATE TABLE IF NOT EXISTS public.realm_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES public.realms(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_realm_audit_log_realm
  ON public.realm_audit_log (realm_id, created_at DESC);

-- --------------------------------------------------------------- 5. reports
CREATE TABLE IF NOT EXISTS public.realm_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES public.realms(id) ON DELETE CASCADE,
  -- SET NULL, not CASCADE: removing the reported message must not erase the
  -- report, or a moderator deleting spam would also delete the evidence.
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Snapshot of what was reported, kept so the queue still shows it afterwards.
  body_snapshot text,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

DO $$
BEGIN
  ALTER TABLE public.realm_reports DROP CONSTRAINT IF EXISTS realm_reports_status_check;
  ALTER TABLE public.realm_reports
    ADD CONSTRAINT realm_reports_status_check
    CHECK (status IN ('open', 'resolved', 'dismissed'));
END $$;

CREATE INDEX IF NOT EXISTS idx_realm_reports_open
  ON public.realm_reports (realm_id, status, created_at DESC);

-- ------------------------------------------------------------- 6. permission
/**
 * The single permission question every function below asks.
 *
 * Owner: everything. Mod: their stored permission list (defaults to every
 * moderation power, so nothing a mod could do before stops working). Member:
 * only what the owner granted them.
 */
CREATE OR REPLACE FUNCTION public.realm_can(_realm_id uuid, _user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $can$
  SELECT CASE
    WHEN _realm_id IS NULL OR _user_id IS NULL OR coalesce(_permission, '') = '' THEN false
    WHEN EXISTS (SELECT 1 FROM public.realms r WHERE r.id = _realm_id AND r.owner_id = _user_id)
      THEN true
    WHEN _permission = 'transfer_ownership' THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.realm_members m
      JOIN public.realm_role_settings s
        ON s.realm_id = m.realm_id AND s.role = m.role::text
      WHERE m.realm_id = _realm_id
        AND m.user_id = _user_id
        AND _permission = ANY (s.permissions)
    )
  END
$can$;

/** Owner or mod: the "may moderate" question the older sheets ask. */
CREATE OR REPLACE FUNCTION public.realm_can_moderate(_realm_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $mod$
  SELECT CASE
    WHEN _realm_id IS NULL OR _user_id IS NULL THEN false
    WHEN EXISTS (SELECT 1 FROM public.realms r WHERE r.id = _realm_id AND r.owner_id = _user_id)
      THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.realm_members m
      WHERE m.realm_id = _realm_id AND m.user_id = _user_id AND m.role::text = 'mod'
    )
  END
$mod$;

-- ------------------------------------------------- 7. system + audit writer
/**
 * A system line in a realm: "@x banned @y" and friends. Only these SECURITY
 * DEFINER functions may write one — clients stay unable to fake one.
 */
CREATE OR REPLACE FUNCTION public.realm_system_message(
  _realm_id uuid,
  _realm_room_id uuid,
  _body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $sys$
DECLARE
  v_id uuid;
BEGIN
  IF _realm_id IS NULL OR coalesce(btrim(_body), '') = '' THEN RETURN NULL; END IF;

  PERFORM set_config('rizz.system_writer', 'on', true);
  INSERT INTO public.messages (realm_id, realm_room_id, sender_id, bot_id, body, system)
  VALUES (_realm_id, _realm_room_id, NULL, NULL, left(_body, 2000), true)
  RETURNING id INTO v_id;
  PERFORM set_config('rizz.system_writer', 'off', true);

  RETURN v_id;
END
$sys$;

REVOKE ALL ON FUNCTION public.realm_system_message(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

/** Writes the audit row and, when a mod-log channel is set, the system line. */
CREATE OR REPLACE FUNCTION public.realm_audit(
  _realm_id uuid,
  _actor uuid,
  _action text,
  _target_user uuid,
  _detail text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $audit$
DECLARE
  v_room uuid;
BEGIN
  IF _realm_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.realm_audit_log (realm_id, actor_id, action, target_user_id, detail)
  VALUES (_realm_id, _actor, left(coalesce(_action, 'unknown'), 60), _target_user, left(_detail, 500));

  SELECT mod_log_room_id INTO v_room FROM public.realms WHERE id = _realm_id;
  IF v_room IS NOT NULL THEN
    PERFORM public.realm_system_message(_realm_id, v_room, left(coalesce(_detail, _action), 500));
  END IF;
END
$audit$;

REVOKE ALL ON FUNCTION public.realm_audit(uuid, uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------- 8. the settings payload the page reads
CREATE OR REPLACE FUNCTION public.realm_settings(_realm_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $settings$
DECLARE
  v_user uuid := auth.uid();
  v_realm public.realms;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in first');
  END IF;
  IF NOT public.is_realm_member(_realm_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Join this realm first');
  END IF;

  SELECT * INTO v_realm FROM public.realms WHERE id = _realm_id;
  IF v_realm.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That realm is gone');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'realm', jsonb_build_object(
      'id', v_realm.id,
      'slug', v_realm.slug,
      'name', v_realm.name,
      'topic', v_realm.topic,
      'icon_url', v_realm.icon_url,
      'accent_color', v_realm.accent_color,
      'owner_id', v_realm.owner_id,
      'member_count', v_realm.member_count,
      'mod_log_room_id', v_realm.mod_log_room_id,
      'verification_level', v_realm.verification_level,
      'warn_threshold', v_realm.warn_threshold,
      'warn_timeout_minutes', v_realm.warn_timeout_minutes
    ),
    'my_role', public.realm_role_of(_realm_id, v_user),
    'permissions', coalesce(
      (
        SELECT to_jsonb(array_agg(p)) FROM unnest(public.realm_all_permissions()) AS p
        WHERE public.realm_can(_realm_id, v_user, p)
      ),
      '[]'::jsonb
    ),
    'roles', coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object('role', s.role, 'color', s.color, 'permissions', s.permissions)
          ORDER BY s.role
        )
        FROM public.realm_role_settings s WHERE s.realm_id = _realm_id
      ),
      '[]'::jsonb
    ),
    'automod', coalesce(
      (
        SELECT jsonb_build_object(
          'banned_words', a.banned_words,
          'block_links', a.block_links,
          'mention_limit', a.mention_limit,
          'raid_mode', a.raid_mode,
          'min_account_age_days', a.min_account_age_days
        )
        FROM public.realm_automod a WHERE a.realm_id = _realm_id
      ),
      jsonb_build_object(
        'banned_words', '[]'::jsonb, 'block_links', false, 'mention_limit', 0,
        'raid_mode', false, 'min_account_age_days', 0
      )
    ),
    'counts', jsonb_build_object(
      'open_reports', (SELECT count(*) FROM public.realm_reports r
                       WHERE r.realm_id = _realm_id AND r.status = 'open'),
      'bans', (SELECT count(*) FROM public.realm_bans b WHERE b.realm_id = _realm_id),
      'invites', (SELECT count(*) FROM public.realm_invites i WHERE i.realm_id = _realm_id),
      'installed_bots', (SELECT count(*) FROM public.realm_bot_installs i WHERE i.realm_id = _realm_id)
    )
  );
END
$settings$;

-- ------------------------------------------------------- 9. overview + roles
CREATE OR REPLACE FUNCTION public.update_realm_overview(
  _realm_id uuid,
  _name text,
  _topic text,
  _icon_url text,
  _accent_color text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $overview$
DECLARE
  v_name text := btrim(coalesce(_name, ''));
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;
  IF NOT public.realm_can(_realm_id, auth.uid(), 'manage_realm') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot edit this realm');
  END IF;
  IF char_length(v_name) < 2 OR char_length(v_name) > 40 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A realm name is 2-40 characters');
  END IF;
  IF char_length(coalesce(_topic, '')) > 160 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Keep the description under 160 characters');
  END IF;

  UPDATE public.realms
  SET name = v_name,
      topic = nullif(btrim(coalesce(_topic, '')), ''),
      icon_url = nullif(btrim(coalesce(_icon_url, '')), ''),
      accent_color = nullif(btrim(coalesce(_accent_color, '')), ''),
      updated_at = now()
  WHERE id = _realm_id;

  PERFORM public.realm_audit(_realm_id, auth.uid(), 'realm.update', NULL,
    'Realm details updated by ' || coalesce((SELECT coalesce(p.display_name, p.username) FROM public.profiles p WHERE p.id = auth.uid()), 'someone'));

  RETURN jsonb_build_object('ok', true);
END
$overview$;

CREATE OR REPLACE FUNCTION public.set_realm_role_settings(
  _realm_id uuid,
  _role text,
  _color text,
  _permissions text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $roleset$
DECLARE
  v_role text := lower(btrim(coalesce(_role, '')));
  v_perms text[];
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;
  IF NOT public.realm_can(_realm_id, auth.uid(), 'manage_roles') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only the owner can change roles');
  END IF;
  IF v_role NOT IN ('mod', 'member') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That role cannot be edited');
  END IF;

  SELECT coalesce(array_agg(DISTINCT p ORDER BY p), '{}'::text[])
  INTO v_perms
  FROM unnest(coalesce(_permissions, '{}'::text[])) AS p
  WHERE p = ANY (public.realm_all_permissions());

  INSERT INTO public.realm_role_settings (realm_id, role, color, permissions, updated_at)
  VALUES (_realm_id, v_role, nullif(btrim(coalesce(_color, '')), ''), v_perms, now())
  ON CONFLICT (realm_id, role) DO UPDATE
  SET color = excluded.color, permissions = excluded.permissions, updated_at = now();

  PERFORM public.realm_audit(_realm_id, auth.uid(), 'role.update', NULL,
    'Role "' || v_role || '" updated (' || coalesce(array_length(v_perms, 1), 0) || ' permissions)');

  RETURN jsonb_build_object('ok', true, 'permissions', to_jsonb(v_perms));
END
$roleset$;

-- --------------------------------------------------------------- 10. automod
CREATE OR REPLACE FUNCTION public.set_realm_automod(
  _realm_id uuid,
  _banned_words text[],
  _block_links boolean,
  _mention_limit integer,
  _raid_mode boolean,
  _min_account_age_days integer,
  _verification_level integer,
  _mod_log_room_id uuid,
  _warn_threshold integer,
  _warn_timeout_minutes integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $automod$
DECLARE
  v_words text[];
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;
  IF NOT public.realm_can(_realm_id, auth.uid(), 'manage_automod') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot change AutoMod here');
  END IF;
  IF _mod_log_room_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.realm_rooms r
    WHERE r.id = _mod_log_room_id AND r.realm_id = _realm_id AND r.kind <> 'voice'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pick a text channel of this realm for the mod log');
  END IF;

  SELECT coalesce(array_agg(DISTINCT lower(btrim(w)) ORDER BY lower(btrim(w))), '{}'::text[])
  INTO v_words
  FROM unnest(coalesce(_banned_words, '{}'::text[])) AS w
  WHERE btrim(w) <> '' AND char_length(btrim(w)) <= 40;

  INSERT INTO public.realm_automod (
    realm_id, banned_words, block_links, mention_limit, raid_mode,
    min_account_age_days, updated_at, updated_by
  )
  VALUES (
    _realm_id, coalesce(v_words, '{}'::text[]), coalesce(_block_links, false),
    greatest(0, least(coalesce(_mention_limit, 0), 50)), coalesce(_raid_mode, false),
    greatest(0, least(coalesce(_min_account_age_days, 0), 3650)), now(), auth.uid()
  )
  ON CONFLICT (realm_id) DO UPDATE
  SET banned_words = excluded.banned_words,
      block_links = excluded.block_links,
      mention_limit = excluded.mention_limit,
      raid_mode = excluded.raid_mode,
      min_account_age_days = excluded.min_account_age_days,
      updated_at = now(),
      updated_by = auth.uid();

  UPDATE public.realms
  SET verification_level = greatest(0, least(coalesce(_verification_level, 0), 4)),
      mod_log_room_id = _mod_log_room_id,
      warn_threshold = greatest(0, least(coalesce(_warn_threshold, 3), 20)),
      warn_timeout_minutes = greatest(0, least(coalesce(_warn_timeout_minutes, 60), 40320)),
      updated_at = now()
  WHERE id = _realm_id;

  PERFORM public.realm_audit(_realm_id, auth.uid(), 'automod.update', NULL, 'AutoMod settings updated');

  RETURN jsonb_build_object('ok', true, 'banned_words', to_jsonb(coalesce(v_words, '{}'::text[])));
END
$automod$;

-- --------------------------------- 11. enforcement on every human message
/**
 * AutoMod, timeouts, verification and slowmode, applied to human messages.
 *
 * Messages from the bot API (`bot_id`) and system lines are exempt: they are
 * already written by trusted SECURITY DEFINER code.
 */
CREATE OR REPLACE FUNCTION public.realm_message_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $guard$
DECLARE
  v_am public.realm_automod;
  v_realm public.realms;
  v_body text := coalesce(NEW.body, '');
  v_words text[];
  v_mentions integer;
  v_slow integer;
  v_age interval;
  v_joined interval;
  v_label text;
BEGIN
  IF NEW.system OR NEW.sender_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.realm_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_realm FROM public.realms WHERE id = NEW.realm_id;
  IF v_realm.id IS NULL THEN RETURN NEW; END IF;

  v_label := coalesce((SELECT coalesce(p.display_name, p.username, 'member')
                       FROM public.profiles p WHERE p.id = NEW.sender_id), 'member');

  -- A timeout silences everything but the moderators.
  IF EXISTS (
    SELECT 1 FROM public.realm_members m
    WHERE m.realm_id = NEW.realm_id AND m.user_id = NEW.sender_id AND m.timeout_until > now()
  ) AND NOT public.realm_can(NEW.realm_id, NEW.sender_id, 'moderate_messages') THEN
    RAISE EXCEPTION 'You are timed out in this realm';
  END IF;

  -- Verification levels: 1 account > 5 min, 2 member > 5 min, 3 member > 10 min,
  -- 4 account > 1 day. Links and media need level 3 or higher.
  IF v_realm.verification_level >= 1 THEN
    SELECT now() - u.created_at INTO v_age FROM auth.users u WHERE u.id = NEW.sender_id;
    SELECT now() - m.joined_at INTO v_joined
    FROM public.realm_members m WHERE m.realm_id = NEW.realm_id AND m.user_id = NEW.sender_id;
    IF v_realm.verification_level >= 4 AND coalesce(v_age, interval '0') < interval '1 day' THEN
      RAISE EXCEPTION 'This realm asks for an account older than a day before posting';
    ELSIF v_realm.verification_level = 3 AND coalesce(v_joined, interval '0') < interval '10 minutes'
      AND NOT public.realm_can(NEW.realm_id, NEW.sender_id, 'moderate_messages') THEN
      RAISE EXCEPTION 'This realm asks for 10 minutes of membership before posting';
    ELSIF v_realm.verification_level = 2 AND coalesce(v_joined, interval '0') < interval '5 minutes'
      AND NOT public.realm_can(NEW.realm_id, NEW.sender_id, 'moderate_messages') THEN
      RAISE EXCEPTION 'This realm asks for 5 minutes of membership before posting';
    ELSIF v_realm.verification_level = 1 AND coalesce(v_age, interval '0') < interval '5 minutes'
      AND NOT public.realm_can(NEW.realm_id, NEW.sender_id, 'moderate_messages') THEN
      RAISE EXCEPTION 'This realm asks for an account a few minutes old before posting';
    END IF;
  END IF;

  -- Slowmode is per channel and per member.
  IF NEW.realm_room_id IS NOT NULL THEN
    SELECT r.slowmode_seconds INTO v_slow FROM public.realm_rooms r WHERE r.id = NEW.realm_room_id;
    IF coalesce(v_slow, 0) > 0 AND NOT public.realm_can(NEW.realm_id, NEW.sender_id, 'bypass_slowmode') THEN
      IF EXISTS (
        SELECT 1 FROM public.messages m
        WHERE m.realm_room_id = NEW.realm_room_id
          AND m.sender_id = NEW.sender_id
          AND m.created_at > now() - make_interval(secs => v_slow)
      ) THEN
        RAISE EXCEPTION 'Slowmode: wait %s before posting again here', v_slow;
      END IF;
    END IF;
  END IF;

  SELECT * INTO v_am FROM public.realm_automod WHERE realm_id = NEW.realm_id;

  IF v_am.realm_id IS NOT NULL THEN
    IF v_am.min_account_age_days > 0 AND NOT public.realm_can(NEW.realm_id, NEW.sender_id, 'moderate_messages') THEN
      IF EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = NEW.sender_id
          AND u.created_at > now() - make_interval(days => v_am.min_account_age_days)
      ) THEN
        RAISE EXCEPTION 'This realm only allows accounts older than % day(s)', v_am.min_account_age_days;
      END IF;
    END IF;

    IF v_am.raid_mode AND NOT public.realm_can(NEW.realm_id, NEW.sender_id, 'moderate_messages') THEN
      IF EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = NEW.sender_id AND u.created_at > now() - interval '1 day'
      ) THEN
        RAISE EXCEPTION 'Raid mode: this realm is only accepting older accounts right now';
      END IF;
      IF (SELECT count(*) FROM public.messages m
          WHERE m.realm_id = NEW.realm_id AND m.sender_id = NEW.sender_id
            AND m.created_at > now() - interval '1 minute') >= 5 THEN
        RAISE EXCEPTION 'Raid mode: you are posting too fast';
      END IF;
    END IF;

    v_words := v_am.banned_words;
    IF coalesce(array_length(v_words, 1), 0) > 0 AND EXISTS (
      SELECT 1 FROM unnest(v_words) AS w
      WHERE v_body ~* ('(^|[^a-z0-9])' || regexp_replace(w, '([\\^$.|?*+()\[\]{}])', '\\\1', 'g') || '([^a-z0-9]|$)')
    ) THEN
      RAISE EXCEPTION 'AutoMod: that message contains a blocked word';
    END IF;

    IF v_am.block_links
      AND v_body ~* '(https?://|www\.)' 
      AND NOT public.realm_can(NEW.realm_id, NEW.sender_id, 'bypass_link_filter')
      AND NOT public.realm_can(NEW.realm_id, NEW.sender_id, 'moderate_messages')
    THEN
      RAISE EXCEPTION 'AutoMod: links are not allowed in this realm';
    END IF;

    IF v_am.mention_limit > 0 AND NOT public.realm_can(NEW.realm_id, NEW.sender_id, 'moderate_messages') THEN
      SELECT count(*) INTO v_mentions FROM regexp_matches(v_body, '@[a-zA-Z0-9_]{2,32}', 'g');
      IF v_mentions > v_am.mention_limit THEN
        RAISE EXCEPTION 'AutoMod: that is more than % mention(s)', v_am.mention_limit;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END
$guard$;

DROP TRIGGER IF EXISTS realm_message_guard_t ON public.messages;
CREATE TRIGGER realm_message_guard_t
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.realm_message_guard();

REVOKE ALL ON FUNCTION public.realm_message_guard() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------ 12. warns, timeouts, bans
CREATE OR REPLACE FUNCTION public.warn_realm_member(
  _realm_id uuid,
  _user_id uuid,
  _reason text,
  _points integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $warn$
DECLARE
  v_points integer := greatest(1, least(coalesce(_points, 1), 10));
  v_total integer;
  v_realm public.realms;
  v_threshold integer;
  v_minutes integer;
  v_name text;
  v_actor text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;
  IF NOT public.realm_can(_realm_id, auth.uid(), 'manage_members') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot warn people here');
  END IF;
  IF _user_id = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot warn yourself');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.realm_members m WHERE m.realm_id = _realm_id AND m.user_id = _user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That person is not in this realm');
  END IF;
  IF EXISTS (SELECT 1 FROM public.realms r WHERE r.id = _realm_id AND r.owner_id = _user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot warn the realm owner');
  END IF;

  UPDATE public.realm_members
  SET warn_points = warn_points + v_points
  WHERE realm_id = _realm_id AND user_id = _user_id
  RETURNING warn_points INTO v_total;

  SELECT * INTO v_realm FROM public.realms WHERE id = _realm_id;
  v_threshold := coalesce(v_realm.warn_threshold, 3);
  v_minutes := coalesce(v_realm.warn_timeout_minutes, 60);

  SELECT coalesce(p.display_name, p.username, 'someone') INTO v_name
  FROM public.profiles p WHERE p.id = _user_id;
  SELECT coalesce(p.display_name, p.username, 'a moderator') INTO v_actor
  FROM public.profiles p WHERE p.id = auth.uid();

  PERFORM public.realm_audit(_realm_id, auth.uid(), 'member.warn', _user_id,
    '🛡 ' || v_actor || ' warned ' || v_name || ' (+' || v_points || ')' ||
    CASE WHEN coalesce(btrim(_reason), '') <> '' THEN ' — ' || btrim(_reason) ELSE '' END);

  -- Strike threshold: a timeout, and the counter starts over.
  IF v_threshold > 0 AND v_total >= v_threshold THEN
    UPDATE public.realm_members
    SET timeout_until = now() + make_interval(mins => v_minutes), warn_points = 0
    WHERE realm_id = _realm_id AND user_id = _user_id;

    PERFORM public.realm_audit(_realm_id, auth.uid(), 'member.timeout', _user_id,
      '🛡 ' || v_name || ' hit ' || v_threshold || ' warns and is timed out for ' || v_minutes || ' minute(s)');

    RETURN jsonb_build_object('ok', true, 'points', 0, 'timed_out', true,
      'timeout_minutes', v_minutes, 'message', v_name || ' timed out for ' || v_minutes || ' minute(s)');
  END IF;

  RETURN jsonb_build_object('ok', true, 'points', v_total, 'timed_out', false,
    'message', v_name || ' now has ' || v_total || ' warn point(s)');
END
$warn$;

CREATE OR REPLACE FUNCTION public.clear_realm_warns(_realm_id uuid, _user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $clear$
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;
  IF NOT public.realm_can(_realm_id, auth.uid(), 'manage_members') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot change warns here');
  END IF;

  UPDATE public.realm_members
  SET warn_points = 0, timeout_until = NULL
  WHERE realm_id = _realm_id AND user_id = _user_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'That person is not in this realm'); END IF;

  PERFORM public.realm_audit(_realm_id, auth.uid(), 'member.clear_warns', _user_id, 'Warns cleared');
  RETURN jsonb_build_object('ok', true);
END
$clear$;

CREATE OR REPLACE FUNCTION public.timeout_realm_member(
  _realm_id uuid,
  _user_id uuid,
  _minutes integer,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $timeout$
DECLARE
  v_minutes integer := greatest(0, least(coalesce(_minutes, 10), 40320));
  v_name text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;
  IF NOT public.realm_can(_realm_id, auth.uid(), 'manage_members') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot time people out here');
  END IF;
  IF v_minutes = 0 THEN
    RETURN public.clear_realm_warns(_realm_id, _user_id);
  END IF;
  IF EXISTS (SELECT 1 FROM public.realms r WHERE r.id = _realm_id AND r.owner_id = _user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot time out the realm owner');
  END IF;

  UPDATE public.realm_members
  SET timeout_until = now() + make_interval(mins => v_minutes)
  WHERE realm_id = _realm_id AND user_id = _user_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'That person is not in this realm'); END IF;

  SELECT coalesce(p.display_name, p.username, 'someone') INTO v_name
  FROM public.profiles p WHERE p.id = _user_id;

  PERFORM public.realm_audit(_realm_id, auth.uid(), 'member.timeout', _user_id,
    '🛡 ' || v_name || ' timed out for ' || v_minutes || ' minute(s)' ||
    CASE WHEN coalesce(btrim(_reason), '') <> '' THEN ' — ' || btrim(_reason) ELSE '' END);

  RETURN jsonb_build_object('ok', true, 'timeout_minutes', v_minutes);
END
$timeout$;

CREATE OR REPLACE FUNCTION public.realm_member_status(_realm_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $status$
BEGIN
  IF NOT public.realm_can(_realm_id, auth.uid(), 'manage_members') THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN coalesce(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', m.user_id,
          'warn_points', m.warn_points,
          'timeout_until', m.timeout_until
        )
      )
      FROM public.realm_members m
      WHERE m.realm_id = _realm_id AND (m.warn_points > 0 OR m.timeout_until IS NOT NULL)
    ),
    '[]'::jsonb
  );
END
$status$;

CREATE OR REPLACE FUNCTION public.list_realm_bans(_realm_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $bans$
BEGIN
  IF NOT public.realm_can(_realm_id, auth.uid(), 'moderate_messages') THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN coalesce(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', b.user_id,
          'reason', b.reason,
          'created_at', b.created_at,
          'username', p.username,
          'display_name', p.display_name,
          'avatar_url', p.avatar_url
        )
        ORDER BY b.created_at DESC
      )
      FROM public.realm_bans b
      LEFT JOIN public.profiles p ON p.id = b.user_id
      WHERE b.realm_id = _realm_id
    ),
    '[]'::jsonb
  );
END
$bans$;

-- --------------------------------------------------------- 13. invites list
CREATE OR REPLACE FUNCTION public.list_realm_invites(_realm_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $invites$
BEGIN
  IF NOT public.realm_can(_realm_id, auth.uid(), 'manage_members') THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN coalesce(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'code', i.code,
          'expires_at', i.expires_at,
          'max_uses', i.max_uses,
          'uses', i.uses,
          'is_active', i.is_active,
          'created_at', i.created_at
        )
        ORDER BY i.created_at DESC
      )
      FROM public.realm_invites i
      WHERE i.realm_id = _realm_id
    ),
    '[]'::jsonb
  );
END
$invites$;

-- ---------------------------------------------------------- 14. reports queue
CREATE OR REPLACE FUNCTION public.report_realm_message(_message_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $report$
DECLARE
  v_realm uuid;
  v_sender uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;

  SELECT m.realm_id, m.sender_id INTO v_realm, v_sender
  FROM public.messages m WHERE m.id = _message_id;
  IF v_realm IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That message is gone');
  END IF;
  IF NOT public.is_realm_member(v_realm) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You are not in this realm');
  END IF;
  IF v_sender = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot report your own message');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.realm_reports r
    WHERE r.message_id = _message_id AND r.reporter_id = auth.uid() AND r.status = 'open'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You already reported this message');
  END IF;

  INSERT INTO public.realm_reports (realm_id, message_id, reporter_id, reason, body_snapshot)
  VALUES (
    v_realm, _message_id, auth.uid(), left(coalesce(_reason, ''), 280),
    left(coalesce((SELECT m.body FROM public.messages m WHERE m.id = _message_id), ''), 500)
  );

  RETURN jsonb_build_object('ok', true);
END
$report$;

CREATE OR REPLACE FUNCTION public.list_realm_reports(_realm_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $reports$
BEGIN
  IF NOT public.realm_can(_realm_id, auth.uid(), 'moderate_messages') THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN coalesce(
    (
      SELECT jsonb_agg(entry ORDER BY entry->>'created_at' DESC)
      FROM (
        SELECT jsonb_build_object(
          'id', r.id,
          'status', r.status,
          'reason', r.reason,
          'resolution', r.resolution,
          'created_at', r.created_at,
          'message_id', r.message_id,
          'body', coalesce(m.body, r.body_snapshot),
          'deleted', (m.id IS NULL),
          'reporter', coalesce(rp.display_name, rp.username),
          'author_id', m.sender_id,
          'author', coalesce(ap.display_name, ap.username)
        ) AS entry
        FROM public.realm_reports r
        LEFT JOIN public.messages m ON m.id = r.message_id
        LEFT JOIN public.profiles rp ON rp.id = r.reporter_id
        LEFT JOIN public.profiles ap ON ap.id = m.sender_id
        WHERE r.realm_id = _realm_id AND r.status = 'open'
      ) rows
    ),
    '[]'::jsonb
  );
END
$reports$;

CREATE OR REPLACE FUNCTION public.moderate_delete_message(_message_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $del$
DECLARE
  v_realm uuid;
  v_body text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;

  SELECT m.realm_id, m.body INTO v_realm, v_body FROM public.messages m WHERE m.id = _message_id;
  IF v_realm IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That message is already gone');
  END IF;
  IF NOT public.realm_can(v_realm, auth.uid(), 'moderate_messages') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot moderate this realm');
  END IF;

  DELETE FROM public.messages WHERE id = _message_id;
  PERFORM public.realm_audit(v_realm, auth.uid(), 'message.delete', NULL,
    '🛡 Message removed' || CASE WHEN coalesce(btrim(_reason), '') <> '' THEN ' — ' || btrim(_reason) ELSE '' END ||
    ' (was: ' || left(coalesce(v_body, ''), 120) || ')');

  RETURN jsonb_build_object('ok', true);
END
$del$;

CREATE OR REPLACE FUNCTION public.resolve_realm_report(_report_id uuid, _resolution text DEFAULT 'dismissed')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $resolve$
DECLARE
  v_report public.realm_reports;
  v_status text := CASE WHEN lower(btrim(coalesce(_resolution, ''))) = 'actioned' THEN 'resolved' ELSE 'dismissed' END;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;

  SELECT * INTO v_report FROM public.realm_reports WHERE id = _report_id;
  IF v_report.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That report is gone');
  END IF;
  IF NOT public.realm_can(v_report.realm_id, auth.uid(), 'moderate_messages') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot moderate this realm');
  END IF;

  UPDATE public.realm_reports
  SET status = v_status, resolved_by = auth.uid(), resolution = v_status, resolved_at = now()
  WHERE id = _report_id;

  PERFORM public.realm_audit(v_report.realm_id, auth.uid(), 'report.' || v_status, v_report.reporter_id,
    '🛡 Report ' || v_status);

  RETURN jsonb_build_object('ok', true, 'status', v_status);
END
$resolve$;

-- ---------------------------------------------------------- 15. audit log read
CREATE OR REPLACE FUNCTION public.realm_audit_log(_realm_id uuid, _limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $log$
BEGIN
  IF NOT public.realm_can(_realm_id, auth.uid(), 'view_audit') THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN coalesce(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'action', a.action,
          'detail', a.detail,
          'created_at', a.created_at,
          'actor', coalesce(ap.display_name, ap.username),
          'target', coalesce(tp.display_name, tp.username)
        )
        ORDER BY a.created_at DESC
      )
      FROM (
        SELECT * FROM public.realm_audit_log l
        WHERE l.realm_id = _realm_id
        ORDER BY l.created_at DESC
        LIMIT greatest(1, least(coalesce(_limit, 100), 300))
      ) a
      LEFT JOIN public.profiles ap ON ap.id = a.actor_id
      LEFT JOIN public.profiles tp ON tp.id = a.target_user_id
    ),
    '[]'::jsonb
  );
END
$log$;

-- --------------------------------------------------- 16. channels + transfer
CREATE OR REPLACE FUNCTION public.update_realm_room_settings(
  _room_id uuid,
  _name text,
  _topic text,
  _slowmode_seconds integer,
  _is_private boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $room$
DECLARE
  v_realm uuid;
  v_name text := btrim(coalesce(_name, ''));
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;

  SELECT r.realm_id INTO v_realm FROM public.realm_rooms r WHERE r.id = _room_id;
  IF v_realm IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'That channel is gone'); END IF;
  IF NOT public.realm_can(v_realm, auth.uid(), 'manage_channels') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot change channels here');
  END IF;
  IF char_length(v_name) < 1 OR char_length(v_name) > 40 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A channel name is 1-40 characters');
  END IF;
  IF EXISTS (SELECT 1 FROM public.realm_rooms r WHERE r.realm_id = v_realm AND r.name = v_name AND r.id <> _room_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This realm already has a channel with that name');
  END IF;

  UPDATE public.realm_rooms
  SET name = v_name,
      topic = nullif(btrim(coalesce(_topic, '')), ''),
      slowmode_seconds = greatest(0, least(coalesce(_slowmode_seconds, 0), 21600)),
      is_private = coalesce(_is_private, false)
  WHERE id = _room_id;

  PERFORM public.realm_audit(v_realm, auth.uid(), 'channel.update', NULL, 'Channel "' || v_name || '" updated');
  RETURN jsonb_build_object('ok', true);
END
$room$;

CREATE OR REPLACE FUNCTION public.reorder_realm_rooms(_realm_id uuid, _room_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $reorder$
DECLARE
  v_id uuid;
  v_position integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;
  IF NOT public.realm_can(_realm_id, auth.uid(), 'manage_channels') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot reorder channels here');
  END IF;

  FOREACH v_id IN ARRAY coalesce(_room_ids, '{}'::uuid[])
  LOOP
    UPDATE public.realm_rooms SET position = v_position
    WHERE id = v_id AND realm_id = _realm_id;
    v_position := v_position + 1;
  END LOOP;

  PERFORM public.realm_audit(_realm_id, auth.uid(), 'channel.reorder', NULL, 'Channels reordered');
  RETURN jsonb_build_object('ok', true);
END
$reorder$;

CREATE OR REPLACE FUNCTION public.transfer_realm_ownership(_realm_id uuid, _user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $transfer$
DECLARE
  v_old uuid := auth.uid();
  v_name text;
BEGIN
  IF v_old IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.realms r WHERE r.id = _realm_id AND r.owner_id = v_old) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only the realm owner can transfer it');
  END IF;
  IF _user_id = v_old THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You already own this realm');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.realm_members m WHERE m.realm_id = _realm_id AND m.user_id = _user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That person must be a member first');
  END IF;

  UPDATE public.realms SET owner_id = _user_id, updated_at = now() WHERE id = _realm_id;

  INSERT INTO public.realm_members (realm_id, user_id, role)
  VALUES (_realm_id, _user_id, 'owner')
  ON CONFLICT (realm_id, user_id) DO UPDATE SET role = 'owner';
  UPDATE public.realm_members SET role = 'member'
  WHERE realm_id = _realm_id AND user_id = v_old;

  SELECT coalesce(p.display_name, p.username, 'someone') INTO v_name
  FROM public.profiles p WHERE p.id = _user_id;

  PERFORM public.realm_audit(_realm_id, v_old, 'realm.transfer', _user_id, '👑 Ownership transferred to ' || v_name);
  RETURN jsonb_build_object('ok', true);
END
$transfer$;

-- ------------------------------------------------- 17. RLS + grants + realtime
DO $rls$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['realm_role_settings', 'realm_automod', 'realm_audit_log', 'realm_reports']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
  END LOOP;
END
$rls$;

ALTER TABLE public.realm_audit_log REPLICA IDENTITY FULL;
ALTER TABLE public.realm_reports REPLICA IDENTITY FULL;
ALTER TABLE public.realm_role_settings REPLICA IDENTITY FULL;

-- Role settings and AutoMod are readable by members: the settings page shows
-- what everyone is allowed to do.
DROP POLICY IF EXISTS realm_role_settings_read ON public.realm_role_settings;
CREATE POLICY realm_role_settings_read ON public.realm_role_settings
  FOR SELECT TO authenticated
  USING (public.is_realm_member(realm_id));

DROP POLICY IF EXISTS realm_automod_read ON public.realm_automod;
CREATE POLICY realm_automod_read ON public.realm_automod
  FOR SELECT TO authenticated
  USING (public.realm_can(realm_id, auth.uid(), 'manage_automod'));

-- The audit log and the report queue are for moderators only.
DROP POLICY IF EXISTS realm_audit_log_read ON public.realm_audit_log;
CREATE POLICY realm_audit_log_read ON public.realm_audit_log
  FOR SELECT TO authenticated
  USING (public.realm_can(realm_id, auth.uid(), 'view_audit'));

DROP POLICY IF EXISTS realm_reports_read ON public.realm_reports;
CREATE POLICY realm_reports_read ON public.realm_reports
  FOR SELECT TO authenticated
  USING (
    public.realm_can(realm_id, auth.uid(), 'moderate_messages')
    OR reporter_id = auth.uid()
  );

DO $pub$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['realm_reports', 'realm_audit_log', 'realm_role_settings']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END
$pub$;

-- Private channels: the room row itself is hidden from members who may not see
-- it. Replaces the earlier policy, which let every member read every room.
DROP POLICY IF EXISTS "realm_rooms readable" ON public.realm_rooms;
DROP POLICY IF EXISTS "realm rooms readable by members" ON public.realm_rooms;
CREATE POLICY realm_rooms_read ON public.realm_rooms
  FOR SELECT TO authenticated
  USING (
    (
      NOT is_private
      OR public.realm_can(realm_id, auth.uid(), 'view_private_channels')
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.realms r
        WHERE r.id = realm_rooms.realm_id
          AND (r.is_public OR public.is_realm_member(realm_rooms.realm_id))
      )
    )
  );

-- ------------------------------------------- 18. grants on the new functions
REVOKE ALL ON FUNCTION public.realm_can(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.realm_can_moderate(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.realm_settings(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_realm_overview(uuid, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_realm_role_settings(uuid, text, text, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_realm_automod(uuid, text[], boolean, integer, boolean, integer, integer, uuid, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.warn_realm_member(uuid, uuid, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clear_realm_warns(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.timeout_realm_member(uuid, uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.realm_member_status(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_realm_bans(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_realm_invites(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_realm_message(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_realm_reports(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moderate_delete_message(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_realm_report(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.realm_audit_log(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_realm_room_settings(uuid, text, text, integer, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reorder_realm_rooms(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transfer_realm_ownership(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.realm_can(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.realm_can_moderate(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.realm_settings(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_realm_overview(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_realm_role_settings(uuid, text, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_realm_automod(uuid, text[], boolean, integer, boolean, integer, integer, uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.warn_realm_member(uuid, uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_realm_warns(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.timeout_realm_member(uuid, uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.realm_member_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_realm_bans(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_realm_invites(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_realm_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_realm_reports(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_delete_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_realm_report(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.realm_audit_log(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_realm_room_settings(uuid, text, text, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_realm_rooms(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_realm_ownership(uuid, uuid) TO authenticated;

-- Existing moderation RPCs now answer to the permission bitfield too, so a
-- member the owner promoted (or a mod they demoted) is respected everywhere.
CREATE OR REPLACE FUNCTION public.messages_guard_bot_actor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $guard$
BEGIN
  -- System lines ("🛡 …") belong to the audit writer only.
  IF NEW.system AND coalesce(current_setting('rizz.system_writer', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Only the realm tools can write a system message';
  END IF;

  IF coalesce(current_setting('rizz.bot_writer', true), '') = 'on'
     OR coalesce(current_setting('rizz.system_writer', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.bot_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only the bot API can post as a bot';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.bot_id IS DISTINCT FROM OLD.bot_id THEN
    RAISE EXCEPTION 'Only the bot API can change who wrote a message';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.system IS DISTINCT FROM OLD.system THEN
    RAISE EXCEPTION 'A message cannot be turned into a system line';
  END IF;
  RETURN NEW;
END
$guard$;

REVOKE ALL ON FUNCTION public.messages_guard_bot_actor() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
