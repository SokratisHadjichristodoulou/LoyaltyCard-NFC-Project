import { NextResponse, type NextRequest } from "next/server";
import { areaRoles, getProfile } from "@/lib/auth";
import { siteOrigin } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/redeem  { "code": "CP-XXXX-XXXX-XXXX-XXXX" }
 * Staff or admin only. The database function checks the role again and
 * redeems at most once.
 */
export async function POST(request: NextRequest) {
  // Only our own pages may call this (blocks cross-site form posts).
  const origin = request.headers.get("origin");
  if (!origin || (origin !== (await siteOrigin()) && origin !== request.nextUrl.origin)) {
    return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  }

  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "signed_out" }, { status: 401 });
  if (!areaRoles.staff.includes(profile.role)) return NextResponse.json({ error: "not_allowed" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!code || code.length > 64) return NextResponse.json({ error: "bad_code" }, { status: 400 });

  const { data, error } = await createAdminClient()
    .rpc("redeem_coupon", { p_code: code, p_staff_id: profile.id })
    .single();
  if (error || !data) return NextResponse.json({ error: "server_error" }, { status: 500 });

  return NextResponse.json({
    result: data.result,
    coupon: data.code ? { code: data.code, expiresAt: data.expires_at, redeemedAt: data.redeemed_at } : null,
  });
}
