-- Google Wallet: a customer can save their stamp card to Google Wallet, and
-- the pass is updated by the server after every stamp, coupon and redeem.
-- Seasonal themes (Christmas, Easter, ...) change how every saved pass looks.
-- The Google API calls happen in the app (src/lib/wallet); the database only
-- remembers which cards have a pass and holds the themes.
-- Re-runnable: guarded alters, create if not exists and create or replace.

-- The Google Wallet object saved for this card (issuer ID + "." + suffix).
-- Null until the customer presses "Add to Google Wallet".
alter table public.cards add column if not exists google_wallet_object_id text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cards_google_wallet_object_id_key') then
    alter table public.cards add constraint cards_google_wallet_object_id_key unique (google_wallet_object_id);
  end if;
end;
$$;

-- The theme the passes were last switched to, so customers are notified once
-- when a theme starts, not every day it is on.
alter table public.cafes add column if not exists wallet_theme_key text;

-- ---------------------------------------------------------------------------
-- Themes
-- ---------------------------------------------------------------------------

create table if not exists public.wallet_themes (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  -- Card background, #rrggbb.
  background_color text not null check (background_color ~ '^#[0-9a-f]{6}$'),
  -- The banner: a built-in image (its name, e.g. "christmas", served from
  -- /wallet/heroes/<name>.png) or the https address of your own image.
  hero_image text not null check (
    char_length(hero_image) <= 500 and (hero_image ~ '^[a-z]{1,20}$' or hero_image ~ '^https://[^\s"<>]+$')
  ),
  -- Optional greeting on the card, e.g. "Merry Christmas from Coffee Pause".
  message_el text check (char_length(message_el) <= 120),
  message_en text check (char_length(message_en) <= 120),
  -- When the theme is on, both days included. With repeats_yearly only the
  -- day and month count, and the range may cross New Year (1 Dec to 6 Jan).
  starts_on date not null,
  ends_on date not null,
  repeats_yearly boolean not null default true,
  -- Send customers a notification when the theme starts.
  notify boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint wallet_themes_ends_after_start check (repeats_yearly or ends_on >= starts_on)
);

create index if not exists wallet_themes_cafe_id_idx on public.wallet_themes (cafe_id);

-- Like cafe info, themes are public (the card page shows the current one).
-- Only the server writes them, after checking the admin role.
alter table public.wallet_themes enable row level security;
revoke all on public.wallet_themes from anon, authenticated;
grant select on public.wallet_themes to anon, authenticated;
grant select, insert, update, delete on public.wallet_themes to service_role;

drop policy if exists wallet_themes_read on public.wallet_themes;
create policy wallet_themes_read on public.wallet_themes
  for select to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Server-only helpers (service role)
-- ---------------------------------------------------------------------------

-- Everything a customer's pass shows, in one call. The coupon is the usable
-- one that expires first; none when there is no usable coupon.
create or replace function public.wallet_pass_data(p_cafe_id uuid, p_customer_id uuid)
returns table (
  card_id uuid,
  object_id text,
  stamp_count integer,
  stamps_required integer,
  display_name text,
  coupon_code text,
  coupon_expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.google_wallet_object_id, c.stamp_count, f.stamps_required, p.display_name, k.code, k.expires_at
  from public.cards c
  join public.cafes f on f.id = c.cafe_id
  join public.profiles p on p.id = c.customer_id
  left join lateral (
    select x.code, x.expires_at from public.coupons x
    where x.cafe_id = c.cafe_id and x.customer_id = c.customer_id
      and x.status = 'valid' and x.expires_at > now()
    order by x.expires_at
    limit 1
  ) k on true
  where c.cafe_id = p_cafe_id and c.customer_id = p_customer_id;
$$;

revoke all on function public.wallet_pass_data(uuid, uuid) from public, anon, authenticated;
grant execute on function public.wallet_pass_data(uuid, uuid) to service_role;

-- Marks up to p_limit coupons that have passed their expiry date as expired
-- (as redeem_coupon does when one is scanned), oldest first. One row per
-- coupon marked, saying whether its customer has a wallet pass to refresh.
-- Used by the daily job, so an expired coupon's QR leaves the pass.
create or replace function public.wallet_expire_coupons(p_cafe_id uuid, p_limit integer)
returns table (customer_id uuid, has_pass boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  return query
  with due as (
    select k.id from public.coupons k
    where k.cafe_id = p_cafe_id and k.status = 'valid' and k.expires_at <= now()
    order by k.expires_at
    limit greatest(p_limit, 0)
    for update skip locked
  ), marked as (
    update public.coupons k set status = 'expired'
    from due where k.id = due.id
    returning k.customer_id
  )
  select m.customer_id, exists (
    select 1 from public.cards c
    where c.cafe_id = p_cafe_id and c.customer_id = m.customer_id and c.google_wallet_object_id is not null
  )
  from marked m;
end;
$$;

revoke all on function public.wallet_expire_coupons(uuid, integer) from public, anon, authenticated;
grant execute on function public.wallet_expire_coupons(uuid, integer) to service_role;

insert into private.applied_migrations (version) values ('20261102000100') on conflict do nothing;
