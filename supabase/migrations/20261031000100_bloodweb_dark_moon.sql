-- ============ BLOODWEB + DARK MOON ============
-- Two new original looks, each in its own wearable slot:
--   Bloodweb  → avatar_decoration, a red vein collar around the photo
--   Dark Moon → profile_frame, a gothic branch/raven frame around the banner
-- Puppy Love stays the banner effect. Idempotent: re-running only refreshes
-- metadata and never duplicates a slug.

INSERT INTO public.profile_effects
  (slug, name, description, type, rarity, unlock_rizz, paw_price, price_cents, rights_review, sort_order, preview_color)
VALUES
  (
    'fx-bloodweb',
    'Bloodweb',
    'A pulsing web of red veins and fever-bright nodes wraps your avatar. Give your avatar a new look.',
    'avatar_decoration',
    'mythic',
    1400,
    1400,
    0,
    false,
    20,
    '#ff2338'
  ),
  (
    'fx-dark-moon',
    'Dark Moon',
    'A bone-white moon behind black branches and red-eyed ravens, with cold light falling across your banner. Elevate and wrap your profile with a frame.',
    'profile_frame',
    'legendary',
    1600,
    1600,
    0,
    false,
    30,
    '#cfd6e2'
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

-- The two slots must stay independent; any older row that used the frame type
-- under another name would fight the new frame, so standardise the seed order.
UPDATE public.profile_effects
SET sort_order = 10
WHERE slug = 'fx-puppy-love';

NOTIFY pgrst, 'reload schema';
