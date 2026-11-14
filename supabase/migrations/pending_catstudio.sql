-- pending_catstudio.sql — Cat Studio schema. NOT APPLIED.
--
-- Apply with: supabase db push (or paste into the SQL editor), then reload the
-- app. Until this runs, /cat-studio detects the missing table and hides itself.
--
-- Prices here mirror src/features/cat-studio/catalog.ts. The client never sends
-- a price: buy_cat_item() reads it from this table.

-- ---------------------------------------------------------------- tables
create table if not exists public.cat_items (
  id text primary key,
  slot text not null check (slot in ('hat', 'eyewear', 'neck', 'face', 'back', 'backdrop')),
  name text not null,
  rarity text not null check (rarity in ('common', 'rare', 'epic', 'legendary', 'luxe')),
  price integer not null default 0 check (price >= 0),
  requires_purify boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.cat_items is
  'Cat Studio catalog. Prices are authoritative here; the client copy is display only.';

create table if not exists public.cat_inventory (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.cat_items(id) on delete cascade,
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- Double-tap guard: a pending transaction reference is unique per member.
create unique index if not exists paw_transactions_cat_once
  on public.paw_transactions (user_id, kind, reference_id)
  where kind = 'cat_purchase';

alter table public.profiles
  add column if not exists avatar_type text not null default 'photo'
    check (avatar_type in ('photo', 'cat'));
alter table public.profiles
  add column if not exists avatar_config jsonb;

comment on column public.profiles.avatar_type is
  'photo = avatar_url image (unchanged), cat = avatar_config rendered by CatAvatar.';

-- ---------------------------------------------------------------- seed
insert into public.cat_items (id, slot, name, rarity, price, requires_purify) values
  ('hat_crown', 'hat', 'Crown', 'rare', 180, false),
  ('hat_top_hat', 'hat', 'Top hat', 'rare', 240, false),
  ('hat_beret', 'hat', 'Beret', 'common', 120, false),
  ('hat_beanie', 'hat', 'Beanie', 'common', 90, false),
  ('hat_halo', 'hat', 'Halo', 'legendary', 640, false),
  ('hat_star_crown', 'hat', 'Star crown', 'luxe', 1200, true),
  ('eyewear_sunglasses', 'eyewear', 'Sunglasses', 'common', 90, false),
  ('eyewear_monocle', 'eyewear', 'Monocle', 'rare', 160, false),
  ('eyewear_heart', 'eyewear', 'Heart glasses', 'epic', 320, false),
  ('eyewear_visor', 'eyewear', 'Visor', 'rare', 140, false),
  ('eyewear_diamond', 'eyewear', 'Diamond specs', 'luxe', 980, true),
  ('neck_gold_chain', 'neck', 'Gold chain', 'rare', 220, false),
  ('neck_pearls', 'neck', 'Pearl necklace', 'epic', 300, false),
  ('neck_bow_tie', 'neck', 'Bow tie', 'common', 110, false),
  ('neck_diamond_collar', 'neck', 'Diamond collar', 'luxe', 900, true),
  ('neck_bandana', 'neck', 'Bandana', 'common', 80, false),
  ('face_blush', 'face', 'Blush', 'common', 70, false),
  ('face_whisker_gems', 'face', 'Whisker gems', 'epic', 450, false),
  ('face_star_sticker', 'face', 'Star sticker', 'rare', 150, false),
  ('face_freckles', 'face', 'Freckles', 'common', 60, false),
  ('face_tear', 'face', 'Single tear', 'rare', 130, false),
  ('back_velvet_cape', 'back', 'Velvet cape', 'legendary', 700, false),
  ('back_scarf', 'back', 'Long scarf', 'common', 100, false),
  ('back_wings', 'back', 'Bat wings', 'epic', 520, false),
  ('back_backpack', 'back', 'Tiny backpack', 'common', 120, false),
  ('back_aurora_cloak', 'back', 'Aurora cloak', 'luxe', 1100, true),
  ('backdrop_solid', 'backdrop', 'Solid', 'common', 0, false),
  ('backdrop_marble', 'backdrop', 'Marble', 'rare', 200, false),
  ('backdrop_velvet', 'backdrop', 'Velvet curtain', 'epic', 340, false),
  ('backdrop_city', 'backdrop', 'City night', 'legendary', 480, false),
  ('backdrop_luxe_night', 'backdrop', 'Luxe night', 'luxe', 860, true)
on conflict (id) do update set
  slot = excluded.slot,
  name = excluded.name,
  rarity = excluded.rarity,
  price = excluded.price,
  requires_purify = excluded.requires_purify;

-- ---------------------------------------------------------------- RLS
alter table public.cat_items enable row level security;
alter table public.cat_inventory enable row level security;

drop policy if exists "cat items are public" on public.cat_items;
create policy "cat items are public" on public.cat_items
  for select using (true);

drop policy if exists "read own cat inventory" on public.cat_inventory;
create policy "read own cat inventory" on public.cat_inventory
  for select using (auth.uid() = user_id);

-- No insert/update/delete policy: every write goes through the RPCs below.

-- ---------------------------------------------------------------- buy
create or replace function public.buy_cat_item(_item text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_item public.cat_items%rowtype;
  v_balance integer;
  v_owned boolean;
  v_purify_until timestamptz;
  v_purify_enforced boolean := coalesce(current_setting('rizz.purify_enforced', true), 'off') = 'on';
  v_reference text := 'cat_item:' || _item;
begin
  if v_user is null then
    raise exception 'Sign in to unlock items.';
  end if;

  select * into v_item from public.cat_items where id = _item and active;
  if not found then
    raise exception 'That item does not exist.';
  end if;

  -- Lock the wallet first: two quick taps serialise here, and the second call
  -- sees the first purchase instead of charging again.
  select paw_balance, purify_until into v_balance, v_purify_until
  from public.profiles where id = v_user
  for update;

  if not found then
    raise exception 'Member not found.';
  end if;

  select exists (
    select 1 from public.cat_inventory
    where user_id = v_user and item_id = v_item.id
  ) into v_owned;

  if v_owned then
    return jsonb_build_object('status', 'owned', 'balance', coalesce(v_balance, 0), 'item_id', v_item.id);
  end if;

  if v_item.requires_purify and v_purify_enforced
     and (v_purify_until is null or v_purify_until <= now()) then
    raise exception 'This item is for Purify members.';
  end if;

  if coalesce(v_balance, 0) < v_item.price then
    raise exception 'Not enough Paws. You need % more.', v_item.price - coalesce(v_balance, 0);
  end if;

  perform set_config('rizz.paw_writer', 'on', true);

  if v_item.price > 0 then
    update public.profiles
    set paw_balance = paw_balance - v_item.price, updated_at = now()
    where id = v_user
    returning paw_balance into v_balance;

    insert into public.paw_transactions (user_id, amount, kind, reference_id, description)
    values (v_user, -v_item.price, 'cat_purchase', v_reference, v_item.name)
    on conflict (user_id, kind, reference_id) do nothing;
  else
    select paw_balance into v_balance from public.profiles where id = v_user;
  end if;

  insert into public.cat_inventory (user_id, item_id)
  values (v_user, v_item.id)
  on conflict (user_id, item_id) do nothing;

  perform set_config('rizz.paw_writer', 'off', true);

  return jsonb_build_object('status', 'purchased', 'balance', coalesce(v_balance, 0), 'item_id', v_item.id);
end;
$$;

revoke all on function public.buy_cat_item(text) from public;
grant execute on function public.buy_cat_item(text) to authenticated;

-- ---------------------------------------------------------------- save
create or replace function public.save_cat_avatar(_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_slot text;
  v_id text;
  v_out jsonb := jsonb_build_object('slots', '{}'::jsonb);
  v_shape jsonb;
  v_key text;
  v_min numeric;
  v_max numeric;
  v_value numeric;
  v_bounds constant jsonb := '{
    "body": [0.85, 1.25],
    "head": [0.9, 1.15],
    "earSize": [0.8, 1.3],
    "earTilt": [-12, 12],
    "eyeSize": [0.8, 1.3],
    "eyeSpacing": [0.9, 1.15],
    "tailLength": [0.7, 1.4]
  }'::jsonb;
begin
  if v_user is null then
    raise exception 'Sign in to save your cat.';
  end if;

  if _config is null or jsonb_typeof(_config) <> 'object' then
    raise exception 'That cat config is not valid.';
  end if;

  -- Clamp every slider against the same bounds the app uses.
  v_shape := '{}'::jsonb;
  for v_key in select jsonb_object_keys(v_bounds) loop
    v_min := (v_bounds -> v_key ->> 0)::numeric;
    v_max := (v_bounds -> v_key ->> 1)::numeric;
    v_value := coalesce((_config -> 'shape' ->> v_key)::numeric, (v_min + v_max) / 2);
    v_shape := v_shape || jsonb_build_object(v_key, greatest(v_min, least(v_max, v_value)));
  end loop;
  v_out := jsonb_set(v_out, '{shape}', v_shape);

  -- Items: known id, correct slot, and owned by this member.
  for v_slot in select jsonb_object_keys(coalesce(_config -> 'slots', '{}'::jsonb)) loop
    v_id := _config -> 'slots' ->> v_slot;
    if v_id is null or v_id = '' then
      continue;
    end if;
    if not exists (
      select 1 from public.cat_items where id = v_id and slot = v_slot and active
    ) then
      raise exception 'Unknown cat item: %', v_id;
    end if;
    if not exists (
      select 1 from public.cat_inventory where user_id = v_user and item_id = v_id
    ) then
      raise exception 'You do not own %', v_id;
    end if;
    v_out := jsonb_set(v_out, array['slots', v_slot], to_jsonb(v_id));
  end loop;

  v_out := v_out
    || jsonb_build_object('base', 'cat')
    || jsonb_build_object('colors', coalesce(_config -> 'colors', '{}'::jsonb))
    || jsonb_build_object('pattern', coalesce(_config ->> 'pattern', 'solid'))
    || jsonb_build_object('expression', coalesce(_config ->> 'expression', 'happy'))
    || jsonb_build_object(
      'flex',
      case
        when _config ->> 'flex' in ('sticker', 'name', 'photo') then _config ->> 'flex'
        else 'sticker'
      end
    )
    || jsonb_build_object('saved_at', now());

  update public.profiles
  set avatar_config = v_out, avatar_type = 'cat', updated_at = now()
  where id = v_user;

  return v_out;
end;
$$;

revoke all on function public.save_cat_avatar(jsonb) from public;
grant execute on function public.save_cat_avatar(jsonb) to authenticated;
