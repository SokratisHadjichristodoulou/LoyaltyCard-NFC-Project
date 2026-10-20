import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** GET /api/account/export: everything we keep about the signed-in customer, as JSON. */
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "signed_out" }, { status: 401 });

  // Read as the customer: RLS returns only their own rows.
  const supabase = await createClient();
  const [profile, cards, stamps, coupons] = await Promise.all([
    supabase.from("profiles").select("display_name, preferred_language, created_at").eq("id", user.id).single(),
    supabase.from("cards").select("stamp_count, updated_at, cafes(name)"),
    supabase.from("stamps").select("created_at").order("created_at"),
    supabase.from("coupons").select("code, status, issued_at, expires_at, redeemed_at").order("issued_at"),
  ]);
  if (profile.error || cards.error || stamps.error || coupons.error) {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  const body = {
    exported_at: new Date().toISOString(),
    email: user.email,
    profile: profile.data,
    cards: cards.data,
    stamps: stamps.data,
    coupons: coupons.data,
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="coffee-pause-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
