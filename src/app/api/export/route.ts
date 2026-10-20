import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/export?type=customers|stamps  (admin only)
 * CSV with a UTF-8 byte-order mark so Excel shows Greek names correctly.
 */
export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "signed_out" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "not_allowed" }, { status: 403 });

  const type = request.nextUrl.searchParams.get("type");
  const supabase = await createClient();
  let rows: (string | number | null)[][];

  if (type === "customers") {
    const { data, error } = await supabase.rpc("admin_customers");
    if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
    rows = [
      ["email", "name", "stamps_on_card", "stamps_total", "coupons_active", "coupons_used", "last_stamp_at", "joined_at"],
      ...(data ?? []).map((r) => [r.email, r.display_name, r.stamp_count, r.stamps_total, r.coupons_valid, r.coupons_used, r.last_stamp_at, r.joined_at]),
    ];
  } else if (type === "stamps") {
    const { data, error } = await supabase.rpc("admin_stamp_log", {});
    if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
    rows = [["stamped_at", "email", "name", "tag"], ...(data ?? []).map((r) => [r.stamped_at, r.email, r.display_name, r.tag_label])];
  } else {
    return NextResponse.json({ error: "bad_type" }, { status: 400 });
  }

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse("﻿" + rows.map(toCsvLine).join("\r\n") + "\r\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="coffee-pause-${type}-${date}.csv"`,
      "cache-control": "no-store",
    },
  });
}

function toCsvLine(cells: (string | number | null)[]) {
  return cells
    .map((cell) => {
      if (cell === null || cell === undefined) return "";
      let s = String(cell);
      // Keep spreadsheet apps from running a cell as a formula.
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(",");
}
