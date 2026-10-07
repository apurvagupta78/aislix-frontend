/**
 * Report center documents. One model per report drives the screen, print/PDF, Excel, share text and email,
 * so every format shows the same numbers. Values come straight from the report RPCs — no KPI math here.
 */

import { accentAt } from "@/lib/ai-audit/kpi-palette";
import { hideModelNames } from "@/lib/ai-display-text";
import {
  buildSegmentKpis,
  formatInr,
  segmentHeadline,
  SEGMENT_CONFIG,
  type SegmentId,
  type SegmentKpiView,
} from "@/lib/segments/segment-config";
import type { SegmentDashboard } from "@/lib/segments/segment-dashboard";

export type ReportKind = "store" | "exec" | "restock" | "field" | "claim";

export const REPORT_KINDS: ReportKind[] = ["store", "exec", "restock", "field", "claim"];

export const REPORT_DAYS = [7, 30, 90] as const;
export type ReportDays = (typeof REPORT_DAYS)[number];

export type ReportKindInfo = {
  label: string;
  /** The question the report answers for the reader. */
  question: string;
  needsStore: boolean;
};

export const REPORT_KIND_INFO: Record<ReportKind, ReportKindInfo> = {
  store: {
    label: "Store over time",
    question: "Is this store getting better or worse week by week?",
    needsStore: true,
  },
  exec: {
    label: "Executive summary",
    question: "How are all my stores doing, and where should I act first?",
    needsStore: false,
  },
  restock: {
    label: "Restock list",
    question: "What should be refilled or put back, store by store, from the latest AI audit?",
    needsStore: false,
  },
  field: {
    label: "Field team coverage",
    question: "Did the team visit every planned outlet, with location proof?",
    needsStore: false,
  },
  claim: {
    label: "Claim proof pack",
    question: "Photo, time and location evidence for every outlet visit.",
    needsStore: false,
  },
};

/** Which report each customer type opens first. */
export const DEFAULT_REPORT_FOR_SEGMENT: Record<SegmentId, ReportKind> = {
  supermarket: "exec",
  fmcg: "claim",
  distributor: "field",
  darkstore: "restock",
  local: "restock",
};

export type ReportKpi = SegmentKpiView;

export type ReportTable = {
  title: string;
  columns: string[];
  /** Right-align every column after the first. */
  rows: string[][];
  note?: string;
};

export type ReportPhoto = {
  scanId: string;
  storeName: string;
  takenAt: string;
  capturedBy: string;
  location: string;
  bucket: string | null;
  path: string | null;
  /** Filled in by the browser with a short-lived signed URL. */
  url?: string | null;
};

export type ReportDocument = {
  kind: ReportKind;
  title: string;
  question: string;
  subtitle: string;
  periodLabel: string;
  headline: string | null;
  provenance: string;
  labeledDemo: boolean;
  empty: boolean;
  emptyMessage: string;
  kpis: ReportKpi[];
  tables: ReportTable[];
  photos: ReportPhoto[];
  generatedAt: string;
};

type Num = number | null;

export type FieldCoverage = {
  from: string;
  to: string;
  totals: {
    visits: number;
    stores_visited: number;
    reps: number;
    gps_visits: number;
    on_site: number;
    off_site: number;
    no_store_location: number;
    unplanned_visits: number;
    planned: number;
    planned_done: number;
    planned_missed: number;
    planned_open: number;
    stores_planned: number;
    stores_planned_visited: number;
  };
  reps: Array<{
    user_id: string;
    name: string;
    visits: number;
    stores_visited: number;
    gps_visits: number;
    on_site: number;
    off_site: number;
    planned: number;
    planned_done: number;
    planned_missed: number;
    last_visit: string | null;
  }>;
  stores: Array<{
    store_id: string;
    store_name: string;
    city: string | null;
    store_type: string | null;
    has_location: boolean;
    planned: number;
    planned_missed: number;
    visits: number;
    gps_visits: number;
    on_site: number;
    last_visit: string | null;
  }>;
  daily: Array<{ day: string; visits: number; gps_visits: number }>;
};

export type ClaimVisit = {
  scan_id: string;
  store_id: string | null;
  store_name: string;
  store_code: string | null;
  city: string | null;
  address: string | null;
  created_at: string;
  captured_by: string;
  audit_mode: string | null;
  category: string | null;
  lat: Num;
  lng: Num;
  accuracy_m: Num;
  gps_source: string | null;
  distance_m: Num;
  location_status: "no_gps" | "no_store_location" | "on_site" | "off_site";
  original_bucket: string | null;
  original_path: string | null;
  annotated_path: string | null;
  photo_count: number;
  shelf_read: boolean;
  osa: Num;
  gaps: Num;
  products: Num;
  top_brands: Array<{ brand: string; share: Num }> | null;
};

export type RestockStore = {
  store_id: string | null;
  store_name: string;
  store_type: string | null;
  city: string | null;
  scan_id: string;
  audited_at: string;
  captured_by: string;
  category: string | null;
  gaps: Num;
  low_stock: Num;
  misplaced: Num;
  lines: number;
};

export type RestockLine = {
  store_id: string | null;
  store_name: string;
  scan_id: string;
  name: string;
  brand: string | null;
  variant: string | null;
  sku: string | null;
  facings: Num;
  expected_facings: Num;
  status: "out_of_stock" | "low_stock" | "misplaced";
  confidence: Num;
  category: string | null;
};

export type RestockList = {
  from: string;
  to: string;
  totals: {
    stores: number;
    gaps: Num;
    out_of_stock: number;
    low_stock: number;
    misplaced: number;
    lines: number;
  };
  stores: RestockStore[];
  lines: RestockLine[];
};

export type ClaimPack = {
  from: string;
  to: string;
  totals: {
    audits: number;
    stores: number;
    with_photo: number;
    gps_audits: number;
    on_site: number;
    off_site: number;
  };
  audits: ClaimVisit[];
};

const NA = "N/A";
const PROVENANCE = "AI detected · Calculated by Aislix · completed audits only";

function n(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function count(v: unknown): string {
  const x = n(v);
  return x == null ? NA : Math.round(x).toLocaleString("en-IN");
}

function pct(v: unknown): string {
  const x = n(v);
  if (x == null) return NA;
  return `${Number.isInteger(x) ? x : x.toFixed(1)}%`;
}

function plural(v: number, one: string, many = `${one}s`): string {
  return `${count(v)} ${v === 1 ? one : many}`;
}

/** Dates in reports are shown in India time so the PDF, email and screen agree. */
export function reportDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return NA;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NA;
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: withTime ? undefined : "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  });
}

export function reportPeriodLabel(from: string, to: string): string {
  return `${reportDate(from)} – ${reportDate(to)}`;
}

function kpi(index: number, label: string, value: string, context: string, unavailable = false): ReportKpi {
  return {
    id: "audits",
    label,
    value,
    context,
    accent: accentAt(index),
    delta: null,
    lowerIsBetter: false,
    unavailable,
  };
}

export function locationLabel(v: Pick<ClaimVisit, "location_status" | "distance_m">): string {
  switch (v.location_status) {
    case "on_site":
      return v.distance_m == null ? "At store" : `At store (${count(v.distance_m)} m)`;
    case "off_site":
      return v.distance_m == null ? "Away from store" : `Away from store (${count(v.distance_m)} m)`;
    case "no_store_location":
      return "GPS captured · store location not set";
    default:
      return "No GPS";
  }
}

function baseDoc(
  kind: ReportKind,
  from: string,
  to: string,
  subtitle: string,
  labeledDemo: boolean,
): Omit<ReportDocument, "headline" | "empty" | "emptyMessage" | "kpis" | "tables" | "photos"> {
  const info = REPORT_KIND_INFO[kind];
  const periodLabel = reportPeriodLabel(from, to);
  return {
    kind,
    title: info.label,
    question: info.question,
    subtitle: [subtitle, periodLabel].filter(Boolean).join(" · "),
    periodLabel,
    provenance: PROVENANCE,
    labeledDemo,
    generatedAt: new Date().toISOString(),
  };
}

function weekLabel(iso: string): string {
  return reportDate(`${iso}T00:00:00+05:30`);
}

/** Weekly trend for one store, from `segment_dashboard` filtered to that store. */
export function buildStoreReport(
  segment: SegmentId,
  data: SegmentDashboard | null,
  storeName: string,
  meta: { from: string; to: string; labeledDemo: boolean },
): ReportDocument {
  const config = SEGMENT_CONFIG[segment];
  const audits = n(data?.totals?.audits) ?? 0;
  const trendRows = (data?.trend ?? []).map((t) => [
    weekLabel(t.week),
    count(t.audits),
    pct(t.avg_osa),
    t.avg_health == null ? NA : `${Math.round(Number(t.avg_health))}/100`,
    count(t.gaps),
    count(t.low_stock),
  ]);
  const tables: ReportTable[] = [
    {
      title: "Week by week",
      columns: ["Week starting", "AI audits", "Availability", "Shelf health", "Empty gaps", "Low stock"],
      rows: trendRows,
      note: trendRows.length < 2 ? "Needs audits in at least two weeks to show a trend." : undefined,
    },
  ];
  const brands = brandRows(data);
  if (config.showBrands && brands.length) {
    tables.push({ title: config.brandsTitle, columns: ["Brand", "Average share", "Seen in audits"], rows: brands });
  }
  return {
    ...baseDoc("store", meta.from, meta.to, storeName, meta.labeledDemo),
    headline: segmentHeadline(config, data),
    empty: audits === 0,
    emptyMessage: `No completed AI audits for this ${config.storeNoun.one} in this period.`,
    kpis: buildSegmentKpis(config, data),
    tables,
    photos: [],
  };
}

function brandRows(data: SegmentDashboard | null): string[][] {
  return (data?.brands ?? [])
    .filter((b) => b.avg_share != null)
    .slice(0, 10)
    .map((b) => [b.brand, pct(b.avg_share), count(b.audits_seen)]);
}

/** All stores in scope for the period, from `segment_dashboard`. */
export function buildExecReport(
  segment: SegmentId,
  data: SegmentDashboard | null,
  meta: { from: string; to: string; labeledDemo: boolean },
): ReportDocument {
  const config = SEGMENT_CONFIG[segment];
  const audits = n(data?.totals?.audits) ?? 0;
  const stores = data?.stores ?? [];
  const tables: ReportTable[] = [
    {
      title: config.storesTitle,
      columns: [
        config.storeNoun.one[0]!.toUpperCase() + config.storeNoun.one.slice(1),
        "AI audits",
        "Availability",
        "Empty gaps",
        "Low stock",
        "Misplaced",
        "Value at risk",
        "Last audit",
      ],
      rows: stores.map((s) => [
        s.city ? `${s.store_name} · ${s.city}` : s.store_name,
        count(s.audits),
        pct(s.avg_osa),
        count(s.gaps),
        count(s.low_stock),
        count(s.misplaced),
        formatInr(n(s.value_gap_inr)),
        reportDate(s.last_audit),
      ]),
    },
  ];
  const brands = brandRows(data);
  if (config.showBrands && brands.length) {
    tables.push({ title: config.brandsTitle, columns: ["Brand", "Average share", "Seen in audits"], rows: brands });
  }
  const a = data?.actions;
  if (a) {
    tables.push({
      title: "Fixes raised from AI findings",
      columns: ["Status", "Count"],
      rows: [
        ["Open", count(a.open)],
        ["Overdue", count(a.overdue)],
        ["Critical and open", count(a.critical_open)],
        ["Raised in this period", count(a.created_in_period)],
        ["Closed in this period", count(a.closed_in_period)],
      ],
    });
  }
  return {
    ...baseDoc("exec", meta.from, meta.to, `All ${config.storeNoun.many}`, meta.labeledDemo),
    headline: segmentHeadline(config, data),
    empty: audits === 0,
    emptyMessage: `No completed AI audits in this period.`,
    kpis: buildSegmentKpis(config, data),
    tables,
    photos: [],
  };
}

const RESTOCK_ACTION: Record<RestockLine["status"], string> = {
  out_of_stock: "Restock — empty",
  low_stock: "Refill",
  misplaced: "Put back in its place",
};

/** How sure the AI was about the product read. Low reads are flagged for a quick check, never dropped. */
export function restockCertainty(confidence: Num): string {
  const c = n(confidence);
  if (c == null) return "Check on shelf";
  const v = c > 1 ? c / 100 : c;
  if (v >= 0.75) return "Sure";
  if (v >= 0.5) return "Likely";
  return "Check on shelf";
}

export function restockProductLabel(line: Pick<RestockLine, "name" | "brand" | "variant">): string {
  const name = hideModelNames(line.name.trim());
  const brand = line.brand?.trim() ? hideModelNames(line.brand.trim()) : null;
  const base = brand && !name.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${name}` : name;
  const variant = line.variant?.trim() ? hideModelNames(line.variant.trim()) : null;
  return variant && variant.length <= 24 && !base.toLowerCase().includes(variant.toLowerCase())
    ? `${base} · ${variant}`
    : base;
}

export function buildRestockReport(
  segment: SegmentId,
  data: RestockList | null,
  meta: { from: string; to: string; labeledDemo: boolean; storeName?: string | null },
): ReportDocument {
  const nouns = SEGMENT_CONFIG[segment].storeNoun;
  const t = data?.totals;
  const storesN = n(t?.stores) ?? 0;
  const stores = data?.stores ?? [];
  const lines = data?.lines ?? [];
  const refill = (n(t?.out_of_stock) ?? 0) + (n(t?.low_stock) ?? 0);
  const kpis: ReportKpi[] = [
    kpi(
      0,
      `${capitalize(nouns.many)} audited`,
      storesN ? count(storesN) : NA,
      storesN ? "Latest AI audit of each" : "No completed AI audits in this period",
      !storesN,
    ),
    kpi(1, "Empty shelf gaps", storesN ? count(t?.gaps) : NA, "Empty spaces the AI found", !storesN),
    kpi(2, "Products to refill", storesN ? count(refill) : NA, "Read as low or out of stock", !storesN),
    kpi(3, "Products to put back", storesN ? count(t?.misplaced) : NA, "Sitting in the wrong place", !storesN),
  ];

  const tables: ReportTable[] = [
    {
      title: `${capitalize(nouns.many)} to visit first`,
      columns: [capitalize(nouns.one), "Audited", "By", "Empty gaps", "To refill", "To put back"],
      rows: stores.map((s) => {
        const mine = lines.filter((l) => l.scan_id === s.scan_id);
        return [
          s.city ? `${s.store_name} · ${s.city}` : s.store_name,
          reportDate(s.audited_at, true),
          s.captured_by,
          count(s.gaps),
          count(mine.filter((l) => l.status !== "misplaced").length),
          count(mine.filter((l) => l.status === "misplaced").length),
        ];
      }),
    },
  ];

  for (const s of stores) {
    const mine = lines.filter((l) => l.scan_id === s.scan_id);
    if (!mine.length) continue;
    tables.push({
      title: s.city ? `${s.store_name} · ${s.city}` : s.store_name,
      columns: ["Product", "Action", "Facings seen", "Category", "AI certainty"],
      rows: mine.map((l) => [
        restockProductLabel(l),
        RESTOCK_ACTION[l.status],
        count(l.facings),
        l.category?.trim() || NA,
        restockCertainty(l.confidence),
      ]),
      note:
        (n(s.gaps) ?? 0) > 0
          ? `${plural(n(s.gaps) ?? 0, "empty gap")} on this shelf as well — the AI saw the space but cannot name what is missing.`
          : undefined,
    });
  }

  const shown = lines.length;
  const total = n(t?.lines) ?? 0;
  if (total > shown && tables.length > 1) {
    tables[tables.length - 1]!.note = `Showing ${count(shown)} of ${count(total)} products. Pick one ${nouns.one} to see its full list.`;
  }

  return {
    ...baseDoc("restock", meta.from, meta.to, meta.storeName ?? `All ${nouns.many}`, meta.labeledDemo),
    headline: storesN
      ? `${plural(storesN, nouns.one, nouns.many)}: ${plural(n(t?.gaps) ?? 0, "empty gap")}, ${plural(refill, "product")} to refill and ${plural(n(t?.misplaced) ?? 0, "product")} to put back.`
      : null,
    empty: storesN === 0,
    emptyMessage: "No completed AI audits in this period.",
    kpis,
    tables,
    photos: [],
  };
}

export function buildFieldReport(
  segment: SegmentId,
  data: FieldCoverage | null,
  meta: { from: string; to: string; labeledDemo: boolean },
): ReportDocument {
  const nouns = SEGMENT_CONFIG[segment].storeNoun;
  const t = data?.totals;
  const visits = n(t?.visits) ?? 0;
  const planned = n(t?.planned) ?? 0;
  const gps = n(t?.gps_visits) ?? 0;
  const kpis: ReportKpi[] = [
    kpi(
      0,
      "Visits completed",
      visits ? count(visits) : NA,
      visits
        ? `By ${plural(n(t?.reps) ?? 0, "person", "people")} across ${plural(n(t?.stores_visited) ?? 0, nouns.one, nouns.many)}`
        : "No completed visits in this period",
      !visits,
    ),
    kpi(
      1,
      "Planned visits done",
      planned ? `${count(t?.planned_done)} of ${count(planned)}` : NA,
      planned
        ? `${count(t?.planned_missed)} missed · ${count(t?.planned_open)} still open`
        : "No visits were planned in this period",
      !planned,
    ),
    kpi(
      2,
      "Visits with location proof",
      visits ? `${count(gps)} of ${count(visits)}` : NA,
      !visits
        ? "No completed visits in this period"
        : gps
          ? `${count(t?.on_site)} at the store · ${count(t?.off_site)} away from it`
          : "GPS is recorded on guided sweeps from the phone",
      !visits,
    ),
    kpi(
      3,
      "Unplanned visits",
      visits ? count(t?.unplanned_visits) : NA,
      visits ? "Audits run without an assignment" : "No completed visits in this period",
      !visits,
    ),
  ];
  const headline = visits
    ? `${plural(visits, "visit")} by ${plural(n(t?.reps) ?? 0, "person", "people")} across ${plural(
        n(t?.stores_visited) ?? 0,
        nouns.one,
        nouns.many,
      )}.${planned ? ` ${count(t?.planned_done)} of ${count(planned)} planned visits done, ${count(t?.planned_missed)} missed.` : ""}`
    : null;
  const tables: ReportTable[] = [
    {
      title: "Visits by person",
      columns: ["Person", "Visits", nouns.many[0]!.toUpperCase() + nouns.many.slice(1), "Planned done", "Missed", "With GPS", "At store", "Last visit"],
      rows: (data?.reps ?? []).map((r) => [
        r.name,
        count(r.visits),
        count(r.stores_visited),
        r.planned ? `${count(r.planned_done)} of ${count(r.planned)}` : NA,
        r.planned ? count(r.planned_missed) : NA,
        r.visits ? `${count(r.gps_visits)} of ${count(r.visits)}` : NA,
        r.gps_visits ? count(r.on_site) : NA,
        reportDate(r.last_visit),
      ]),
    },
    {
      title: `Coverage by ${nouns.one}`,
      columns: [nouns.one[0]!.toUpperCase() + nouns.one.slice(1), "Planned", "Missed", "Visits", "With GPS", "At store", "Last visit"],
      rows: (data?.stores ?? []).map((s) => [
        s.city ? `${s.store_name} · ${s.city}` : s.store_name,
        count(s.planned),
        count(s.planned_missed),
        count(s.visits),
        s.visits ? `${count(s.gps_visits)} of ${count(s.visits)}` : NA,
        !s.has_location ? "Store location not set" : s.gps_visits ? count(s.on_site) : NA,
        reportDate(s.last_visit),
      ]),
    },
  ];
  return {
    ...baseDoc("field", meta.from, meta.to, `All ${nouns.many}`, meta.labeledDemo),
    headline,
    empty: !visits && !planned,
    emptyMessage: "No visits or planned visits in this period.",
    kpis,
    tables,
    photos: [],
  };
}

export function buildClaimReport(
  segment: SegmentId,
  data: ClaimPack | null,
  meta: { from: string; to: string; labeledDemo: boolean; storeName?: string | null },
): ReportDocument {
  const nouns = SEGMENT_CONFIG[segment].storeNoun;
  const t = data?.totals;
  const audits = n(t?.audits) ?? 0;
  const gps = n(t?.gps_audits) ?? 0;
  const visits = data?.audits ?? [];
  const kpis: ReportKpi[] = [
    kpi(
      0,
      "Audited visits",
      audits ? count(audits) : NA,
      audits ? `Across ${plural(n(t?.stores) ?? 0, nouns.one, nouns.many)}` : "No completed audits in this period",
      !audits,
    ),
    kpi(
      1,
      "With shelf photo",
      audits ? `${count(t?.with_photo)} of ${count(audits)}` : NA,
      audits ? "Original photo kept as evidence" : "No completed audits in this period",
      !audits,
    ),
    kpi(
      2,
      "With GPS",
      audits ? `${count(gps)} of ${count(audits)}` : NA,
      audits
        ? gps
          ? "Location recorded at capture"
          : "GPS is recorded on guided sweeps from the phone"
        : "No completed audits in this period",
      !audits,
    ),
    kpi(
      3,
      "At the store",
      gps ? `${count(t?.on_site)} of ${count(gps)}` : NA,
      gps ? `${count(t?.off_site)} captured away from the store` : "Needs visits with GPS",
      !gps,
    ),
  ];
  const rows = visits.map((v) => [
    v.store_code ? `${v.store_name} (${v.store_code})` : v.store_name,
    reportDate(v.created_at, true),
    v.captured_by,
    v.category?.trim() || NA,
    v.shelf_read ? pct(v.osa) : NA,
    v.shelf_read ? count(v.gaps) : NA,
    (v.top_brands ?? [])
      .filter((b) => b.brand)
      .map((b) => (b.share == null ? b.brand : `${b.brand} ${pct(b.share)}`))
      .join(", ") || NA,
    v.photo_count ? count(v.photo_count) : "No photo",
    locationLabel(v),
    v.lat != null && v.lng != null ? `${v.lat.toFixed(5)}, ${v.lng.toFixed(5)}` : NA,
  ]);
  const shown = visits.length;
  return {
    ...baseDoc("claim", meta.from, meta.to, meta.storeName ?? `All ${nouns.many}`, meta.labeledDemo),
    headline: audits
      ? `${plural(audits, "audited visit")} across ${plural(n(t?.stores) ?? 0, nouns.one, nouns.many)}, each with time, person and AI shelf read${gps ? " and GPS where captured" : ""}.`
      : null,
    empty: audits === 0,
    emptyMessage: "No completed audits in this period.",
    kpis,
    tables: [
      {
        title: "Visit evidence",
        columns: [
          capitalize(nouns.one),
          "Captured",
          "By",
          "Category",
          "Availability",
          "Empty gaps",
          "Top brands",
          "Photos",
          "Location",
          "GPS",
        ],
        rows,
        note: audits > shown ? `Showing the latest ${count(shown)} of ${count(audits)} visits.` : undefined,
      },
    ],
    photos: visits
      .filter((v) => v.original_path)
      .map((v) => ({
        scanId: v.scan_id,
        storeName: v.store_name,
        takenAt: reportDate(v.created_at, true),
        capturedBy: v.captured_by,
        location: locationLabel(v),
        bucket: v.original_bucket ?? "scan-images",
        path: v.original_path,
      })),
  };
}

function capitalize(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

/** Plain text for WhatsApp and other chat apps. */
export function reportShareText(doc: ReportDocument, url: string): string {
  const lines = [
    `Aislix · ${doc.title}${doc.labeledDemo ? " (demo data)" : ""}`,
    doc.subtitle,
    "",
    doc.empty ? doc.emptyMessage : doc.headline,
    ...(doc.empty ? [] : doc.kpis.map((k) => `• ${k.label}: ${k.value}`)),
    "",
    url,
  ];
  return lines.filter((l): l is string => l != null).join("\n").replace(/\n{3,}/g, "\n\n");
}
