-- ============ EFFECT SHOP: MEDIA ITEMS ============
-- Two premium pieces rendered from the member-supplied animation clips:
--   fx-petal-bloom    — a full-profile petal wash (video, screen-blended).
--   fx-ivory-filigree — an ivory frame cut out around the avatar (transparent PNG).
-- Both are original renders supplied by the operator, so the rights-review hold
-- that used to block the Web Slinger skin stays off, and both carry the same
-- price: 2,099 Paws or $1.99 on card (card fulfilment still needs an operator
-- webhook; the Paws RPC is the live path).

INSERT INTO public.profile_effects
  (slug, name, description, type, rarity, unlock_rizz, paw_price, price_cents, rights_review, sort_order, preview_color)
VALUES
  ('fx-petal-bloom', 'Petal Bloom',
   'A slow storm of luminous petals drifting across your whole profile — cover, cards and all.',
   'profile_effect', 'mythic', 2099, 2099, 199, false, 60, '#ffd9e6'),
  ('fx-ivory-filigree', 'Ivory Filigree',
   'A hand-cut ivory frame that hangs around your photo and breathes with you.',
   'avatar_decoration', 'mythic', 2099, 2099, 199, false, 70, '#f4f1e7')
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

NOTIFY pgrst, 'reload schema';
