-- NFC tap bookkeeping. After the server has checked a tap's signature, it
-- calls consume_tag_tap with the tag UID and the tap counter. The counter must
-- be higher than the last one seen, so a copied or replayed tap URL is refused.
-- The update is atomic: two requests with the same counter cannot both pass.
-- Re-runnable: guarded alter and create or replace.

alter table public.tags add column if not exists last_tap_at timestamptz;

create or replace function public.consume_tag_tap(p_uid text, p_counter bigint)
returns table (
  result text,     -- 'ok' | 'unknown_tag' | 'inactive' | 'replayed'
  tag_id uuid,
  cafe_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_tag public.tags;
begin
  update public.tags t
  set last_counter = p_counter, last_tap_at = now()
  where t.tag_uid = upper(btrim(p_uid)) and t.active and t.last_counter < p_counter
  returning * into v_tag;
  if found then
    return query select 'ok'::text, v_tag.id, v_tag.cafe_id;
    return;
  end if;

  select * into v_tag from public.tags t where t.tag_uid = upper(btrim(p_uid));
  if not found then
    return query select 'unknown_tag'::text, null::uuid, null::uuid;
  elsif not v_tag.active then
    return query select 'inactive'::text, v_tag.id, v_tag.cafe_id;
  else
    return query select 'replayed'::text, v_tag.id, v_tag.cafe_id;
  end if;
end;
$$;

revoke all on function public.consume_tag_tap(text, bigint) from public, anon, authenticated;
grant execute on function public.consume_tag_tap(text, bigint) to service_role;

-- Each tap can give at most one stamp: the stamp remembers the tap counter it
-- came from, and (tag, counter) is unique. This also covers a tap that waits
-- in a cookie while the customer signs in.
alter table public.stamps add column if not exists tag_counter bigint;
create unique index if not exists stamps_one_per_tap on public.stamps (tag_id, tag_counter)
  where tag_id is not null and tag_counter is not null;

-- record_stamp gains p_tag_counter and a 'duplicate' result. Same rules as
-- before (20261021000300_record_stamp.sql) otherwise.
drop function if exists public.record_stamp(uuid, uuid, uuid);

create or replace function public.record_stamp(
  p_cafe_id uuid,
  p_customer_id uuid,
  p_tag_id uuid default null,
  p_tag_counter bigint default null
)
returns table (
  result text,            -- 'stamped' | 'coupon_issued' | 'cooldown' | 'duplicate'
  stamp_count integer,
  stamps_required integer,
  coupon_code text,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_cafe public.cafes;
  v_card public.cards;
  v_last timestamptz;
  v_next_allowed timestamptz;
  v_code text;
  v_count integer;
begin
  select * into v_cafe from public.cafes c where c.id = p_cafe_id;
  if not found then
    raise exception 'unknown cafe %', p_cafe_id using errcode = '22023';
  end if;

  insert into public.cards (cafe_id, customer_id)
  values (p_cafe_id, p_customer_id)
  on conflict (cafe_id, customer_id) do nothing;

  select * into v_card from public.cards c
  where c.cafe_id = p_cafe_id and c.customer_id = p_customer_id
  for update;

  if p_tag_id is not null and p_tag_counter is not null and exists (
    select 1 from public.stamps s where s.tag_id = p_tag_id and s.tag_counter = p_tag_counter
  ) then
    return query select 'duplicate'::text, v_card.stamp_count, v_cafe.stamps_required, null::text, null::integer;
    return;
  end if;

  select max(s.created_at) into v_last from public.stamps s where s.card_id = v_card.id;
  v_next_allowed := v_last + make_interval(secs => v_cafe.stamp_cooldown_seconds);
  if v_last is not null and v_next_allowed > now() then
    return query select 'cooldown'::text, v_card.stamp_count, v_cafe.stamps_required, null::text,
      ceil(extract(epoch from v_next_allowed - now()))::integer;
    return;
  end if;

  insert into public.stamps (cafe_id, card_id, customer_id, tag_id, tag_counter)
  values (p_cafe_id, v_card.id, p_customer_id, p_tag_id, p_tag_counter);

  v_count := v_card.stamp_count + 1;
  if v_count >= v_cafe.stamps_required then
    insert into public.coupons (cafe_id, customer_id, expires_at)
    values (p_cafe_id, p_customer_id, now() + make_interval(days => v_cafe.coupon_valid_days))
    returning code into v_code;
    v_count := v_count - v_cafe.stamps_required;
  end if;

  update public.cards c set stamp_count = v_count where c.id = v_card.id;

  return query select (case when v_code is null then 'stamped' else 'coupon_issued' end)::text,
    v_count, v_cafe.stamps_required, v_code, null::integer;
end;
$$;

revoke all on function public.record_stamp(uuid, uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.record_stamp(uuid, uuid, uuid, bigint) to service_role;
