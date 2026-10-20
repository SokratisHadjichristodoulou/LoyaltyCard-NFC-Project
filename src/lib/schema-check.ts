import "server-only";
import { cache } from "react";
import { compareMigrations, type SchemaStatus } from "./migrations";
import { createAdminClient } from "./supabase/admin";

/** Is the database up to date with this code? Read with the service role. */
export const checkSchema = cache(async (): Promise<SchemaStatus> => {
  const { data, error } = await createAdminClient().rpc("applied_migrations");
  // PGRST202: the function doesn't exist, i.e. the tracker migration hasn't run.
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") return compareMigrations(null);
    throw error;
  }
  return compareMigrations(data ?? []);
});
