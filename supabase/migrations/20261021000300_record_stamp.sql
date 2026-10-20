-- Adding a stamp, in one place and in one transaction:
--   * creates the customer's card on first use
--   * enforces the cafe's cooldown between stamps
--   * logs the stamp
--   * at stamps_required, issues a coupon and starts the card again
-- Called by the server with the service role (the NFC tap route, and the
-- dev-only test button). Customers cannot call it.
-- Re-runnable: create or replace.

create or replace function public.record_stamp(p_cafe_id uuid, p_customer_id uuid, p_tag_id uuid default null)
returns table (
  result text,            -- 'stamped' | 'coupon_issued' | 'cooldown'
  stamp_count integer,    -- stamps on the card after this call
  stamps_required integer,
  coupon_code text,       -- set when result = 'coupon_issued'
  retry_after_seconds integer -- set when result = 'cooldown'
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

  -- Lock the card so two taps at the same moment are handled one after the other.
  select * into v_card from public.cards c
  where c.cafe_id = p_cafe_id and c.customer_id = p_customer_id
  for update;

  select max(s.created_at) into v_last from public.stamps s where s.card_id = v_card.id;
  v_next_allowed := v_last + make_interval(secs => v_cafe.stamp_cooldown_seconds);
  if v_last is not null and v_next_allowed > now() then
    return query select 'cooldown'::text, v_card.stamp_count, v_cafe.stamps_required, null::text,
      ceil(extract(epoch from v_next_allowed - now()))::integer;
    return;
  end if;

  insert into public.stamps (cafe_id, card_id, customer_id, tag_id)
  values (p_cafe_id, v_card.id, p_customer_id, p_tag_id);

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

revoke all on function public.record_stamp(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_stamp(uuid, uuid, uuid) to service_role;
