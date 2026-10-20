-- Redeeming a coupon, atomically. Called by the server route /api/redeem with
-- the service role, after it has checked the signed-in user's role. The
-- function checks the role again itself, so a bug in the route cannot let a
-- customer redeem. A coupon can only ever be redeemed once: the row is locked
-- and its status checked in the same transaction.
-- Re-runnable: create or replace.

create or replace function public.redeem_coupon(p_code text, p_staff_id uuid)
returns table (
  result text,             -- 'redeemed' | 'already_used' | 'expired' | 'not_found' | 'not_allowed'
  code text,
  issued_at timestamptz,
  expires_at timestamptz,
  redeemed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_cafe uuid;
  v_coupon public.coupons;
begin
  select p.cafe_id into v_cafe from public.profiles p
  where p.id = p_staff_id and p.role in ('staff', 'admin');
  if v_cafe is null then
    return query select 'not_allowed'::text, null::text, null::timestamptz, null::timestamptz, null::timestamptz;
    return;
  end if;

  -- Only coupons from the staff member's own cafe can be found.
  select * into v_coupon from public.coupons c
  where c.code = upper(btrim(p_code)) and c.cafe_id = v_cafe
  for update;
  if not found then
    return query select 'not_found'::text, null::text, null::timestamptz, null::timestamptz, null::timestamptz;
    return;
  end if;

  if v_coupon.status = 'used' then
    return query select 'already_used'::text, v_coupon.code, v_coupon.issued_at, v_coupon.expires_at, v_coupon.redeemed_at;
    return;
  end if;

  if v_coupon.status = 'expired' or v_coupon.expires_at <= now() then
    update public.coupons c set status = 'expired' where c.id = v_coupon.id and c.status = 'valid';
    return query select 'expired'::text, v_coupon.code, v_coupon.issued_at, v_coupon.expires_at, null::timestamptz;
    return;
  end if;

  update public.coupons c
  set status = 'used', redeemed_at = now(), redeemed_by = p_staff_id
  where c.id = v_coupon.id
  returning * into v_coupon;

  return query select 'redeemed'::text, v_coupon.code, v_coupon.issued_at, v_coupon.expires_at, v_coupon.redeemed_at;
end;
$$;

revoke all on function public.redeem_coupon(text, uuid) from public, anon, authenticated;
grant execute on function public.redeem_coupon(text, uuid) to service_role;
