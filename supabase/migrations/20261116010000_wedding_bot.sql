-- WEDDING BOT: a built-in realm bot that announces a /marry with a custom card.
-- It is meant to feel like a small wedding: a bride/groom card, partner mention,
-- and a one-time test message into the chosen channel.

BEGIN;

-- ---------- built-in bot row ----------

INSERT INTO public.bots (id, name, description, avatar_url, is_builtin, owner_id, delivery, scopes, is_public)
VALUES (
  gen_random_uuid(),
  'WEDDING',
  'Announces /marry as a little wedding card for two people.',
  NULL,
  TRUE,
  NULL,
  'webhook',
  ARRAY['messages.write', 'reactions.write'],
  FALSE
)
ON CONFLICT (id) DO NOTHING;

-- ---------- default command ----------

INSERT INTO public.bot_commands (bot_id, name, description, options, enabled_globally)
SELECT id, 'marry', 'Tie two people together with a wedding card.', ARRAY[
  ('{ "name": "partner", "description": "The second person in the wedding", "type": "user", "required": true }')::jsonb
], TRUE
FROM public.bots
WHERE name = 'WEDDING'
ON CONFLICT (bot_id, name) DO NOTHING;

-- ---------- default embed template ----------

INSERT INTO public.bot_templates (bot_id, realm_id, embed, updated_by, updated_at)
SELECT id, gen_random_uuid(), jsonb_build_object(
  'title', '🤍 Just got married',
  'description', 'Join {user} and {partner} in the happy mess.',
  'color', 131095,
  'thumbnail', jsonb_build_object('url', '{userAvatar}'),
  'image', jsonb_build_object('url', '{partnerAvatar}'),
  'footer', jsonb_build_object('text', 'Member #{memberCount} · {date}', 'icon_url', NULL),
  'button', jsonb_build_object('label', 'Say I do', 'url', 'https://rizzapp.onrender.com', 'user_id', '{user}')
), NULL, now()
FROM public.bots
WHERE name = 'WEDDING'
ON CONFLICT (bot_id, realm_id) DO NOTHING;

COMMIT;
