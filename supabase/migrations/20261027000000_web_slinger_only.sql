-- ============ ONE PROFILE EFFECT ============
-- The app now ships a single cosmetic: the Web Slinger profile effect.
-- The catalogue is keyed by slug, but user_profile_effects.effect_id is a uuid
-- foreign key, so the row has to exist before an owner can equip it for
-- visitors to see. Idempotent: re-running only refreshes the metadata.

INSERT INTO public.profile_effects
  (slug, name, description, type, rarity, unlock_rizz, preview_color)
VALUES (
  'fx-web-slinger',
  'Web Slinger',
  'A masked web-slinger crouches on a strand, lenses lit, webbing thrown across your profile.',
  'profile_effect',
  'mythic',
  1800,
  '#e8253f'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  rarity = EXCLUDED.rarity,
  unlock_rizz = EXCLUDED.unlock_rizz,
  preview_color = EXCLUDED.preview_color;

-- Retire the rest of the old catalogue. user_profile_effects rows cascade with
-- their effect, so a removed cosmetic can never stay equipped on a profile.
DELETE FROM public.profile_effects
WHERE slug <> 'fx-web-slinger';
