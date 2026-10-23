-- ============ EFFECTS SHOP v3 ============
-- Two shelves, both drawn in-app as transparent vector art:
--   * avatar_decoration — a chubby frame cut around the avatar.
--   * profile_effect    — a scene laid over the profile header.
-- Everything here is original artwork (no bitmaps, no third-party footage), so
-- the rights-review hold that used to block the Web Slinger skin is cleared.
-- The catalogue is keyed by slug, and every acquisition/equip goes through
-- purchase_profile_effect() / equip_profile_effect() / unequip_profile_effect();
-- the browser still has no write access to user_profile_effects.

DELETE FROM public.profile_effects
WHERE slug NOT IN (
  'fx-chubby-cloud',
  'fx-chubby-paws',
  'fx-chubby-bloom',
  'fx-web-slinger',
  'fx-web-veil'
);

INSERT INTO public.profile_effects
  (slug, name, description, type, rarity, unlock_rizz, paw_price, price_cents, rights_review, sort_order, preview_color)
VALUES
  ('fx-chubby-cloud', 'Chubby Cloud',
   'A puffy cream cloud ring with a rosy blush and two lime sparkles — soft, round and a little bit sleepy.',
   'avatar_decoration', 'rare', 450, 450, 0, false, 10, '#f4f1e7'),
  ('fx-chubby-paws', 'Chubby Paws',
   'Six fat little paws padding around the rim, wiggling hello.',
   'avatar_decoration', 'epic', 750, 750, 0, false, 20, '#f4f1e7'),
  ('fx-chubby-bloom', 'Chubby Bloom',
   'Plump hearts and tiny lime leaves circling the avatar like a sticker sheet.',
   'avatar_decoration', 'legendary', 1200, 1200, 0, false, 30, '#c9ff3d'),
  ('fx-web-slinger', 'Web Slinger',
   'A silk web stretches across the profile and a small slinger drops in on a thread, swaying.',
   'profile_effect', 'mythic', 1600, 1600, 499, false, 40, '#c9ff3d'),
  ('fx-web-veil', 'Silk Veil',
   'A denser corner veil of silk with a patient spider hanging over the banner.',
   'profile_effect', 'epic', 1100, 1100, 349, false, 50, '#f4f1e7')
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

-- Replacements for effects retired earlier: nobody could have owned this exact
-- slug pair before, but clear any stale equip flag defensively so a member can
-- never show a cosmetic that is no longer in the catalogue.
UPDATE public.user_profile_effects AS upe
SET equipped = false
FROM public.profile_effects AS pe
WHERE upe.effect_id = pe.id
  AND upe.equipped
  AND pe.slug NOT IN (
    'fx-chubby-cloud',
    'fx-chubby-paws',
    'fx-chubby-bloom',
    'fx-web-slinger',
    'fx-web-veil'
  );

NOTIFY pgrst, 'reload schema';
