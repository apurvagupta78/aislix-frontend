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
    avg_osa: 91,
    avg_planogram: 84,
    open_issues: 12,
    issues_resolved_rate: 68,
    shelf_health: 88,
    shelf_health_available: true,
    audits_remaining: 4872,
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
  recent_audits: DEMO_RECENT_SCANS.items.map((s) => ({
    scan_id: s.scan_id,
    date: s.created_at ?? isoAgo(DAY),
    store_name: s.store ?? "Store",
    role: "supermarket",
    osa: s.shelf_health_score ? s.shelf_health_score - 5 : null,
    planogram: s.shelf_health_score ? s.shelf_health_score - 10 : null,
    issues: 2,
  })),
  priority_opportunities: [
    { category: "availability", label: "Availability", count: 5 },
    { category: "placement", label: "Placement", count: 4 },
    { category: "pricing", label: "Pricing", count: 2 },
  ],
  role_visual: null,
  filter_options: {
    stores: [
      { id: "demo-1", name: "More Mart — Koramangala" },
      { id: "demo-2", name: "Big Bazaar — Whitefield" },
    ],
    categories: ["Beverages", "Snacks", "Personal Care"],
  },
};
