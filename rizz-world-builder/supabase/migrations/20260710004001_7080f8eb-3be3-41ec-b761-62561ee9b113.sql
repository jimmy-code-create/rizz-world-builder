
WITH colors(cslug, cname, chex) AS (
  VALUES
    ('crimson','Crimson','#dc143c'), ('pink','Pink','#ff2d92'), ('magenta','Magenta','#d946ef'),
    ('purple','Purple','#a855f7'), ('violet','Violet','#7c3aed'), ('indigo','Indigo','#6366f1'),
    ('blue','Blue','#3b82f6'), ('sky','Sky','#0ea5e9'), ('cyan','Cyan','#06b6d4'),
    ('teal','Teal','#14b8a6'), ('emerald','Emerald','#10b981'), ('green','Green','#22c55e'),
    ('lime','Lime','#84cc16'), ('yellow','Yellow','#facc15'), ('amber','Amber','#f59e0b'),
    ('orange','Orange','#f97316'), ('red','Red','#ef4444'), ('rose','Rose','#f43f5e'),
    ('fuchsia','Fuchsia','#e879f9'), ('coral','Coral','#fb7185'), ('mint','Mint','#6ee7b7'),
    ('aqua','Aqua','#22d3ee'), ('azure','Azure','#60a5fa'), ('plum','Plum','#9333ea'),
    ('ruby','Ruby','#e11d48'), ('gold','Gold','#eab308'), ('bronze','Bronze','#ca8a04'),
    ('silver','Silver','#cbd5e1'), ('platinum','Platinum','#f8fafc'), ('jade','Jade','#059669'),
    ('forest','Forest','#16a34a'), ('ocean','Ocean','#0284c7'), ('sunset','Sunset','#fb923c'),
    ('dawn','Dawn','#fda4af'), ('dusk','Dusk','#6b21a8'), ('midnight','Midnight','#312e81'),
    ('snow','Snow','#f1f5f9'), ('ash','Ash','#64748b'), ('ember','Ember','#ea580c'), ('void','Void','#0f172a')
),
ring_styles(sslug, sname) AS (
  VALUES ('neon','Neon'),('aurora','Aurora'),('fire','Fire'),('holo','Holo'),
         ('sakura','Sakura'),('electric','Electric'),('ice','Ice'),('toxic','Toxic'),
         ('sunset','Sunset'),('galaxy','Galaxy'),('chrome','Chrome'),('ember','Ember')
),
np_styles(sslug, sname) AS (
  VALUES ('shimmer','Shimmer'),('gradient','Gradient'),('glow','Glow'),('glitch','Glitch'),
         ('rainbow','Rainbow'),('chrome','Chrome'),('sparkle','Sparkle'),('wave','Wave'),
         ('neon','Neon'),('ember','Ember'),('ice','Ice'),('mythic','Mythic')
),
fx_styles(sslug, sname) AS (
  VALUES ('sparkles','Sparkles'),('hearts','Hearts'),('snow','Snowfall'),('confetti','Confetti'),
         ('embers','Embers'),('bubbles','Bubbles'),('stars','Stars'),('lightning','Lightning'),
         ('petals','Petals'),('meteors','Meteors')
),
rarity_of AS (
  SELECT cslug,
    (CASE
       WHEN cslug IN ('platinum','void','midnight','snow') THEN 'mythic'
       WHEN cslug IN ('gold','ruby','plum','fuchsia','indigo') THEN 'legendary'
       WHEN cslug IN ('crimson','magenta','emerald','azure','sunset','ember','dusk','jade') THEN 'epic'
       WHEN cslug IN ('purple','violet','cyan','teal','amber','orange','rose','aqua','coral','ocean','forest','bronze') THEN 'rare'
       ELSE 'common'
     END)::badge_rarity AS r,
    (CASE
       WHEN cslug IN ('platinum','void','midnight','snow') THEN 15000
       WHEN cslug IN ('gold','ruby','plum','fuchsia','indigo') THEN 5000
       WHEN cslug IN ('crimson','magenta','emerald','azure','sunset','ember','dusk','jade') THEN 1500
       WHEN cslug IN ('purple','violet','cyan','teal','amber','orange','rose','aqua','coral','ocean','forest','bronze') THEN 300
       ELSE 50
     END)::int AS cost
  FROM colors
),
rings AS (
  SELECT
    'ring-' || s.sslug || '-' || c.cslug AS slug,
    s.sname || ' ' || c.cname || ' Ring' AS name,
    'An animated ' || s.sname || ' avatar ring in ' || c.cname AS description,
    'avatar_decoration'::profile_effect_type AS type,
    r.r AS rarity, r.cost AS unlock_rizz, c.chex AS preview_color
  FROM ring_styles s CROSS JOIN colors c JOIN rarity_of r ON r.cslug = c.cslug
),
nps AS (
  SELECT
    'np-' || s.sslug || '-' || c.cslug AS slug,
    s.sname || ' ' || c.cname || ' Nameplate' AS name,
    s.sname || ' username colored ' || c.cname AS description,
    'nameplate'::profile_effect_type AS type,
    r.r AS rarity, r.cost AS unlock_rizz, c.chex AS preview_color
  FROM np_styles s CROSS JOIN colors c JOIN rarity_of r ON r.cslug = c.cslug
),
fxs AS (
  SELECT
    'fx-' || s.sslug || '-' || c.cslug AS slug,
    s.sname || ' ' || c.cname AS name,
    s.sname || ' profile effect in ' || c.cname AS description,
    'profile_effect'::profile_effect_type AS type,
    r.r AS rarity, (r.cost * 2) AS unlock_rizz, c.chex AS preview_color
  FROM fx_styles s CROSS JOIN colors c JOIN rarity_of r ON r.cslug = c.cslug
)
INSERT INTO public.profile_effects (slug, name, description, type, rarity, unlock_rizz, preview_color)
SELECT * FROM rings
UNION ALL SELECT * FROM nps
UNION ALL SELECT * FROM fxs
ON CONFLICT (slug) DO NOTHING;
