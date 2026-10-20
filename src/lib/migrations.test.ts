import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXPECTED_MIGRATIONS, compareMigrations } from "./migrations";

const dir = join(__dirname, "../../supabase/migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const versions = files.map((f) => f.slice(0, 14));

describe("migration list", () => {
  it("matches the files in supabase/migrations", () => {
    expect([...EXPECTED_MIGRATIONS]).toEqual(versions);
  });

  it("every migration from the tracker on records itself", () => {
    for (const file of files.filter((f) => f >= "20261021000700")) {
      const sql = readFileSync(join(dir, file), "utf8");
      expect(sql, file).toContain(`insert into private.applied_migrations (version) values ('${file.slice(0, 14)}') on conflict do nothing;`);
    }
  });
});

describe("compareMigrations", () => {
  it("is ok when everything has run", () => {
    expect(compareMigrations([...EXPECTED_MIGRATIONS])).toEqual({ ok: true });
  });
  it("lists what is missing", () => {
    const applied = EXPECTED_MIGRATIONS.filter((v) => v !== "20261021000500" && v !== "20261021000700");
    expect(compareMigrations(applied)).toEqual({ ok: false, missing: ["20261021000500", "20261021000700"], trackerMissing: false });
  });
  it("says so when the tracker itself is missing", () => {
    expect(compareMigrations(null)).toEqual({ ok: false, missing: ["20261021000700"], trackerMissing: true });
  });
});
