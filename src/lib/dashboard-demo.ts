/**
 * Guest "Live demo" data for /dashboard.
 *
 * Visitors without a Supabase session see this static sample workspace instead
 * of error states. It is never used for signed-in users, and it never writes
 * anywhere — purely presentational marketing data.
 */

import type { Session } from "@supabase/supabase-js";
import type {
  AnalyticsResponse,
  DashboardResponse,
  NotificationsResponse,
  RecentScansResponse,
  SeriesPoint,
} from "@/lib/dashboard";
import { FALLBACK_CATEGORIES } from "@/lib/categories.data";
import type { WorkspaceDashboardData } from "@/lib/dashboard-intelligence";

/** True when the dashboard should render the read-only guest demo. */
export function isDemoMode(session: Session | null): boolean {
  return !session;
}

const DAY = 24 * 60 * 60 * 1000;
const now = () => Date.now();
const isoAgo = (ms: number) => new Date(now() - ms).toISOString();
const isoIn = (ms: number) => new Date(now() + ms).toISOString();

function dayLabels(count: number): string[] {
  const fmt = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" });
  return Array.from({ length: count }, (_, i) =>
    fmt.format(new Date(now() - (count - 1 - i) * DAY)),
  );
}

function series(count: number, values: number[]): SeriesPoint[] {
  return dayLabels(count).map((label, i) => ({ label, value: values[i % values.length]! }));
}

export const DEMO_DASHBOARD: DashboardResponse = {
  greeting_name: "Welcome to the demo",
  kpis: {
    total_scans: 128,
    products_detected: 4820,
    stores: 6,
    shelf_health_score: 88,
    low_stock_alerts: 14,
    out_of_stock_alerts: 3,
    average_confidence: 94.6,
    scans_remaining: 4872,
  },
  account: {
    plan_name: "Professional",
    plan_id: "professional",
    status: "active",
    scans_used: 128,
    scans_included: 5000,
    scans_remaining: 4872,
    renewal_date: isoIn(18 * DAY),
  },
  activity: [
    {
      id: "demo-act-1",
      kind: "scan_completed",
      title: "Scan completed — Aisle 3 · Beverages",
      description: "More Mart — Koramangala · 187 products detected",
      created_at: isoAgo(2 * 60 * 60 * 1000),
    },
    {
      id: "demo-act-2",
      kind: "pdf_downloaded",
      title: "Audit report downloaded — Aisle 1 · Snacks",
      description: "More Mart — Indiranagar",
      created_at: isoAgo(6 * 60 * 60 * 1000),
    },
    {
      id: "demo-act-3",
      kind: "scan_completed",
      title: "Scan completed — Aisle 5 · Personal Care",
      description: "Big Bazaar — Whitefield · 98 products detected",
      created_at: isoAgo(DAY),
    },
    {
      id: "demo-act-4",
      kind: "store_added",
      title: "Store added — DMart · HSR Layout",
      created_at: isoAgo(2 * DAY),
    },
    {
      id: "demo-act-5",
      kind: "user_invited",
      title: "Team member invited — regional.manager@example.com",
      description: "Store manager access · demo only",
      created_at: isoAgo(3 * DAY),
    },
    {
      id: "demo-act-6",
      kind: "subscription_upgraded",
      title: "Plan upgraded to Professional",
      created_at: isoAgo(9 * DAY),
    },
  ],
};

export const DEMO_ANALYTICS: AnalyticsResponse = {
  shelf_health_trend: series(
    30,
    [
      74, 76, 72, 78, 81, 79, 83, 85, 82, 86, 84, 88, 87, 90, 92, 89, 91, 88, 86, 89, 93, 94, 91,
      88, 90, 92, 89, 87, 91, 88,
    ],
  ),
  daily_scans: series(14, [4, 6, 3, 7, 5, 8, 6, 9, 5, 7, 4, 8, 6, 7]),
  weekly_scans: [
    { label: "W1", value: 24 },
    { label: "W2", value: 31 },
    { label: "W3", value: 28 },
    { label: "W4", value: 36 },
    { label: "W5", value: 33 },
    { label: "W6", value: 41 },
    { label: "W7", value: 38 },
    { label: "W8", value: 44 },
  ],
  monthly_scans: [
    { label: "Jan", value: 82 },
    { label: "Feb", value: 96 },
    { label: "Mar", value: 104 },
    { label: "Apr", value: 118 },
    { label: "May", value: 111 },
    { label: "Jun", value: 126 },
    { label: "Jul", value: 134 },
    { label: "Aug", value: 128 },
  ],
  brand_distribution: [
    { label: "Hindustan Unilever", value: 22 },
    { label: "Tata Consumer", value: 18 },
    { label: "Britannia", value: 15 },
    { label: "Parle", value: 13 },
    { label: "Amul", value: 12 },
    { label: "Nestlé", value: 11 },
    { label: "Lipton", value: 9 },
  ],
  low_stock_trend: series(21, [3, 5, 2, 6, 4, 7, 5, 3, 6, 4, 8, 5, 4, 6, 3, 5, 7, 4, 6, 5, 4]),
};

export const DEMO_NOTIFICATIONS: NotificationsResponse = {
  items: [
    {
      id: "demo-n-1",
      kind: "low_stock",
      severity: "critical",
      title: "Low stock — Lipton Yellow Label at More Mart Koramangala",
      message: "2 facings left on Aisle 3 · replenish today.",
      created_at: isoAgo(90 * 60 * 1000),
    },
    {
      id: "demo-n-2",
      kind: "low_stock",
      severity: "warning",
      title: "3 out-of-stock facings detected — Beverages aisle",
      message: "Big Bazaar — Whitefield · last scan 4 hours ago.",
      created_at: isoAgo(4 * 60 * 60 * 1000),
    },
    {
      id: "demo-n-3",
      kind: "announcement",
      severity: "info",
      title: "Weekly scan target reached for Indiranagar store",
      message: "12 of 12 planned shelf audits completed.",
      created_at: isoAgo(DAY),
    },
    {
      id: "demo-n-4",
      kind: "announcement",
      severity: "info",
      title: "New team member invited — demo only",
      message: "Store manager access pending acceptance.",
      created_at: isoAgo(3 * DAY),
    },
  ],
  unread: 1,
};

export const DEMO_RECENT_SCANS: RecentScansResponse = {
  items: [
    {
      scan_id: "DEMO-8241",
      store: "More Mart — Koramangala",
      created_at: isoAgo(2 * 60 * 60 * 1000),
      shelf_health_score: 91,
      average_confidence: 95.2,
      products_detected: 187,
      status: "completed",
    },
    {
      scan_id: "DEMO-8237",
      store: "More Mart — Indiranagar",
      created_at: isoAgo(8 * 60 * 60 * 1000),
      shelf_health_score: 84,
      average_confidence: 93.8,
      products_detected: 142,
      status: "completed",
    },
    {
      scan_id: "DEMO-8229",
      store: "Big Bazaar — Whitefield",
      created_at: isoAgo(DAY),
      shelf_health_score: 76,
      average_confidence: 92.1,
      products_detected: 98,
      status: "completed",
    },
    {
      scan_id: "DEMO-8216",
      store: "DMart — HSR Layout",
      created_at: isoAgo(2 * DAY),
      shelf_health_score: 88,
      average_confidence: 94.4,
      products_detected: 64,
      status: "completed",
    },
    {
      scan_id: "DEMO-8204",
      store: "More Mart — Koramangala",
      created_at: isoAgo(3 * DAY),
      shelf_health_score: 92,
      average_confidence: 96.0,
      products_detected: 210,
      status: "completed",
    },
    {
      scan_id: "DEMO-8198",
      store: "Reliance Smart — Jayanagar",
      created_at: isoAgo(4 * DAY),
      shelf_health_score: 81,
      average_confidence: 91.7,
      products_detected: 132,
      status: "completed",
    },
  ],
  total: 6,
  page: 1,
  page_size: 8,
  stores: [
    "More Mart — Koramangala",
    "More Mart — Indiranagar",
    "Big Bazaar — Whitefield",
    "DMart — HSR Layout",
    "Reliance Smart — Jayanagar",
  ],
};

/** Guest demo workspace dashboard — marketing sample data only. */
export const DEMO_WORKSPACE_DASHBOARD: WorkspaceDashboardData = {
  kpis: {
    audits_completed: 42,
    stores_covered: 5,
    osa: {
      percent: 91,
      numerator: 1190,
      denominator: 1240,
      detail: "1,190 / 1,240 assessed",
      eligible_audits: 42,
      trace_scan_id: "DEMO-8241",
      available: true,
      unavailable_reason: null,
    },
    planogram: {
      percent: 84,
      numerator: 420,
      denominator: 500,
      detail: "420 / 500 positions",
      eligible_audits: 38,
      trace_scan_id: "DEMO-8229",
      available: true,
      unavailable_reason: null,
    },
    avg_osa: 91,
    avg_planogram: 84,
    open_issues: 12,
    issue_resolution: {
      rate: 68,
      display: "68%",
      resolved_count: 17,
      outcome_count: 25,
    },
    issues_resolved_rate: 68,
    shelf_health: {
      score: 88,
      display: "88/100",
      available: true,
      audit_count: 42,
    },
    shelf_health_available: true,
    audits_remaining: 4872,
    audits_unlimited: false,
    products_detected: 4820,
    average_confidence: 94.6,
    images_processed: 42,
  },
  issues: { total: 12, high: 4, medium: 5, low: 3 },
  issue_rows: [
    {
      id: "demo-i1",
      store_name: "More Mart — Koramangala",
      issue: "3 products need availability review",
      priority: "high",
      status: "Open",
      href: "/results?scan=DEMO-8241",
    },
    {
      id: "demo-i2",
      store_name: "Big Bazaar — Whitefield",
      issue: "Planogram placement mismatch on Aisle 5",
      priority: "medium",
      status: "Open",
      href: "/results?scan=DEMO-8229",
    },
  ],
  performance_trend: series(14, [82, 84, 83, 86, 85, 88, 87, 89, 90, 88, 91, 92, 90, 91]).map(
    (p, i) => ({
      date: p.label,
      osa: 85 + (i % 5),
      planogram_compliance: 78 + (i % 6),
      assortment_compliance: 80 + (i % 4),
    }),
  ),
  improvement: [
    {
      key: "osa",
      label: "OSA",
      previous: "87%",
      current: "91%",
      change: "+4 pts",
      improved: true,
    },
    {
      key: "planogram",
      label: "Planogram",
      previous: "79%",
      current: "84%",
      change: "+5 pts",
      improved: true,
    },
  ],
  stores: [
    {
      store_id: "demo-1",
      store_name: "More Mart — Koramangala",
      audits: 12,
      osa: 93,
      planogram: 88,
      open_issues: 3,
      change: 5,
    },
    {
      store_id: "demo-2",
      store_name: "Big Bazaar — Whitefield",
      audits: 9,
      osa: 86,
      planogram: 79,
      open_issues: 5,
      change: -2,
    },
  ],
  attention_cards: [
    {
      key: "planogram",
      area_label: "Planogram Compliance",
      score: 84,
      score_display: "84%",
      explanation: "4 open issues need attention",
      issue_count: 4,
      affected_audits: 12,
      variance: "Target 90% · -6 pts",
      target_percent: 90,
      variance_pts: -6,
      progress_percent: 84,
      scan_id: "DEMO-8229",
      action_label: "View audits →",
      kpi_id: "planogram_compliance",
      no_data: false,
      no_data_reason: null,
      rank_score: 120,
    },
    {
      key: "osa",
      area_label: "On-Shelf Availability",
      score: 91,
      score_display: "91%",
      explanation: "3 open issues need attention",
      issue_count: 3,
      affected_audits: 10,
      variance: "Target 95% · -4 pts",
      target_percent: 95,
      variance_pts: -4,
      progress_percent: 91,
      scan_id: "DEMO-8241",
      action_label: "View audits →",
      kpi_id: "osa",
      no_data: false,
      no_data_reason: null,
      rank_score: 95,
    },
    {
      key: "assortment",
      area_label: "Assortment Compliance",
      score: 88,
      score_display: "88%",
      explanation: "2 open issues need attention",
      issue_count: 2,
      affected_audits: 8,
      variance: "Target 95% · -7 pts",
      target_percent: 95,
      variance_pts: -7,
      progress_percent: 88,
      scan_id: "DEMO-8241",
      action_label: "View audits →",
      kpi_id: "assortment_compliance",
      no_data: false,
      no_data_reason: null,
      rank_score: 80,
    },
    {
      key: "price",
      area_label: "Price Compliance",
      score: 92,
      score_display: "92%",
      explanation: "1 open issue needs attention",
      issue_count: 1,
      affected_audits: 5,
      variance: "Target 95% · -3 pts",
      target_percent: 95,
      variance_pts: -3,
      progress_percent: 92,
      scan_id: "DEMO-8229",
      action_label: "View audits →",
      kpi_id: "price_compliance",
      no_data: false,
      no_data_reason: null,
      rank_score: 40,
    },
    {
      key: "promotion",
      area_label: "Promotional Compliance",
      score: 94,
      score_display: "94%",
      explanation: "2 open issues need attention",
      issue_count: 2,
      affected_audits: 6,
      variance: "Target 95% · -1 pts",
      target_percent: 95,
      variance_pts: -1,
      progress_percent: 94,
      scan_id: "DEMO-8229",
      action_label: "View audits →",
      kpi_id: "promotional_compliance",
      no_data: false,
      no_data_reason: null,
      rank_score: 30,
    },
  ],
  performance_period: [
    { kpi_id: "osa", label: "OSA", current: 91, previous: 87, change: 4 },
    { kpi_id: "planogram_compliance", label: "Planogram Compliance", current: 84, previous: 79, change: 5 },
    { kpi_id: "assortment_compliance", label: "Assortment Compliance", current: 88, previous: 85, change: 3 },
  ],
  recent_audits: DEMO_RECENT_SCANS.items.map((s) => ({
    scan_id: s.scan_id,
    date: s.created_at ?? isoAgo(DAY),
    store_name: s.store ?? "Store",
    role: "Supermarket",
    category: s.category ?? "Beverages",
    osa: s.shelf_health_score ? s.shelf_health_score - 5 : null,
    planogram: s.shelf_health_score ? s.shelf_health_score - 10 : null,
    issues: 2,
    assigned_to: "Field Rep",
    status: "completed",
  })),
  priority_opportunities: [
    { category: "availability", label: "Availability", count: 5 },
    { category: "placement", label: "Placement", count: 4 },
    { category: "pricing", label: "Pricing", count: 2 },
  ],
  role_visual: null,
  brand_competition: null,
  filter_summary: {
    audit_count: 42,
    store_count: 5,
    category_count: 3,
    label: "42 audits · 5 stores · 3 categories",
  },
  effective_role: "supermarket",
  has_completed_audits: true,
  filter_options: {
    stores: [
      { id: "demo-1", name: "More Mart — Koramangala", country: "India", city: "Bengaluru" },
      { id: "demo-2", name: "Big Bazaar — Whitefield", country: "India", city: "Bengaluru" },
    ],
    countries: ["India"],
    cities: ["Bengaluru", "Mumbai"],
    categories: FALLBACK_CATEGORIES.map((c) => c.name),
    subcategories: [
      { category: "Beverages", value: "Soft drinks", label: "Soft drinks" },
      { category: "Snacks", value: "Chips", label: "Chips" },
      { category: "Personal Care", value: "Oral care", label: "Oral care" },
    ],
    team_members: [
      { user_id: "demo-user-1", name: "Demo Manager", email: "manager@demo.aislix.com" },
      { user_id: "demo-user-2", name: "Field Rep", email: "rep@demo.aislix.com" },
    ],
    kri_options: [
      { value: "osa", label: "OSA" },
      { value: "planogram_compliance", label: "Planogram" },
      { value: "assortment_compliance", label: "Assortment" },
      { value: "price_compliance", label: "Price" },
      { value: "promotional_compliance", label: "Promotion" },
    ],
    only_self: false,
    current_user_id: "demo-user-1",
  },
};
