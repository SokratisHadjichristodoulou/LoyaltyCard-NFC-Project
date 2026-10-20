// The database migrations this version of the code needs. Keep in sync with
// supabase/migrations/ (src/lib/migrations.test.ts fails otherwise).
// No server-only imports: also used by scripts/db-check.ts.

export const EXPECTED_MIGRATIONS = [
  "20261021000100", // core schema
  "20261021000200", // row level security
  "20261021000300", // record_stamp
  "20261021000400", // redeem_coupon
  "20261021000500", // admin reports
  "20261021000600", // NFC tap counters, one stamp per tap
  "20261021000700", // migration tracking
] as const;

export type SchemaStatus =
  | { ok: true }
  | { ok: false; missing: string[]; trackerMissing: boolean };

/**
 * Compares what the database reports with what the code needs.
 * applied is null when the tracker itself (20261021000700) isn't there yet.
 */
export function compareMigrations(applied: readonly string[] | null): SchemaStatus {
  if (applied === null) {
    return { ok: false, missing: ["20261021000700"], trackerMissing: true };
  }
  const missing = EXPECTED_MIGRATIONS.filter((v) => !applied.includes(v));
  return missing.length ? { ok: false, missing, trackerMissing: false } : { ok: true };
}
