-- Badge renames.
--
-- "Early Rizzer" becomes HypeSquad Bravery: the first-wave badge, renamed
-- after the house-badge presentation it was modeled on — a short title, a
-- one-line "first in, no hesitation" flavor, and the story in the card below.
-- "Channel Founder" merges into Verified Creator: creating a channel was
-- always a creator milestone, and the catalog should hold one creator badge
-- instead of two that read almost the same.
--
-- Both halves are written to survive any database state. badge_set_v2 wiped
-- the old catalog, so on databases that applied it these rows may no longer
-- exist — every statement below then becomes a no-op instead of an error,
-- and rerunning the file never duplicates an award.

-- ============ Early Rizzer → HypeSquad Bravery ============
UPDATE public.badges
SET slug        = 'hypesquad-bravery',
    name        = 'HypeSquad Bravery',
    description = 'First in, no hesitation. Joined RIZZ in the first wave.',
    icon        = 'sparkles'
WHERE slug = 'early_rizzer';

-- ============ Channel Founder → Verified Creator ============

-- 1. Move every Channel Founder award onto Verified Creator, deduped: a
--    member who somehow holds both keeps a single row of each badge id.
WITH src AS (SELECT id FROM public.badges WHERE slug = 'channel_founder'),
     dst AS (SELECT id FROM public.badges WHERE slug = 'verified_creator')
INSERT INTO public.user_badges (user_id, badge_id)
SELECT ub.user_id, d.id
FROM public.user_badges AS ub
CROSS JOIN src AS s
CROSS JOIN dst AS d
WHERE ub.badge_id = s.id
ON CONFLICT (user_id, badge_id) DO NOTHING;

-- 2. When the target badge already exists, the moved awards and the old row
--    are retired so only one creator badge remains.
DELETE FROM public.user_badges AS ub
USING public.badges AS b
WHERE ub.badge_id = b.id
  AND b.slug = 'channel_founder'
  AND EXISTS (SELECT 1 FROM public.badges WHERE slug = 'verified_creator');

DELETE FROM public.badges AS b
WHERE b.slug = 'channel_founder'
  AND EXISTS (SELECT 1 FROM public.badges WHERE slug = 'verified_creator');

-- 3. If Verified Creator was not in the catalog, the founder row simply takes
--    its place, so no award is ever lost to the rename.
UPDATE public.badges
SET slug        = 'verified_creator',
    name        = 'Verified Creator',
    description = 'Official creator on RIZZ.',
    icon        = 'badge-check'
WHERE slug = 'channel_founder';
