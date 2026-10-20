// Checks that the Supabase project has every migration this code needs.
// Run it before deploying:
//
//   npm run db:check
//
// Uses NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (.env.local).

import { createClient } from "@supabase/supabase-js";
import { EXPECTED_MIGRATIONS, compareMigrations } from "../src/lib/migrations";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(2);
}

async function main(url: string, key: string) {
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("applied_migrations");
  if (error && error.code !== "PGRST202") {
    console.error(`Could not reach the database: ${error.message}`);
    process.exit(2);
  }

  const status = compareMigrations(error ? null : ((data as string[] | null) ?? []));
  if (status.ok) {
    console.log(`Database is up to date (${EXPECTED_MIGRATIONS.length} migrations).`);
  } else {
    console.error(
      status.trackerMissing
        ? "The database is behind: the migration tracker (20261021000700) and possibly earlier migrations haven't run."
        : `The database is missing ${status.missing.length} migration(s): ${status.missing.join(", ")}`,
    );
    console.error("Run: npx supabase db push");
    process.exit(1);
  }
}

main(url, key);
