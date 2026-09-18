#!/usr/bin/env node
/**
 * Upload shelf images into demo org audits (audit_evidence + scan_images).
 *
 * Usage:
 *   node scripts/backfill-demo-evidence.mjs
 *   node scripts/backfill-demo-evidence.mjs --images-dir "D:\\Grocer-Help\\train\\images"
 *   node scripts/backfill-demo-evidence.mjs --dry-run --limit-scans 5
 *   node scripts/backfill-demo-evidence.mjs --force   # re-upload even if path exists
 *
 * Requires .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DEMO_ORG_ID = "d0000000-0000-4000-8000-000000000001";
const BUCKET = "scan-images";
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]);

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");
const dirIdx = args.indexOf("--images-dir");
const IMAGES_DIR =
  dirIdx >= 0 && args[dirIdx + 1]
    ? args[dirIdx + 1]
    : "D:\\Grocer-Help\\train\\images";
const limitIdx = args.indexOf("--limit-scans");
const LIMIT_SCANS = limitIdx >= 0 && args[limitIdx + 1] ? Number(args[limitIdx + 1]) : null;
const CONCURRENCY = 6;

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

function mimeForExt(ext) {
  const e = ext.toLowerCase();
  if (e === ".png") return "image/png";
  if (e === ".webp") return "image/webp";
  if (e === ".heic" || e === ".heif") return "image/heic";
  return "image/jpeg";
}

function listImages(dir) {
  if (!existsSync(dir)) throw new Error(`Images directory not found: ${dir}`);
  return readdirSync(dir)
    .filter((name) => IMAGE_EXTS.has(extname(name).toLowerCase()))
    .map((name) => join(dir, name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function chunkArray(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
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

async function fetchDemoScans() {
  const { data, error } = await supabase
    .from("shelf_scans")
    .select("id, org_id, created_at")
    .eq("org_id", DEMO_ORG_ID)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Could not load demo scans: ${error.message}`);
  return data ?? [];
}

async function fetchOwnerId() {
  const email = process.env.DEMO_OWNER_EMAIL ?? "apurv@aislix.com";
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(error.message);
  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error(`Owner not found: ${email}`);
  return user.id;
}

async function uploadOne({ scanId, orgId, ownerId, imagePath, binKey, isPrimary }) {
  const ext = extname(imagePath).toLowerCase() || ".jpg";
  const safeName = basename(imagePath).replace(/[^\w.-]+/g, "_");
  const storagePath = `${orgId}/${scanId}/evidence/${binKey}-${safeName}`;

  if (!FORCE) {
    const { data: existing } = await supabase.storage.from(BUCKET).list(`${orgId}/${scanId}/evidence`, {
      limit: 1,
      search: binKey,
    });
    if (existing?.length) {
      return { skipped: true, storagePath };
    }
  }

  if (DRY_RUN) {
    return { dryRun: true, storagePath };
  }

  const fileBuffer = readFileSync(imagePath);
  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(storagePath, fileBuffer, {
    contentType: mimeForExt(ext),
    upsert: FORCE,
  });
  if (uploadErr) throw new Error(`Upload failed ${storagePath}: ${uploadErr.message}`);

  const capturedAt = new Date().toISOString();
  const { error: evidenceErr } = await supabase.from("audit_evidence").upsert(
    {
      scan_id: scanId,
      org_id: orgId,
      bin_key: binKey,
      storage_path: storagePath,
      captured_by: ownerId,
      captured_at: capturedAt,
    },
    { onConflict: "scan_id,bin_key" },
  );
  if (evidenceErr) throw new Error(`audit_evidence upsert failed: ${evidenceErr.message}`);

  if (isPrimary) {
    const row = {
      scan_id: scanId,
      kind: "original",
      storage_bucket: BUCKET,
      storage_path: storagePath,
      mime_type: mimeForExt(ext),
      file_size_bytes: statSync(imagePath).size,
      captured_at: capturedAt,
    };
    const { data: existingImg } = await supabase
      .from("scan_images")
      .select("id")
      .eq("scan_id", scanId)
      .eq("kind", "original")
      .maybeSingle();
    if (existingImg && FORCE) {
      const { error: updateErr } = await supabase.from("scan_images").update(row).eq("id", existingImg.id);
      if (updateErr) throw new Error(`scan_images update failed: ${updateErr.message}`);
    } else if (!existingImg) {
      const { error: insertErr } = await supabase.from("scan_images").insert(row);
      if (insertErr) throw new Error(`scan_images insert failed: ${insertErr.message}`);
    }
  }

  return { uploaded: true, storagePath };
}

async function main() {
  console.log("Demo evidence backfill");
  console.log(`  Images dir: ${IMAGES_DIR}`);
  console.log(`  Dry run:    ${DRY_RUN}`);
  console.log(`  Force:      ${FORCE}\n`);

  const images = listImages(IMAGES_DIR);
  let scans = await fetchDemoScans();
  if (!scans.length) {
    console.error("No demo scans found. Run: node scripts/seed-demo-environment.mjs");
    process.exit(1);
  }
  if (LIMIT_SCANS) scans = scans.slice(0, LIMIT_SCANS);

  const ownerId = await fetchOwnerId();
  const perScan = Math.ceil(images.length / scans.length);
  console.log(`  Images:     ${images.length}`);
  console.log(`  Scans:      ${scans.length}`);
  console.log(`  Per scan:   ~${perScan}\n`);

  const tasks = [];
  for (let s = 0; s < scans.length; s++) {
    const scan = scans[s];
    const batch = images.slice(s * perScan, (s + 1) * perScan);
    batch.forEach((imagePath, j) => {
      tasks.push({
        scanId: scan.id,
        orgId: scan.org_id,
        ownerId,
        imagePath,
        binKey: j === 0 ? "bin-1" : `bin-${j + 1}`,
        isPrimary: j === 0,
      });
    });
  }

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  const batches = chunkArray(tasks, 50);
  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    await mapPool(batch, CONCURRENCY, async (task) => {
      try {
        const result = await uploadOne(task);
        if (result.skipped) skipped++;
        else if (result.uploaded || result.dryRun) uploaded++;
      } catch (err) {
        failed++;
        console.error(`  FAIL ${basename(task.imagePath)} → ${task.scanId}: ${err.message}`);
      }
    });
    console.log(`  Progress: ${Math.min((b + 1) * 50, tasks.length)}/${tasks.length}`);
  }

  console.log("\nSummary:");
  console.log(`  Uploaded/dry: ${uploaded}`);
  console.log(`  Skipped:      ${skipped}`);
  console.log(`  Failed:       ${failed}`);

  if (!DRY_RUN && failed === 0) {
    const { count } = await supabase
      .from("audit_evidence")
      .select("id", { count: "exact", head: true })
      .eq("org_id", DEMO_ORG_ID);
    console.log(`  audit_evidence rows in demo org: ${count ?? 0}`);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
