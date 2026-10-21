-- ============ PUPPY LOVE TAKES OVER ============
-- The profile-effect catalogue now ships one original character: Biscuit, the
-- heart-eyed pup in a lime RIZZ hoodie. The retired Web Slinger slug is renamed
-- in place rather than deleted so anyone who already owned or equipped it keeps
-- their cosmetic row (user_profile_effects keys by uuid, not slug).
--
-- Idempotent: re-running only refreshes metadata and can never leave a second
-- effect in the catalogue.

UPDATE public.profile_effects
SET slug = 'fx-puppy-love'
WHERE slug = 'fx-web-slinger'
  AND NOT EXISTS (
    SELECT 1 FROM public.profile_effects WHERE slug = 'fx-puppy-love'
  );

INSERT INTO public.profile_effects
  (slug, name, description, type, rarity, unlock_rizz, paw_price, price_cents, rights_review, sort_order, preview_color)
VALUES (
  'fx-puppy-love',
  'Puppy Love',
  'Biscuit, RIZZ''s heart-eyed pup, leans into your banner in a lime hoodie and sends hearts floating across your profile.',
  'profile_effect',
  'mythic',
  1800,
  1800,
  0,
  false,
  10,
  '#c9ff3d'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  rarity = EXCLUDED.rarity,
  unlock_rizz = EXCLUDED.unlock_rizz,
  paw_price = EXCLUDED.paw_price,
  price_cents = EXCLUDED.price_cents,
  rights_review = EXCLUDED.rights_review,
  sort_order = EXCLUDED.sort_order,
  preview_color = EXCLUDED.preview_color;

-- One effect only. Rows for anything else cascade to their owners' choices, so
-- a removed cosmetic can never stay equipped on a profile.
DELETE FROM public.profile_effects
WHERE slug <> 'fx-puppy-love';

NOTIFY pgrst, 'reload schema';
