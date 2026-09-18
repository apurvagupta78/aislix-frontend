#!/usr/bin/env node
/**
 * Upload shelf images into demo org audits (audit_evidence + scan_images).
 * Default: 20 images from D:\Demo Images, one image per demo scan.
 *
 * Usage:
 *   node scripts/backfill-demo-evidence.mjs
 *   node scripts/backfill-demo-evidence.mjs --images-dir "D:\\Demo Images" --max-images 20
 *   node scripts/backfill-demo-evidence.mjs --dry-run
 *   node scripts/backfill-demo-evidence.mjs --force
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
const DEFAULT_IMAGES_DIR = "D:\\Demo Images";
const DEFAULT_MAX_IMAGES = 20;

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");
const dirIdx = args.indexOf("--images-dir");
const IMAGES_DIR = dirIdx >= 0 && args[dirIdx + 1] ? args[dirIdx + 1] : DEFAULT_IMAGES_DIR;
const maxIdx = args.indexOf("--max-images");
const MAX_IMAGES =
  maxIdx >= 0 && args[maxIdx + 1] ? Number(args[maxIdx + 1]) : DEFAULT_MAX_IMAGES;
const limitIdx = args.indexOf("--limit-scans");
const LIMIT_SCANS = limitIdx >= 0 && args[limitIdx + 1] ? Number(args[limitIdx + 1]) : null;
const CONCURRENCY = 6;

function loadEnv() {
  for (const path of [join(ROOT, ".env"), join(ROOT, "..", "aislix-backend", ".env")]) {
    if (!existsSync(path)) continue;
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

async function mapPool(items, limit, fn) {
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (items.length) {
        const item = items.shift();
        if (item) await fn(item);
      }
    }),
  );
}

loadEnv();

const keyFileIdx = args.indexOf("--service-key-file");
if (keyFileIdx >= 0 && args[keyFileIdx + 1] && existsSync(args[keyFileIdx + 1])) {
  const keyVal = readFileSync(args[keyFileIdx + 1], "utf8").trim();
  if (keyVal) process.env.SUPABASE_SERVICE_ROLE_KEY = keyVal;
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(`Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.
Add to aislix-frontend/.env, or run:
  node scripts/backfill-demo-evidence.mjs --service-key-file path\\to\\key.txt
Get the key from Supabase Dashboard → Project Settings → API → service_role (secret).`);
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

async function uploadOne({ scanId, orgId, ownerId, imagePath }) {
  const ext = extname(imagePath).toLowerCase() || ".jpg";
  const safeName = basename(imagePath).replace(/[^\w.-]+/g, "_");
  const storagePath = `${orgId}/${scanId}/evidence/bin-1-${safeName}`;

  if (!FORCE && !DRY_RUN) {
    const { data: existingEvidence } = await supabase
      .from("audit_evidence")
      .select("storage_path")
      .eq("scan_id", scanId)
      .eq("bin_key", "bin-1")
      .maybeSingle();
    if (existingEvidence?.storage_path === storagePath) {
      const { data: listed } = await supabase.storage.from(BUCKET).list(`${orgId}/${scanId}/evidence`, {
        search: safeName,
        limit: 1,
      });
      if (listed?.length) return { skipped: true, storagePath };
    }
  }

  if (DRY_RUN) {
    console.log(`  [dry-run] ${basename(imagePath)} → scan ${scanId.slice(0, 8)}…`);
    return { dryRun: true, storagePath };
  }

  const fileBuffer = readFileSync(imagePath);
  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(storagePath, fileBuffer, {
    contentType: mimeForExt(ext),
    upsert: true,
  });
  if (uploadErr) throw new Error(`Upload failed ${storagePath}: ${uploadErr.message}`);

  const capturedAt = new Date().toISOString();
  const { error: evidenceErr } = await supabase.from("audit_evidence").upsert(
    {
      scan_id: scanId,
      org_id: orgId,
      bin_key: "bin-1",
      storage_path: storagePath,
      captured_by: ownerId,
      captured_at: capturedAt,
    },
    { onConflict: "scan_id,bin_key" },
  );
  if (evidenceErr) throw new Error(`audit_evidence upsert failed: ${evidenceErr.message}`);

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
  if (existingImg) {
    const { error: updateErr } = await supabase.from("scan_images").update(row).eq("id", existingImg.id);
    if (updateErr) throw new Error(`scan_images update failed: ${updateErr.message}`);
  } else {
    const { error: insertErr } = await supabase.from("scan_images").insert(row);
    if (insertErr) throw new Error(`scan_images insert failed: ${insertErr.message}`);
  }

  console.log(`  OK ${basename(imagePath)} → ${scanId.slice(0, 8)}…`);
  return { uploaded: true, storagePath };
}

async function main() {
  console.log("Demo evidence backfill (1 image per scan)");
  console.log(`  Images dir:  ${IMAGES_DIR}`);
  console.log(`  Max images:  ${MAX_IMAGES}`);
  console.log(`  Dry run:     ${DRY_RUN}`);
  console.log(`  Force:       ${FORCE}\n`);

  const allImages = listImages(IMAGES_DIR).slice(0, MAX_IMAGES);
  if (!allImages.length) {
    console.error(`No images found in ${IMAGES_DIR}`);
    process.exit(1);
  }

  let scans = await fetchDemoScans();
  if (!scans.length) {
    console.error("No demo scans found. Run: node scripts/seed-demo-environment.mjs");
    process.exit(1);
  }

  const pairCount = LIMIT_SCANS
    ? Math.min(LIMIT_SCANS, allImages.length, scans.length)
    : Math.min(allImages.length, scans.length);
  scans = scans.slice(0, pairCount);
  const images = allImages.slice(0, pairCount);

  const ownerId = await fetchOwnerId();
  console.log(`  Pairing:     ${images.length} images → ${scans.length} scans\n`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  const tasks = images.map((imagePath, i) => ({
    scanId: scans[i].id,
    orgId: scans[i].org_id,
    ownerId,
    imagePath,
  }));

  const queue = [...tasks];
  await mapPool(queue, CONCURRENCY, async (task) => {
    try {
      const result = await uploadOne(task);
      if (result.skipped) skipped++;
      else if (result.uploaded || result.dryRun) uploaded++;
    } catch (err) {
      failed++;
      console.error(`  FAIL ${basename(task.imagePath)}: ${err.message}`);
    }
  });

  console.log("\nSummary:");
  console.log(`  Uploaded/dry: ${uploaded}`);
  console.log(`  Skipped:      ${skipped}`);
  console.log(`  Failed:       ${failed}`);

  if (!DRY_RUN && failed === 0) {
    const { count: evidenceCount } = await supabase
      .from("audit_evidence")
      .select("id", { count: "exact", head: true })
      .eq("org_id", DEMO_ORG_ID);
    const pairedScanIds = scans.map((s) => s.id);
    const { count: scanImgCount } = await supabase
      .from("scan_images")
      .select("id", { count: "exact", head: true })
      .in("scan_id", pairedScanIds)
      .eq("kind", "original");
    console.log(`  audit_evidence rows (demo org): ${evidenceCount ?? "?"}`);
    console.log(`  scan_images original (paired scans): ${scanImgCount ?? "?"}`);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
