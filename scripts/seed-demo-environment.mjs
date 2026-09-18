#!/usr/bin/env node
/**
 * Apply demo migration (if needed) and seed Aislix Demo Showcase org.
 *
 * Usage (from aislix-frontend):
 *   node scripts/seed-demo-environment.mjs
 *   node scripts/seed-demo-environment.mjs --force
 *
 * Requires in .env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional for migration apply:
 *   SUPABASE_DB_URL or DATABASE_URL (postgres connection string)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const FORCE = process.argv.includes("--force");
const OWNER_EMAIL = process.env.DEMO_OWNER_EMAIL ?? "apurv@aislix.com";

function loadEnv() {
  const path = join(ROOT, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function migrationApplied() {
  const { data, error } = await supabase.rpc("aislix_demo_org_id");
  if (error) return false;
  return Boolean(data);
}

async function applyMigrationViaPg() {
  const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) return false;

  let pg;
  try {
    pg = await import("pg");
  } catch {
    console.log("Optional: npm install pg to auto-apply migration via DATABASE_URL");
    return false;
  }

  const sqlPath = join(ROOT, "supabase/migrations/20260918130000_demo_environment.sql");
  const sql = readFileSync(sqlPath, "utf8");
  const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log("Migration applied via postgres.");
    return true;
  } finally {
    await client.end();
  }
}

async function findOwnerUserId() {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`Could not list users: ${error.message}`);
  const user = data.users.find((u) => u.email?.toLowerCase() === OWNER_EMAIL.toLowerCase());
  if (!user) throw new Error(`Owner user not found: ${OWNER_EMAIL}`);
  return user.id;
}

async function runSeed(ownerId) {
  const { data, error } = await supabase.rpc("seed_aislix_demo_environment", {
    p_owner_user_id: ownerId,
    p_force: FORCE,
  });
  if (error) throw new Error(`Seed failed: ${error.message}`);
  return data;
}

async function validate() {
  const demoOrgId = "d0000000-0000-4000-8000-000000000001";
  const [{ count: audits }, { count: findings }, { count: templates }] = await Promise.all([
    supabase.from("scan_assignments").select("id", { count: "exact", head: true }).eq("org_id", demoOrgId),
    supabase.from("findings").select("id", { count: "exact", head: true }).eq("org_id", demoOrgId),
    supabase
      .from("audit_templates")
      .select("id", { count: "exact", head: true })
      .eq("org_id", demoOrgId)
      .eq("is_system_template", true),
  ]);
  console.log("\nValidation:");
  console.log(`  Templates: ${templates ?? 0}`);
  console.log(`  Audits:    ${audits ?? 0}`);
  console.log(`  Findings:  ${findings ?? 0}`);
}

async function main() {
  console.log("Aislix demo environment seed");
  console.log(`Project: ${url}`);
  console.log(`Owner:   ${OWNER_EMAIL}`);
  console.log(`Force:   ${FORCE}\n`);

  if (!(await migrationApplied())) {
    console.log("Migration not detected — attempting apply...");
    const applied = await applyMigrationViaPg();
    if (!applied && !(await migrationApplied())) {
      console.error(`
Migration not applied. Do ONE of:
  1) Lovable → Supabase → SQL Editor → paste:
     supabase/migrations/20260918130000_demo_environment.sql
  2) Set SUPABASE_DB_URL in .env and: npm install pg && node scripts/seed-demo-environment.mjs
  3) npx supabase db push (linked project)
`);
      process.exit(1);
    }
  } else {
    console.log("Migration already applied.");
  }

  const ownerId = await findOwnerUserId();
  console.log(`Owner user id: ${ownerId}`);

  const result = await runSeed(ownerId);
  console.log("\nSeed result:", JSON.stringify(result, null, 2));

  await validate();
  console.log("\nDone. Publish Lovable frontend if not already live.");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
