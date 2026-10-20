import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { checkSchema } from "@/lib/schema-check";

/**
 * GET /api/health: 200 when the site can reach its database and every
 * migration this code needs has run; 503 otherwise. For uptime monitors and
 * for checking a deploy.
 */
export async function GET() {
  const headers = { "cache-control": "no-store" };
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ status: "error", reason: "supabase_not_configured" }, { status: 503, headers });
  }
  try {
    const schema = await checkSchema();
    return schema.ok
      ? NextResponse.json({ status: "ok" }, { headers })
      : NextResponse.json({ status: "error", reason: "migrations_missing", missing: schema.missing }, { status: 503, headers });
  } catch {
    return NextResponse.json({ status: "error", reason: "database_unreachable" }, { status: 503, headers });
  }
}
