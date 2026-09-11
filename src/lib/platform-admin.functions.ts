/**
 * Platform admin console — cross-tenant reads via service role.
 * Caller must be signed in and listed in platform_access_grants.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  requirePlatformAdminContext,
  resolveAdminScanAssetUrls,
  resolveAdminScanPreviewUrls,
  type ScanAssetUrls,
} from "@/lib/platform-admin.server";

export type PlatformAdminAccess = {
  email: string;
  requiresAdminPassword: boolean;
};

export type PlatformAdminOverview = {
  organizations: number;
  users: number;
  shelf_scans: number;
  completed_scans: number;
  failed_scans: number;
  landing_demo_sessions: number;
  stores: number;
};

export type PlatformScanRow = {
  id: string;
  created_at: string;
  status: string;
  created_by: string | null;
  user_email: string | null;
  user_name: string | null;
  org_id: string;
  org_name: string | null;
  store_name: string | null;
  category: string | null;
  sub_category: string | null;
  shelf_label: string | null;
  total_products: number;
  shelf_health_score: number | null;
  planogram_compliance_percent: number | null;
  error_message: string | null;
  preview_image_url?: string | null;
};

export type PlatformUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  onboarding_completed_at: string | null;
  org_count: number;
  scan_count: number;
  orgs: { org_id: string; org_name: string; role: string; status: string }[];
};

export type PlatformOrgRow = {
  id: string;
  name: string;
  created_at: string;
  owner_id: string;
  owner_email: string | null;
  customer_type: string | null;
  member_count: number;
  store_count: number;
  scan_count: number;
  plan_code: string | null;
  plan_name: string | null;
  scans_used: number | null;
  subscription_status: string | null;
};

export type PlatformScanDetail = {
  scan: PlatformScanRow;
  assets: ScanAssetUrls;
  detected_products: {
    id: string;
    brand: string | null;
    name: string;
    variant: string | null;
    facings: number;
    confidence: number | null;
    stock_status: string;
    sku: string | null;
  }[];
  scan_result: {
    executive_summary: string | null;
    confidence_avg: number | null;
    model_version: string | null;
    metrics: Record<string, unknown> | null;
    alerts: unknown[] | null;
    recommendations: unknown[] | null;
    brand_share: unknown[] | null;
    category_breakdown: unknown[] | null;
    shelf_rows: unknown[] | null;
    raw_payload: Record<string, unknown> | null;
  } | null;
};

function jsonArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

async function adminEmail(context: { claims?: { email?: string } }): Promise<string> {
  const email = String(context.claims?.email ?? "").toLowerCase();
  if (!email) throw new Error("Sign in with your platform admin account.");
  return email;
}

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const checkPlatformAdminAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { adminPassword?: string } | undefined) => input ?? {})
  .handler(async ({ data, context }): Promise<PlatformAdminAccess> => {
    const email = await adminEmail(context);
    const db = await adminDb();
    await requirePlatformAdminContext(db, email, data.adminPassword);
    return {
      email,
      requiresAdminPassword: Boolean(process.env["ADMIN_CONSOLE_PASSWORD"]?.trim()),
    };
  });

export const getPlatformAdminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlatformAdminOverview> => {
    const email = await adminEmail(context);
    const db = await adminDb();
    await requirePlatformAdminContext(db, email);

    const [
      orgs,
      users,
      scans,
      completed,
      failed,
      demos,
      stores,
    ] = await Promise.all([
      db.from("organizations").select("id", { count: "exact", head: true }),
      db.from("profiles").select("id", { count: "exact", head: true }),
      db.from("shelf_scans").select("id", { count: "exact", head: true }),
      db.from("shelf_scans").select("id", { count: "exact", head: true }).eq("status", "completed"),
      db.from("shelf_scans").select("id", { count: "exact", head: true }).eq("status", "failed"),
      db.from("landing_demo_sessions").select("id", { count: "exact", head: true }),
      db.from("stores").select("id", { count: "exact", head: true }),
    ]);

    const err = orgs.error ?? users.error ?? scans.error ?? completed.error ?? failed.error ?? demos.error ?? stores.error;
    if (err) throw new Error(err.message);

    return {
      organizations: orgs.count ?? 0,
      users: users.count ?? 0,
      shelf_scans: scans.count ?? 0,
      completed_scans: completed.count ?? 0,
      failed_scans: failed.count ?? 0,
      landing_demo_sessions: demos.count ?? 0,
      stores: stores.count ?? 0,
    };
  });

export const listPlatformScans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { page?: number; pageSize?: number; userId?: string; orgId?: string; status?: string; q?: string } | undefined) => ({
      page: Math.max(Number(input?.page ?? 1) || 1, 1),
      pageSize: Math.min(Math.max(Number(input?.pageSize ?? 25) || 25, 1), 100),
      userId: input?.userId?.trim() || undefined,
      orgId: input?.orgId?.trim() || undefined,
      status: input?.status?.trim() || undefined,
      q: input?.q?.trim() || undefined,
    }),
  )
  .handler(async ({ data, context }): Promise<{ rows: PlatformScanRow[]; total: number }> => {
    const email = await adminEmail(context);
    const db = await adminDb();
    await requirePlatformAdminContext(db, email);

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    let query = db
      .from("shelf_scans")
      .select(
        `
        id, created_at, status, created_by, org_id, category, sub_category_label,
        shelf_label, total_products, shelf_health_score, planogram_compliance_percent, error_message,
        organizations(name),
        profiles:created_by(email, full_name),
        stores(name)
      `,
        { count: "exact" },
      )
      .order("created_at", { ascending: false });

    if (data.userId) query = query.eq("created_by", data.userId);
    if (data.orgId) query = query.eq("org_id", data.orgId);
    if (data.status && data.status !== "all") query = query.eq("status", data.status);
    if (data.q) {
      query = query.or(
        `id.ilike.%${data.q}%,category.ilike.%${data.q}%,shelf_label.ilike.%${data.q}%,sub_category_label.ilike.%${data.q}%`,
      );
    }

    const { data: rows, error, count } = await query.range(from, to);
    if (error) throw new Error(error.message);

    const scanIds = (rows ?? []).map((row) => row.id as string);
    const previews = await resolveAdminScanPreviewUrls(db, scanIds);

    return {
      total: count ?? 0,
      rows: (rows ?? []).map((row) => {
        const org = row.organizations as { name?: string } | null;
        const profile = row.profiles as { email?: string; full_name?: string } | null;
        const store = row.stores as { name?: string } | null;
        return {
          id: row.id as string,
          created_at: row.created_at as string,
          status: String(row.status),
          created_by: (row.created_by as string | null) ?? null,
          user_email: profile?.email ?? null,
          user_name: profile?.full_name ?? null,
          org_id: row.org_id as string,
          org_name: org?.name ?? null,
          store_name: store?.name ?? null,
          category: (row.category as string | null) ?? null,
          sub_category: (row.sub_category_label as string | null) ?? null,
          shelf_label: (row.shelf_label as string | null) ?? null,
          total_products: Number(row.total_products ?? 0),
          shelf_health_score:
            typeof row.shelf_health_score === "number" ? row.shelf_health_score : null,
          planogram_compliance_percent:
            typeof row.planogram_compliance_percent === "number"
              ? row.planogram_compliance_percent
              : null,
          error_message: (row.error_message as string | null) ?? null,
          preview_image_url: previews.get(row.id as string) ?? null,
        };
      }),
    };
  });

export const listPlatformUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { page?: number; pageSize?: number; q?: string } | undefined) => ({
    page: Math.max(Number(input?.page ?? 1) || 1, 1),
    pageSize: Math.min(Math.max(Number(input?.pageSize ?? 25) || 25, 1), 100),
    q: input?.q?.trim() || undefined,
  }))
  .handler(async ({ data, context }): Promise<{ rows: PlatformUserRow[]; total: number }> => {
    const email = await adminEmail(context);
    const db = await adminDb();
    await requirePlatformAdminContext(db, email);

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    let query = db
      .from("profiles")
      .select("id, email, full_name, created_at, onboarding_completed_at", { count: "exact" })
      .order("created_at", { ascending: false });

    if (data.q) {
      const uuidLike = /^[0-9a-f-]{36}$/i.test(data.q);
      query = uuidLike
        ? query.or(`email.ilike.%${data.q}%,full_name.ilike.%${data.q}%,id.eq.${data.q}`)
        : query.or(`email.ilike.%${data.q}%,full_name.ilike.%${data.q}%`);
    }

    const { data: profiles, error, count } = await query.range(from, to);
    if (error) throw new Error(error.message);

    const userIds = (profiles ?? []).map((p) => p.id as string);
    const membershipsByUser = new Map<string, PlatformUserRow["orgs"]>();
    const scanCounts = new Map<string, number>();

    if (userIds.length > 0) {
      const { data: memberships } = await db
        .from("organization_members")
        .select("user_id, org_id, role, status, organizations(name)")
        .in("user_id", userIds);

      for (const m of memberships ?? []) {
        const uid = m.user_id as string;
        const org = m.organizations as { name?: string } | null;
        const list = membershipsByUser.get(uid) ?? [];
        list.push({
          org_id: m.org_id as string,
          org_name: org?.name ?? "—",
          role: String(m.role),
          status: String(m.status),
        });
        membershipsByUser.set(uid, list);
      }

      const { data: scanRows } = await db
        .from("shelf_scans")
        .select("created_by")
        .in("created_by", userIds);

      for (const s of scanRows ?? []) {
        const uid = s.created_by as string;
        scanCounts.set(uid, (scanCounts.get(uid) ?? 0) + 1);
      }
    }

    return {
      total: count ?? 0,
      rows: (profiles ?? []).map((p) => ({
        id: p.id as string,
        email: (p.email as string | null) ?? null,
        full_name: (p.full_name as string | null) ?? null,
        created_at: p.created_at as string,
        onboarding_completed_at: (p.onboarding_completed_at as string | null) ?? null,
        org_count: membershipsByUser.get(p.id as string)?.length ?? 0,
        scan_count: scanCounts.get(p.id as string) ?? 0,
        orgs: membershipsByUser.get(p.id as string) ?? [],
      })),
    };
  });

export const listPlatformOrgs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { page?: number; pageSize?: number; q?: string } | undefined) => ({
    page: Math.max(Number(input?.page ?? 1) || 1, 1),
    pageSize: Math.min(Math.max(Number(input?.pageSize ?? 25) || 25, 1), 100),
    q: input?.q?.trim() || undefined,
  }))
  .handler(async ({ data, context }): Promise<{ rows: PlatformOrgRow[]; total: number }> => {
    const email = await adminEmail(context);
    const db = await adminDb();
    await requirePlatformAdminContext(db, email);

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    let query = db
      .from("organizations")
      .select("id, name, created_at, owner_id, customer_type", { count: "exact" })
      .order("created_at", { ascending: false });

    if (data.q) {
      query = query.or(`name.ilike.%${data.q}%,id.eq.${data.q}`);
    }

    const { data: orgs, error, count } = await query.range(from, to);
    if (error) throw new Error(error.message);

    const orgIds = (orgs ?? []).map((o) => o.id as string);
    const ownerIds = [...new Set((orgs ?? []).map((o) => o.owner_id as string))];

    const ownerEmails = new Map<string, string>();
    if (ownerIds.length > 0) {
      const { data: owners } = await db.from("profiles").select("id, email").in("id", ownerIds);
      for (const o of owners ?? []) ownerEmails.set(o.id as string, (o.email as string) ?? "—");
    }

    const memberCounts = new Map<string, number>();
    const storeCounts = new Map<string, number>();
    const scanCounts = new Map<string, number>();
    const subsByOrg = new Map<
      string,
      { plan_code: string | null; plan_name: string | null; scans_used: number | null; status: string | null }
    >();

    if (orgIds.length > 0) {
      const [{ data: members }, { data: stores }, { data: scans }, { data: subs }] = await Promise.all([
        db.from("organization_members").select("org_id").in("org_id", orgIds),
        db.from("stores").select("org_id").in("org_id", orgIds),
        db.from("shelf_scans").select("org_id").in("org_id", orgIds),
        db
          .from("subscriptions")
          .select("org_id, scans_used, status, subscription_plans(code, name)")
          .in("org_id", orgIds),
      ]);

      for (const m of members ?? []) {
        const id = m.org_id as string;
        memberCounts.set(id, (memberCounts.get(id) ?? 0) + 1);
      }
      for (const s of stores ?? []) {
        const id = s.org_id as string;
        storeCounts.set(id, (storeCounts.get(id) ?? 0) + 1);
      }
      for (const s of scans ?? []) {
        const id = s.org_id as string;
        scanCounts.set(id, (scanCounts.get(id) ?? 0) + 1);
      }
      for (const sub of subs ?? []) {
        const plan = sub.subscription_plans as { code?: string; name?: string } | null;
        subsByOrg.set(sub.org_id as string, {
          plan_code: plan?.code ?? null,
          plan_name: plan?.name ?? null,
          scans_used: typeof sub.scans_used === "number" ? sub.scans_used : null,
          status: (sub.status as string | null) ?? null,
        });
      }
    }

    return {
      total: count ?? 0,
      rows: (orgs ?? []).map((o) => {
        const id = o.id as string;
        const sub = subsByOrg.get(id);
        return {
          id,
          name: o.name as string,
          created_at: o.created_at as string,
          owner_id: o.owner_id as string,
          owner_email: ownerEmails.get(o.owner_id as string) ?? null,
          customer_type: (o.customer_type as string | null) ?? null,
          member_count: memberCounts.get(id) ?? 0,
          store_count: storeCounts.get(id) ?? 0,
          scan_count: scanCounts.get(id) ?? 0,
          plan_code: sub?.plan_code ?? null,
          plan_name: sub?.plan_name ?? null,
          scans_used: sub?.scans_used ?? null,
          subscription_status: sub?.status ?? null,
        };
      }),
    };
  });

export const getPlatformScanDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { scanId?: string } | undefined) => {
    const scanId = input?.scanId?.trim();
    if (!scanId) throw new Error("Scan id is required.");
    return { scanId };
  })
  .handler(async ({ data, context }): Promise<PlatformScanDetail> => {
    const email = await adminEmail(context);
    const db = await adminDb();
    await requirePlatformAdminContext(db, email);

    const { data: row, error } = await db
      .from("shelf_scans")
      .select(
        `
        id, created_at, status, created_by, org_id, category, sub_category_label,
        shelf_label, total_products, shelf_health_score, planogram_compliance_percent, error_message,
        organizations(name),
        profiles:created_by(email, full_name),
        stores(name)
      `,
      )
      .eq("id", data.scanId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) throw new Error("Scan not found.");

    const org = row.organizations as { name?: string } | null;
    const profile = row.profiles as { email?: string; full_name?: string } | null;
    const store = row.stores as { name?: string } | null;

    const scan: PlatformScanRow = {
      id: row.id as string,
      created_at: row.created_at as string,
      status: String(row.status),
      created_by: (row.created_by as string | null) ?? null,
      user_email: profile?.email ?? null,
      user_name: profile?.full_name ?? null,
      org_id: row.org_id as string,
      org_name: org?.name ?? null,
      store_name: store?.name ?? null,
      category: (row.category as string | null) ?? null,
      sub_category: (row.sub_category_label as string | null) ?? null,
      shelf_label: (row.shelf_label as string | null) ?? null,
      total_products: Number(row.total_products ?? 0),
      shelf_health_score: typeof row.shelf_health_score === "number" ? row.shelf_health_score : null,
      planogram_compliance_percent:
        typeof row.planogram_compliance_percent === "number" ? row.planogram_compliance_percent : null,
      error_message: (row.error_message as string | null) ?? null,
    };

    const [assets, { data: products }, { data: resultRow }] = await Promise.all([
      resolveAdminScanAssetUrls(db, data.scanId),
      db
        .from("detected_products")
        .select("id, brand, name, variant, facings, confidence, stock_status, sku")
        .eq("scan_id", data.scanId)
        .order("facings", { ascending: false })
        .limit(500),
      db
        .from("scan_results")
        .select(
          "executive_summary, confidence_avg, metrics, raw_payload, alerts, recommendations, brand_share, category_breakdown, shelf_rows, model_version",
        )
        .eq("scan_id", data.scanId)
        .maybeSingle(),
    ]);

    return {
      scan: {
        ...scan,
        preview_image_url: assets.annotated_image_url ?? assets.original_image_url ?? null,
      },
      assets,
      detected_products: (products ?? []).map((p) => ({
        id: p.id as string,
        brand: (p.brand as string | null) ?? null,
        name: p.name as string,
        variant: (p.variant as string | null) ?? null,
        facings: Number(p.facings ?? 0),
        confidence: typeof p.confidence === "number" ? p.confidence : null,
        stock_status: String(p.stock_status),
        sku: (p.sku as string | null) ?? null,
      })),
      scan_result: resultRow
        ? {
            executive_summary: (resultRow.executive_summary as string | null) ?? null,
            confidence_avg:
              typeof resultRow.confidence_avg === "number" ? resultRow.confidence_avg : null,
            model_version: (resultRow.model_version as string | null) ?? null,
            metrics:
              resultRow.metrics && typeof resultRow.metrics === "object" && !Array.isArray(resultRow.metrics)
                ? (resultRow.metrics as Record<string, unknown>)
                : null,
            alerts: jsonArray(resultRow.alerts),
            recommendations: jsonArray(resultRow.recommendations),
            brand_share: jsonArray(resultRow.brand_share),
            category_breakdown: jsonArray(resultRow.category_breakdown),
            shelf_rows: jsonArray(resultRow.shelf_rows),
            raw_payload:
              resultRow.raw_payload &&
              typeof resultRow.raw_payload === "object" &&
              !Array.isArray(resultRow.raw_payload)
                ? (resultRow.raw_payload as Record<string, unknown>)
                : null,
          }
        : null,
    };
  });
