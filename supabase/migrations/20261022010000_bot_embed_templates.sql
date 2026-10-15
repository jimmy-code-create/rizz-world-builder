-- CUSTOM EMBEDS FOR THE EXISTING (BUILT-IN) BOTS
-- ----------------------------------------------------------------
-- The house bots (RIZZ BOT / WELCOME / MUSIC BOT) post through
-- public.bot_insert_message(). This migration gives every realm an optional
-- per-bot embed template (public.bot_templates) so their posts render through
-- the same <Embed> cards as webhook bots, with live preview + Send test +
-- Reset to default in Realm settings -> Bots.
--
--   * WELCOME keeps a built-in default: a "Welcome to {realm}!" card with the
--     member's avatar thumbnail, "Member #{memberCount}" footer, timestamp and
--     a "Say hi" button that waves at the new member and opens their card.
--   * Every other bot starts with no embed (plain text exactly as before);
--     owners/admins can add one.
--   * Variables: {user} {username} {userAvatar} {realm} {memberCount} {date}
--     {channel} — substituted when the bot posts. Unknown tokens stay literal
--     so a typo is visible instead of silently vanishing.
--   * Text is plain (tags stripped), images https-only, the same limits as
--     webhook embeds; messages_embeds_guard re-checks every message write.
--
-- Safe to apply twice.

-- 1. one template per (bot, realm) ---------------------------------
CREATE TABLE IF NOT EXISTS public.bot_templates (
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  realm_id uuid NOT NULL REFERENCES public.realms(id) ON DELETE CASCADE,
  embed jsonb NOT NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bot_id, realm_id)
);

ALTER TABLE public.bot_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bot_templates_member_read ON public.bot_templates;
CREATE POLICY bot_templates_member_read ON public.bot_templates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.realm_members m
      WHERE m.realm_id = bot_templates.realm_id AND m.user_id = auth.uid()
    )
  );

REVOKE ALL ON public.bot_templates FROM PUBLIC, anon;
GRANT SELECT ON public.bot_templates TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.bot_templates FROM PUBLIC, anon, authenticated;

-- 2. text / embed validation helpers -------------------------------
CREATE OR REPLACE FUNCTION public.bot_plain(_value text, _max integer, _label text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v text;
BEGIN
  IF _value IS NULL THEN RETURN ''; END IF;
  -- Plain text only: tags are stripped. (Postgres text can never hold NUL.)
  v := btrim(regexp_replace(_value, '<[^>]*>', '', 'g'));
  IF char_length(v) > _max THEN
    RAISE EXCEPTION '% can be up to % characters', _label, _max;
  END IF;
  RETURN v;
END
$fn$;

-- Sanitize + validate one embed; raises a friendly error, returns the clean
-- embed otherwise. Mirrors src/lib/embeds.ts so both sides agree on limits.
CREATE OR REPLACE FUNCTION public.bot_embed_prepare(_embed jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_unknown text;
  v_out jsonb := '{}'::jsonb;
  v_total integer := 0;
  v_text text;
  v_clean text;
  v_fields jsonb := '[]'::jsonb;
  v_field jsonb;
  v_author jsonb := '{}'::jsonb;
  v_footer jsonb := '{}'::jsonb;
  v_button jsonb := '{}'::jsonb;
  v_label text;
BEGIN
  IF _embed IS NULL OR jsonb_typeof(_embed) <> 'object' THEN
    RAISE EXCEPTION 'Embed must be an object';
  END IF;

  SELECT string_agg(k, ', ') INTO v_unknown
    FROM jsonb_object_keys(_embed) AS k
   WHERE k NOT IN ('title','url','description','color','author','thumbnail','image','fields','footer','timestamp','button');
  IF v_unknown IS NOT NULL THEN
    RAISE EXCEPTION 'Unknown embed field: %', v_unknown;
  END IF;

  v_clean := public.bot_plain(_embed->>'title', 256, 'Embed titles');
  IF v_clean <> '' THEN
    v_out := jsonb_set(v_out, '{title}', to_jsonb(v_clean));
    v_total := v_total + char_length(v_clean);
  END IF;

  v_text := coalesce(_embed->>'url', '');
  IF v_text <> '' THEN
    IF v_text LIKE 'https://%' OR position('{' in v_text) > 0 THEN
      v_out := jsonb_set(v_out, '{url}', to_jsonb(v_text));
    ELSE
      RAISE EXCEPTION 'Embed links must be https links';
    END IF;
  END IF;

  v_clean := public.bot_plain(_embed->>'description', 4096, 'Embed descriptions');
  IF v_clean <> '' THEN
    v_out := jsonb_set(v_out, '{description}', to_jsonb(v_clean));
    v_total := v_total + char_length(v_clean);
  END IF;

  IF _embed ? 'color' THEN
    v_text := coalesce(_embed->>'color', '');
    IF v_text <> '' AND v_text !~ '^#[0-9a-fA-F]{6}$' THEN
      RAISE EXCEPTION 'Embed color must be a hex like #c8ff3d';
    END IF;
    IF v_text <> '' THEN v_out := jsonb_set(v_out, '{color}', to_jsonb(v_text)); END IF;
  END IF;

  IF _embed ? 'author' THEN
    IF jsonb_typeof(_embed->'author') <> 'object' THEN
      RAISE EXCEPTION 'Embed author must be an object';
    END IF;
    v_clean := public.bot_plain(_embed#>>'{author,name}', 256, 'Author names');
    IF v_clean <> '' THEN
      v_author := jsonb_set(v_author, '{name}', to_jsonb(v_clean));
      v_total := v_total + char_length(v_clean);
    END IF;
    v_text := coalesce(_embed#>>'{author,icon_url}', '');
    IF v_text <> '' THEN
      IF v_text LIKE 'https://%' OR position('{' in v_text) > 0 THEN
        v_author := jsonb_set(v_author, '{icon_url}', to_jsonb(v_text));
      ELSE
        RAISE EXCEPTION 'Author icons must be https image URLs';
      END IF;
    END IF;
    v_text := coalesce(_embed#>>'{author,url}', '');
    IF v_text <> '' THEN
      IF v_text LIKE 'https://%' OR position('{' in v_text) > 0 THEN
        v_author := jsonb_set(v_author, '{url}', to_jsonb(v_text));
      ELSE
        RAISE EXCEPTION 'Author URLs must be https links';
      END IF;
    END IF;
    IF v_author <> '{}'::jsonb THEN v_out := jsonb_set(v_out, '{author}', v_author); END IF;
  END IF;

  IF _embed ? 'thumbnail' THEN
    IF jsonb_typeof(_embed->'thumbnail') <> 'object' THEN
      RAISE EXCEPTION 'Embed thumbnail must be an object';
    END IF;
    v_text := coalesce(_embed#>>'{thumbnail,url}', '');
    IF v_text <> '' THEN
      IF v_text LIKE 'https://%' OR position('{' in v_text) > 0 THEN
        v_out := jsonb_set(v_out, '{thumbnail}', jsonb_build_object('url', v_text));
      ELSE
        RAISE EXCEPTION 'Thumbnails must be https image URLs';
      END IF;
    END IF;
  END IF;

  IF _embed ? 'image' THEN
    IF jsonb_typeof(_embed->'image') <> 'object' THEN
      RAISE EXCEPTION 'Embed image must be an object';
    END IF;
    v_text := coalesce(_embed#>>'{image,url}', '');
    IF v_text <> '' THEN
      IF v_text LIKE 'https://%' OR position('{' in v_text) > 0 THEN
        v_out := jsonb_set(v_out, '{image}', jsonb_build_object('url', v_text));
      ELSE
        RAISE EXCEPTION 'Embed images must be https image URLs';
      END IF;
    END IF;
  END IF;

  IF _embed ? 'fields' THEN
    IF jsonb_typeof(_embed->'fields') <> 'array' THEN
      RAISE EXCEPTION 'Embed fields must be a list';
    END IF;
    IF jsonb_array_length(_embed->'fields') > 25 THEN
      RAISE EXCEPTION 'Embeds carry at most 25 fields';
    END IF;
    FOR v_field IN SELECT * FROM jsonb_array_elements(_embed->'fields') LOOP
      v_clean := public.bot_plain(v_field->>'name', 256, 'Field names');
      IF v_clean = '' THEN RAISE EXCEPTION 'Each field needs a name and a value'; END IF;
      v_text := public.bot_plain(v_field->>'value', 1024, 'Field values');
      IF v_text = '' THEN RAISE EXCEPTION 'Each field needs a name and a value'; END IF;
      v_total := v_total + char_length(v_clean) + char_length(v_text);
      v_fields := v_fields || jsonb_build_array(
        jsonb_build_object('name', v_clean, 'value', v_text)
        || CASE WHEN v_field->>'inline' = 'true' THEN jsonb_build_object('inline', true) ELSE '{}'::jsonb END
      );
    END LOOP;
    IF jsonb_array_length(v_fields) > 0 THEN v_out := jsonb_set(v_out, '{fields}', v_fields); END IF;
  END IF;

  IF _embed ? 'footer' THEN
    IF jsonb_typeof(_embed->'footer') <> 'object' THEN
      RAISE EXCEPTION 'Embed footer must be an object';
    END IF;
    v_clean := public.bot_plain(_embed#>>'{footer,text}', 2048, 'Footers');
    IF v_clean <> '' THEN
      v_footer := jsonb_set(v_footer, '{text}', to_jsonb(v_clean));
      v_total := v_total + char_length(v_clean);
    END IF;
    v_text := coalesce(_embed#>>'{footer,icon_url}', '');
    IF v_text <> '' THEN
      IF v_text LIKE 'https://%' OR position('{' in v_text) > 0 THEN
        v_footer := jsonb_set(v_footer, '{icon_url}', to_jsonb(v_text));
      ELSE
        RAISE EXCEPTION 'Footer icons must be https image URLs';
      END IF;
    END IF;
    IF v_footer <> '{}'::jsonb THEN v_out := jsonb_set(v_out, '{footer}', v_footer); END IF;
  END IF;

  IF _embed ? 'timestamp' THEN
    v_text := coalesce(_embed->>'timestamp', '');
    IF v_text <> '' THEN
      IF position('{' in v_text) > 0 THEN
        v_out := jsonb_set(v_out, '{timestamp}', to_jsonb(v_text));
      ELSE
        BEGIN
          PERFORM v_text::timestamptz;
          v_out := jsonb_set(v_out, '{timestamp}', to_jsonb(v_text));
        EXCEPTION WHEN others THEN
          RAISE EXCEPTION 'Embed timestamp must be a valid date';
        END;
      END IF;
    END IF;
  END IF;

  -- Optional action button (the welcome card's "Say hi"): label + wave action,
  -- pointing at a member id or a {token} resolved when the bot posts.
  IF _embed ? 'button' THEN
    IF jsonb_typeof(_embed->'button') <> 'object' THEN
      RAISE EXCEPTION 'Embed button must be an object';
    END IF;
    SELECT string_agg(k, ', ') INTO v_unknown
      FROM jsonb_object_keys(_embed->'button') AS k
     WHERE k NOT IN ('label','action','user_id');
    IF v_unknown IS NOT NULL THEN
      RAISE EXCEPTION 'Unknown button field: %', v_unknown;
    END IF;
    v_label := public.bot_plain(_embed#>>'{button,label}', 40, 'Button labels');
    IF v_label = '' THEN v_label := '👋 Say hi'; END IF;
    v_button := jsonb_set(v_button, '{label}', to_jsonb(v_label));
    v_text := coalesce(_embed#>>'{button,action}', 'wave');
    IF v_text <> 'wave' THEN
      RAISE EXCEPTION 'Buttons only support the wave action';
    END IF;
    v_button := jsonb_set(v_button, '{action}', to_jsonb(v_text));
    v_text := coalesce(_embed#>>'{button,user_id}', '');
    IF v_text <> '' THEN
      IF v_text !~ '^\{[a-zA-Z]+\}$' AND v_text !~ '^[0-9a-fA-F-]{36}$' THEN
        RAISE EXCEPTION 'Button user must be a member id or {token}';
      END IF;
      v_button := jsonb_set(v_button, '{user_id}', to_jsonb(v_text));
    END IF;
    v_out := jsonb_set(v_out, '{button}', v_button);
    v_total := v_total + char_length(v_label);
  END IF;

  IF v_total > 6000 THEN
    RAISE EXCEPTION 'Embeds carry at most 6000 characters per message';
  END IF;
  IF v_out - 'button' = '{}'::jsonb THEN
    RAISE EXCEPTION 'Embeds can''t be empty — add a title, description or field';
  END IF;
  RETURN v_out;
END
$fn$;

-- The built-in default per bot (the welcome card). NULL means the bot posts
-- plain text until an admin gives it a template.
CREATE OR REPLACE FUNCTION public.bot_default_embed(_bot_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT CASE WHEN b.token_hash = 'builtin:welcome' THEN jsonb_build_object(
    'color', '#c8ff3d',
    'title', 'Welcome to {realm}!',
    'description', '{user} just joined, say hi!',
    'thumbnail', jsonb_build_object('url', '{userAvatar}'),
    'footer', jsonb_build_object('text', 'Member #{memberCount}'),
    'timestamp', '{date}',
    'button', jsonb_build_object('label', '👋 Say hi', 'action', 'wave', 'user_id', '{userId}')
  ) ELSE NULL END
  FROM public.bots b
  WHERE b.id = _bot_id;
$fn$;

-- Everything a bot message can know about its moment, as {token} -> text.
CREATE OR REPLACE FUNCTION public.bot_message_vars(_realm_id uuid, _realm_room_id uuid, _user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'realm', r.name,
    'channel', rr.name,
    'date', to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'memberCount', (SELECT count(*)::text FROM public.realm_members m WHERE m.realm_id = _realm_id),
    'user', coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.username), '')),
    'username', nullif(btrim(p.username), ''),
    'userAvatar', nullif(btrim(p.avatar_url), ''),
    'userId', p.id
  ))
  FROM public.realms r
  LEFT JOIN public.realm_rooms rr ON rr.id = _realm_room_id
  LEFT JOIN public.profiles p ON p.id = _user_id
  WHERE r.id = _realm_id;
$fn$;

-- Template (or the bot's default) with variables substituted, ready to store
-- on a message. NULL when the bot has neither. Links that stop being https
-- after substitution, vanished users and stale timestamps are dropped rather
-- than shipped broken.
CREATE OR REPLACE FUNCTION public.bot_render_template(_bot_id uuid, _realm_id uuid, _vars jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_tpl jsonb;
  v_text text;
  v_key text;
  v_val text;
  v_out jsonb;
BEGIN
  SELECT embed INTO v_tpl FROM public.bot_templates WHERE bot_id = _bot_id AND realm_id = _realm_id;
  IF v_tpl IS NULL THEN v_tpl := public.bot_default_embed(_bot_id); END IF;
  IF v_tpl IS NULL THEN RETURN NULL; END IF;

  v_text := v_tpl::text;
  FOR v_key, v_val IN SELECT key, value FROM jsonb_each_text(coalesce(_vars, '{}'::jsonb)) LOOP
    CONTINUE WHEN v_val IS NULL;
    v_text := replace(v_text, '{' || v_key || '}', trim(to_jsonb(v_val)::text, '"'));
  END LOOP;

  BEGIN
    v_out := v_text::jsonb;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;

  IF coalesce(v_out->>'url', '') <> '' AND (v_out->>'url') NOT LIKE 'https://%' THEN
    v_out := v_out - 'url';
  END IF;
  IF v_out#>>'{thumbnail,url}' IS NOT NULL AND (v_out#>>'{thumbnail,url}') NOT LIKE 'https://%' THEN
    v_out := v_out #- '{thumbnail,url}';
    IF v_out->'thumbnail' = '{}'::jsonb THEN v_out := v_out - 'thumbnail'; END IF;
  END IF;
  IF v_out#>>'{image,url}' IS NOT NULL AND (v_out#>>'{image,url}') NOT LIKE 'https://%' THEN
    v_out := v_out #- '{image,url}';
    IF v_out->'image' = '{}'::jsonb THEN v_out := v_out - 'image'; END IF;
  END IF;
  IF v_out#>>'{author,icon_url}' IS NOT NULL AND (v_out#>>'{author,icon_url}') NOT LIKE 'https://%' THEN
    v_out := v_out #- '{author,icon_url}';
  END IF;
  IF v_out#>>'{footer,icon_url}' IS NOT NULL AND (v_out#>>'{footer,icon_url}') NOT LIKE 'https://%' THEN
    v_out := v_out #- '{footer,icon_url}';
  END IF;
  IF coalesce(v_out->>'timestamp', '') <> '' THEN
    BEGIN
      PERFORM (v_out->>'timestamp')::timestamptz;
    EXCEPTION WHEN others THEN
      v_out := v_out - 'timestamp';
    END;
  END IF;
  IF v_out ? 'button' AND coalesce(v_out#>>'{button,user_id}', '') LIKE '%{%' THEN
    v_out := jsonb_set(v_out, '{button}', (v_out->'button') - 'user_id');
  END IF;
  RETURN v_out;
END
$fn$;

-- 3. bot messages carry embeds now ---------------------------------
DROP FUNCTION IF EXISTS public.bot_insert_message(uuid, uuid, uuid, text, jsonb);

CREATE OR REPLACE FUNCTION public.bot_insert_message(
  _bot_id uuid,
  _realm_id uuid,
  _realm_room_id uuid,
  _body text,
  _card jsonb DEFAULT NULL,
  _embeds jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_id uuid;
  v_embeds jsonb := _embeds;
BEGIN
  -- No explicit embeds: let the bot's realm template dress the message. When
  -- neither exists this stays plain text, exactly like before.
  IF v_embeds IS NULL THEN
    v_embeds := public.bot_render_template(_bot_id, _realm_id, public.bot_message_vars(_realm_id, _realm_room_id, NULL));
  END IF;
  -- One card is the common case; messages store a list.
  IF v_embeds IS NOT NULL AND jsonb_typeof(v_embeds) = 'object' THEN
    v_embeds := jsonb_build_array(v_embeds);
  END IF;

  PERFORM set_config('rizz.bot_writer', 'on', true);

  INSERT INTO public.messages (realm_id, realm_room_id, sender_id, bot_id, body, card, embeds)
  VALUES (_realm_id, _realm_room_id, NULL, _bot_id, _body, _card, v_embeds)
  RETURNING id INTO v_id;

  PERFORM set_config('rizz.bot_writer', 'off', true);
  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.bot_insert_message(uuid, uuid, uuid, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;

-- 4. the welcome message is the card --------------------------------
CREATE OR REPLACE FUNCTION public.welcome_new_realm_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_realm public.realms%ROWTYPE;
  v_bot uuid;
  v_room uuid;
  v_name text;
  v_extra text;
  v_body text;
  v_vars jsonb;
  v_embeds jsonb;
BEGIN
  SELECT * INTO v_realm FROM public.realms WHERE id = NEW.realm_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF NOT coalesce(v_realm.welcome_enabled, true) THEN RETURN NEW; END IF;
  -- The founder does not get a "you joined" message on their own realm.
  IF NEW.user_id = v_realm.owner_id THEN RETURN NEW; END IF;

  SELECT id INTO v_bot FROM public.bots WHERE is_builtin AND name = 'WELCOME';
  IF v_bot IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_room
  FROM public.realm_rooms
  WHERE realm_id = NEW.realm_id AND kind <> 'voice'
  ORDER BY is_default DESC, position ASC, created_at ASC
  LIMIT 1;
  IF v_room IS NULL THEN RETURN NEW; END IF;

  SELECT coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.username), ''), 'a new face')
  INTO v_name
  FROM public.profiles p WHERE p.id = NEW.user_id;

  v_extra := nullif(btrim(coalesce(v_realm.welcome_message, '')), '');

  -- The welcome card (template or built-in default) replaces the old plain
  -- line; the owner's custom welcome line stays as the message body.
  v_vars := public.bot_message_vars(NEW.realm_id, v_room, NEW.user_id);
  v_embeds := public.bot_render_template(v_bot, NEW.realm_id, v_vars);

  IF v_embeds IS NOT NULL THEN
    v_body := coalesce(v_extra, '');
  ELSE
    v_body := '👋 ' || coalesce(v_name, 'A new face') || ' just joined — say hi!';
    IF v_extra IS NOT NULL THEN
      v_body := v_body || E'\n' || v_extra;
    END IF;
  END IF;

  PERFORM public.bot_insert_message(v_bot, NEW.realm_id, v_room, v_body, NULL, v_embeds);
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.welcome_new_realm_member() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.welcome_new_realm_member() TO authenticated;

-- 5. owner/admin APIs ------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_bot_embed_template(_bot_id uuid, _realm_id uuid, _embed jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_clean jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_realm_bots(_realm_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only realm owners and moderators can edit bot embeds';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bots b WHERE b.id = _bot_id AND b.is_builtin) THEN
    RAISE EXCEPTION 'That bot has no editable embed';
  END IF;
  v_clean := public.bot_embed_prepare(_embed);
  INSERT INTO public.bot_templates (bot_id, realm_id, embed, updated_by, updated_at)
  VALUES (_bot_id, _realm_id, v_clean, auth.uid(), now())
  ON CONFLICT (bot_id, realm_id) DO UPDATE
    SET embed = excluded.embed, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  RETURN jsonb_build_object('ok', true, 'embed', v_clean);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.reset_bot_embed_template(_bot_id uuid, _realm_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_realm_bots(_realm_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only realm owners and moderators can edit bot embeds';
  END IF;
  DELETE FROM public.bot_templates WHERE bot_id = _bot_id AND realm_id = _realm_id;
  RETURN jsonb_build_object('ok', true, 'default', public.bot_default_embed(_bot_id));
END;
$fn$;

CREATE OR REPLACE FUNCTION public.send_bot_embed_test(_bot_id uuid, _realm_id uuid, _realm_room_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_room uuid;
  v_embed jsonb;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_realm_bots(_realm_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only realm owners and moderators can edit bot embeds';
  END IF;
  SELECT id INTO v_room
  FROM public.realm_rooms
  WHERE id = _realm_room_id AND realm_id = _realm_id AND kind <> 'voice';
  IF v_room IS NULL THEN
    RAISE EXCEPTION 'Pick a text channel for the test message';
  END IF;
  -- Render with the caller as "the user", so every variable shows something.
  v_embed := public.bot_render_template(_bot_id, _realm_id, public.bot_message_vars(_realm_id, v_room, auth.uid()));
  IF v_embed IS NULL THEN
    RAISE EXCEPTION 'This bot has no embed yet — add one first';
  END IF;
  v_id := public.bot_insert_message(_bot_id, _realm_id, v_room, '', NULL, jsonb_build_array(v_embed));
  RETURN jsonb_build_object('ok', true, 'message_id', v_id);
END;
$fn$;

REVOKE ALL ON FUNCTION public.bot_plain(text, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bot_embed_prepare(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bot_message_vars(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bot_render_template(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bot_default_embed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bot_default_embed(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.set_bot_embed_template(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_bot_embed_template(uuid, uuid, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.reset_bot_embed_template(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_bot_embed_template(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.send_bot_embed_test(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_bot_embed_test(uuid, uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
