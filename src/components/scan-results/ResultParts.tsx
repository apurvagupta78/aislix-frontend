import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Lightbulb,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, Skeleton } from "@/components/States";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  displayProductName,
  downloadScanAnnotatedImage,
  formatConfidence,
  inventoryToCsv,
  normalizeConfidence,
  type ComplianceAlert,
  type InventoryItem,
  type ScanAlert,
  type ScanRecommendation,
  type Severity,
  type ScanResult,
  type SubcategoryMismatch,
} from "@/lib/scan-results";
import {
  buildBrandPresenceRows,
  buildConfidenceDistribution,
  buildObservedProductsSummary,
  enrichObservedProductRows,
  resolvePrimaryBrand,
  type ObservedProductStatus,
} from "@/lib/observed-products-display";
import { downloadObservedProductsCsv } from "@/lib/observed-products-export";

/* ---------------------------------- shell --------------------------------- */

export function ResultSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string | undefined;
  actions?: React.ReactNode | undefined;
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return (
    <section className={cn("card-surface p-5 sm:p-6", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{description}</p>
          )}
        </div>
        {actions && <div className="min-w-0 shrink-0">{actions}</div>}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/* ------------------------------ summary cards ----------------------------- */

export function SummaryCard({
  label,
  value,
  hint,
  loading,
  accent,
  valueClassName,
}: {
  label: string;
  value?: string | number | undefined;
  hint?: string | undefined;
  loading?: boolean | undefined;
  accent?: boolean | undefined;
  valueClassName?: string | undefined;
}) {
  return (
    <div className="card-surface card-hover p-4 sm:p-5">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-20" />
      ) : (
        <p
          className={cn(
            "mt-2 text-2xl font-semibold tracking-tight tabular-nums",
            accent && "text-accent-green",
            valueClassName,
          )}
        >
          {value ?? "—"}
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* --------------------------- annotated image view -------------------------- */

export function AnnotatedImageViewer({
  src: rawSrc,
  originalSrc,
  scanId,
  loading,
  embedded = false,
  downloadTooltip = "Download image",
  highlightLabel,
}: {
  src?: string | undefined;
  originalSrc?: string | undefined;
  scanId?: string | undefined;
  loading?: boolean | undefined;
  /** Skip outer ResultSection — for embedded side-by-side layouts. */
  embedded?: boolean;
  downloadTooltip?: string;
  highlightLabel?: string;
}) {
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  // The vision service writes its annotated JPEG in BGR order, which shows up as
  // a blue cast. Correct it against the original photo before displaying.
  const [correctedSrc, setCorrectedSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    setCorrectedSrc(undefined);
    if (!rawSrc || !originalSrc) return;
    let active = true;
    void import("@/lib/annotated-image").then(async ({ correctAnnotatedImage }) => {
      const fixed = await correctAnnotatedImage(rawSrc, originalSrc);
      if (active && fixed !== rawSrc) setCorrectedSrc(fixed);
    });
    return () => {
      active = false;
    };
  }, [rawSrc, originalSrc]);

  const src = correctedSrc ?? rawSrc;


  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const controls = (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        variant="subtle"
        size="icon"
        className="rounded-xl"
        disabled={!src}
        onClick={() => setZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))))}
        aria-label="Zoom out"
      >
        <Minus className="size-4" />
      </Button>
      <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
        {Math.round(zoom * 100)}%
      </span>
      <Button
        variant="subtle"
        size="icon"
        className="rounded-xl"
        disabled={!src}
        onClick={() => setZoom((z) => Math.min(4, Number((z + 0.25).toFixed(2))))}
        aria-label="Zoom in"
      >
        <Plus className="size-4" />
      </Button>
      <Button
        variant="subtle"
        size="icon"
        className="rounded-xl"
        disabled={!src}
        onClick={() => setZoom(1)}
        aria-label="Fit to view"
        title="Fit"
      >
        <Minimize2 className="size-4" />
      </Button>
      <Button
        variant="subtle"
        size="icon"
        className="rounded-xl"
        disabled={!src}
        onClick={() => setFullscreen(true)}
        aria-label="Open full screen"
      >
        <Maximize2 className="size-4" />
      </Button>
      <Button
        variant="subtle"
        size={embedded ? "icon" : "sm"}
        className="rounded-xl"
        disabled={!src || downloading}
        title={downloadTooltip}
        aria-label={downloadTooltip}
        onClick={async () => {
          if (!src) return;
          setDownloading(true);
          try {
            await downloadScanAnnotatedImage(scanId ?? "audit", rawSrc, originalSrc);
            toast.success("Image downloaded");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Download failed");
          } finally {
            setDownloading(false);
          }
        }}
      >
        <Download className="size-4" />
        {!embedded ? " Image" : null}
      </Button>
    </div>
  );

  const imageBody = (
    <>
      <div
        className={cn(
          "relative max-h-[30rem] overflow-auto rounded-xl border border-border bg-muted/40",
          highlightLabel && "ring-2 ring-brand/30 ring-offset-2",
        )}
      >
        {loading ? (
          <Skeleton className="h-72 w-full rounded-none" />
        ) : src ? (
          <img
            src={src}
            alt="Annotated shelf image with detected products outlined"
            style={{
              width: `${zoom * 100}%`,
              objectFit: "contain",
              ...(zoom === 1 ? { maxHeight: "70vh" } : {}),
            }}
            className="mx-auto block max-w-none transition-[width] duration-200"
          />
        ) : (
          <div className="p-4">
            <EmptyState
              title={scanId ? "Preparing annotated image…" : "No annotated image yet"}
              description={
                scanId
                  ? "Aislix is loading or rebuilding the detection overlay for this audit."
                  : "The annotated shelf image appears here once the audit service returns it."
              }
            />
          </div>
        )}
        {highlightLabel ? (
          <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-brand/90 px-2 py-1 text-[10px] font-medium text-brand-foreground shadow-sm">
            {highlightLabel}
          </div>
        ) : null}
      </div>

      {fullscreen && src && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Annotated shelf image, full screen"
          className="fixed inset-0 z-50 animate-fade-in overflow-auto bg-background/98 p-4 backdrop-blur-sm"
        >
          <div className="sticky top-0 flex justify-end">
            <Button
              variant="subtle"
              size="icon"
              className="rounded-xl"
              onClick={() => setFullscreen(false)}
              aria-label="Close full screen"
            >
              <X className="size-4" />
            </Button>
          </div>
          <img
            src={src}
            alt="Annotated shelf image with detected products outlined"
            style={{ objectFit: "contain" }}
            className="mx-auto mt-2 w-full max-w-6xl rounded-2xl"
          />
        </div>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-end gap-1.5">{controls}</div>
        {imageBody}
      </div>
    );
  }

  return (
    <ResultSection
      title="Annotated shelf image"
      description="Detections rendered by the vision model."
      actions={controls}
    >
      {imageBody}
    </ResultSection>
  );
}

/* ------------------------------- compliance ------------------------------- */

export function ComplianceAlertCard({
  alerts,
  mismatches,
}: {
  alerts?: ComplianceAlert[] | undefined;
  mismatches?: SubcategoryMismatch[] | undefined;
}) {
  const [open, setOpen] = useState(false);
  const alert = alerts?.[0];
  if (!alert) return null;
  const rows = mismatches ?? [];

  return (
    <section
      role="alert"
      className="card-surface overflow-hidden border-l-4 border-l-destructive p-5 sm:p-6"
    >
      <div className="flex items-start gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{alert.title}</h2>
            <SeverityBadge severity={alert.severity} />
          </div>
          {alert.interpretation && (
            <p className="mt-1 text-sm italic text-muted-foreground">{alert.interpretation}</p>
          )}
          {alert.detail && <p className="mt-3 text-sm leading-relaxed">{alert.detail}</p>}
          {typeof alert.misplaced_facings === "number" && (
            <p className="mt-2 text-xs text-muted-foreground">
              {alert.misplaced_facings} misplaced facing(s)
              {alert.expected_sub_category_label
                ? ` · expected ${alert.expected_sub_category_label}`
                : ""}
            </p>
          )}
          {rows.length > 0 && (
            <>
              <Button
                variant="subtle"
                size="sm"
                className="mt-4 rounded-xl"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
              >
                {open ? "Hide" : "View"} mismatched products ({rows.length})
              </Button>
              {open && (
                <div className="mt-3 overflow-x-auto rounded-2xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Brand</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Detected sub-category</TableHead>
                        <TableHead>Expected</TableHead>
                        <TableHead className="text-right">Visible facings</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row, i) => (
                        <TableRow key={`${row.brand}-${row.product_name}-${i}`}>
                          <TableCell className="font-medium">{row.brand}</TableCell>
                          <TableCell>{row.product_name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.detected_sub_category_label}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.expected_sub_category_label}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{row.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- alerts --------------------------------- */


const severityStyles: Record<Severity, string> = {
  high: "border-destructive/30 bg-destructive/10 text-destructive",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low: "border-brand/25 bg-brand-soft text-brand",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge
      variant="outline"
      className={cn("shrink-0 rounded-full capitalize", severityStyles[severity])}
    >
      {severity}
    </Badge>
  );
}

const severityOrder: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

export function AlertsPanel({
  alerts,
  loading,
}: {
  alerts?: ScanAlert[] | undefined;
  loading?: boolean | undefined;
}) {
  const sorted = useMemo(
    () => [...(alerts ?? [])].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]),
    [alerts],
  );

  return (
    <ResultSection title="Critical alerts" description="Issues the model flagged on this shelf.">
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          title="No alerts"
          description="Alerts returned by the audit service are listed here by severity."
        />
      ) : (
        <ul className="space-y-3">
          {sorted.map((alert) => (
            <li
              key={alert.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-brand/30"
            >
              <SeverityBadge severity={alert.severity} />
              <div className="min-w-0">
                <p className="text-sm font-medium">{alert.title}</p>
                {alert.detail && (
                  <p className="mt-1 text-sm text-muted-foreground">{alert.detail}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </ResultSection>
  );
}

/* ------------------------------ recommendations --------------------------- */

export function RecommendationsPanel({
  recommendations,
  loading,
}: {
  recommendations?: ScanRecommendation[] | undefined;
  loading?: boolean | undefined;
}) {
  return (
    <ResultSection
      title="AI recommendations"
      description="Suggested merchandising actions for this aisle."
    >
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (recommendations ?? []).length === 0 ? (
        <EmptyState
          icon={<Lightbulb className="size-5" />}
          title="No recommendations yet"
          description="Recommendations generated by the AI pipeline appear here."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {recommendations!.map((rec) => (
            <article
              key={rec.id}
              className="card-hover rounded-2xl border border-border bg-surface p-4"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Sparkles className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{rec.title}</p>
                  {rec.detail && (
                    <p className="mt-1 text-sm text-muted-foreground">{rec.detail}</p>
                  )}
                  {(rec.category || rec.impact) && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {rec.category && (
                        <Badge variant="outline" className="rounded-full">
                          {rec.category}
                        </Badge>
                      )}
                      {rec.impact && (
                        <Badge
                          variant="outline"
                          className="rounded-full border-accent-green/30 bg-accent-green-soft text-accent-green"
                        >
                          {rec.impact}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </ResultSection>
  );
}

/* ------------------------------ inventory table --------------------------- */

type SortKey = "brand" | "product" | "variant" | "quantity" | "confidence" | "shelf_position";
const PAGE_SIZE = 10;

const STATUS_PILL: Record<ObservedProductStatus, string> = {
  Observed: "border-brand/25 bg-brand-soft text-brand",
  Matched: "border-accent-green/30 bg-accent-green-soft text-accent-green",
  "Needs Review": "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  Unknown: "border-border bg-muted/50 text-muted-foreground",
  "Not Assessed": "border-border bg-muted/30 text-muted-foreground",
};

function ObservedStatusBadge({ status }: { status: ObservedProductStatus }) {
  return (
    <Badge variant="outline" className={cn("rounded-full text-[10px] font-medium", STATUS_PILL[status])}>
      {status}
    </Badge>
  );
}

function ConfidenceDistributionStrip({ items }: { items: InventoryItem[] }) {
  const dist = buildConfidenceDistribution(items);
  const total = dist.high + dist.needs_review + dist.unknown || 1;
  const segments = [
    { label: "High confidence", count: dist.high, className: "bg-accent-green" },
    { label: "Needs review", count: dist.needs_review, className: "bg-amber-500" },
    { label: "Unknown", count: dist.unknown, className: "bg-muted-foreground/40" },
  ];
  return (
    <div className="rounded-xl border border-border/70 bg-background px-4 py-3">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
        {segments.map(({ label, count, className }) =>
          count > 0 ? (
            <div
              key={label}
              className={cn("h-full", className)}
              style={{ width: `${(count / total) * 100}%` }}
              title={`${label}: ${count}`}
            />
          ) : null,
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
        {segments.map(({ label, count }) => (
          <span key={label}>
            {label}: <span className="font-medium tabular-nums text-foreground">{count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function BrandPresenceChart({
  rows,
  maxFacings,
}: {
  rows: ReturnType<typeof buildBrandPresenceRows>;
  maxFacings: number;
}) {
  return (
    <ul className="mt-3 space-y-2.5">
      {rows.map((row) => {
        const pct = Math.max((row.facings / maxFacings) * 100, row.facings > 0 ? 4 : 0);
        return (
          <li key={row.brand}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate font-medium">{row.brand}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {row.facings} facing{row.facings === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full", row.bar_class)} style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function InventoryTable({
  items,
  scanId,
  csvUrl,
  loading,
  scanResult,
}: {
  items?: InventoryItem[] | undefined;
  scanId?: string | undefined;
  csvUrl?: string | undefined;
  loading?: boolean | undefined;
  scanResult?: ScanResult | undefined;
}) {
  const rows = items ?? [];
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("all");
  const [stock, setStock] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "quantity",
    dir: "desc",
  });
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"sku" | "brand">("sku");
  const brands = useMemo(
    () => Array.from(new Set(rows.map((r) => r.brand).filter(Boolean))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const next = rows.filter((r) => {
      const matchesQuery =
        !q ||
        [r.brand, r.product, r.variant, r.category]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q));
      const matchesBrand = brand === "all" || r.brand === brand;
      const matchesStock =
        stock === "all"
          ? true
          : stock === "low"
            ? !!r.low_stock
            : stock === "out"
              ? !!r.out_of_stock
              : !r.low_stock && !r.out_of_stock;
      return matchesQuery && matchesBrand && matchesStock;
    });

    return next.sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      if (sort.key === "quantity") return (a.quantity - b.quantity) * dir;
      if (sort.key === "confidence")
        return (normalizeConfidence(a.confidence) - normalizeConfidence(b.confidence)) * dir;
      return String(a[sort.key] ?? "").localeCompare(String(b[sort.key] ?? "")) * dir;
    });
  }, [rows, query, brand, stock, sort]);

  useEffect(() => setPage(1), [query, brand, stock]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const summary = useMemo(() => buildObservedProductsSummary(rows), [rows]);

  const enrichedAll = useMemo(
    () => (scanResult ? enrichObservedProductRows(scanResult, rows) : rows.map((r) => ({
      ...r,
      status: "Observed" as ObservedProductStatus,
      shelf_label: r.shelf_position ? r.shelf_position.replace(/^S(\d+).*/i, "Shelf $1") : "—",
      location_label: r.shelf_position ?? "—",
    }))),
    [scanResult, rows],
  );

  const enrichedById = useMemo(
    () => new Map(enrichedAll.map((r) => [r.id, r])),
    [enrichedAll],
  );

  const primaryBrand = useMemo(
    () => (scanResult ? resolvePrimaryBrand(scanResult) : ""),
    [scanResult],
  );

  const brandPresence = useMemo(
    () => buildBrandPresenceRows(filtered, primaryBrand),
    [filtered, primaryBrand],
  );

  const maxBrandFacings = useMemo(
    () => Math.max(...brandPresence.map((b) => b.facings), 1),
    [brandPresence],
  );

  const toggleSort = useCallback((key: SortKey) => {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }, []);

  const SortHeader = ({
    label,
    sortKey,
    className,
    numeric,
  }: {
    label: string;
    sortKey: SortKey;
    className?: string | undefined;
    numeric?: boolean | undefined;
  }) => {
    const active = sort.key === sortKey;
    const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <TableHead className={className}>
        <button
          type="button"
          onClick={() => toggleSort(sortKey)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md text-xs font-medium transition-colors hover:text-foreground",
            numeric && "justify-end",
            active ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {label} <Icon className="size-3.5" />
        </button>
      </TableHead>
    );
  };

  const exportCsv = () => {
    if (scanResult) {
      downloadObservedProductsCsv(scanResult, rows);
      return;
    }
    const csv = inventoryToCsv(rows);
    const link = document.createElement("a");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.href = url;
    link.download = `aislix-${scanId ?? "audit"}-observed-products.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-xl border border-border/70 bg-muted/30 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-foreground/70">
            What Aislix found
          </p>
          <h2 className="mt-1 text-base font-semibold tracking-tight sm:text-lg">
            Products Visible on This Shelf
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            See the products, brands and visible facings Aislix detected in this photo. This is a
            shelf-level observation — not total store inventory.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 shrink-0 rounded-lg"
          title="Download Observed Products CSV"
          aria-label="Download Observed Products CSV"
          onClick={exportCsv}
          disabled={rows.length === 0}
        >
          <Download className="size-3.5" />
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Products Detected", value: summary.product_count },
          { label: "Brands Detected", value: summary.brand_count },
          { label: "Visible Facings", value: summary.visible_facings },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-border/70 bg-background px-4 py-3"
          >
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-brand">
              {value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Visible facings are the front-facing units detected in this photograph. They are not total
        inventory.
      </p>

      <div className="mt-4">
      <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_10rem_10rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search brand, product or variant"
            className="h-11 rounded-xl pl-9"
            aria-label="Search inventory"
          />
        </div>
        <Select value={brand} onValueChange={setBrand}>
          <SelectTrigger className="h-11 rounded-xl" aria-label="Filter by brand">
            <SelectValue placeholder="All brands" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All brands</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stock} onValueChange={setStock}>
          <SelectTrigger className="h-11 rounded-xl" aria-label="Filter by status">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="low">Low stock only</SelectItem>
            <SelectItem value="out">Out of stock only</SelectItem>
            <SelectItem value="ok">In stock only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">View by:</span>
        <div className="inline-flex rounded-xl border border-border bg-background p-0.5">
          {([
            { key: "sku", label: "SKU" },
            { key: "brand", label: "Brand" },
          ] as const).map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={view === o.key}
              onClick={() => setView(o.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                view === o.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {view === "brand" ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-border/70 bg-background px-4 py-3">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-foreground/70">
              Brand presence on this shelf
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Visible facings detected by brand.
            </p>
            {brandPresence.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No matching products.</p>
            ) : (
              <BrandPresenceChart rows={brandPresence} maxFacings={maxBrandFacings} />
            )}
          </div>
          <div className="overflow-x-auto rounded-2xl border border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-muted-foreground">Brand</TableHead>
                  <TableHead className="text-right text-xs font-medium text-muted-foreground">
                    SKUs
                  </TableHead>
                  <TableHead className="text-right text-xs font-medium text-muted-foreground">
                    Visible facings
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brandPresence.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="p-4">
                      <EmptyState
                        title="No matching products"
                        description="Try a different search term or clear the filters."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  brandPresence.map((g) => (
                    <TableRow key={g.brand} className="transition-colors hover:bg-muted/50">
                      <TableCell className="font-medium">{g.brand}</TableCell>
                      <TableCell className="text-right tabular-nums">{g.sku_count}</TableCell>
                      <TableCell className="text-right tabular-nums">{g.facings}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
      <>
      {rows.length > 0 ? (
        <div className="mt-4">
          <ConfidenceDistributionStrip items={rows} />
        </div>
      ) : null}
      <div className="mt-4 overflow-x-auto rounded-2xl border border-border/70">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader label="Brand" sortKey="brand" />
              <SortHeader label="Product" sortKey="product" />
              <SortHeader label="Variant" sortKey="variant" className="hidden md:table-cell" />
              <SortHeader label="Visible Facings" sortKey="quantity" numeric className="text-right" />
              <SortHeader label="Confidence" sortKey="confidence" numeric className="text-right" />
              <SortHeader
                label="Shelf / Location"
                sortKey="shelf_position"
                className="hidden lg:table-cell"
              />
              <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, c) => (
                    <TableCell key={c}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="p-4">
                  <EmptyState
                    title={rows.length === 0 ? "No inventory yet" : "No matching products"}
                    description={
                      rows.length === 0
                        ? "Detected products appear here once the audit service returns inventory."
                        : "Try a different search term or clear the filters."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              visible.map((row) => {
                const enriched = enrichedById.get(row.id);
                const status = enriched?.status ?? "Observed";
                const shelfLabel = enriched?.shelf_label ?? row.shelf_position ?? "—";
                return (
                  <TableRow key={row.id} className="transition-colors hover:bg-muted/50">
                    <TableCell className="font-medium">{row.brand}</TableCell>
                    <TableCell>
                      <span className="block truncate">{displayProductName(row)}</span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {row.variant ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatConfidence(row.confidence)}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {shelfLabel}
                    </TableCell>
                    <TableCell>
                      <ObservedStatusBadge status={status} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 grid gap-3 sm:flex sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {filtered.length === 0
            ? "0 products"
            : `Showing ${(current - 1) * PAGE_SIZE + 1}–${Math.min(
                current * PAGE_SIZE,
                filtered.length,
              )} of ${filtered.length} products`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="subtle"
            size="sm"
            className="rounded-xl"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft className="size-4" /> Previous
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">
            Page {current} of {pageCount}
          </span>
          <Button
            variant="subtle"
            size="sm"
            className="rounded-xl"
            disabled={current >= pageCount}
            onClick={() => setPage(current + 1)}
          >
            Next <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
      </>
      )}

      </div>
    </section>
  );
}

/* --------------------------------- misc ----------------------------------- */

export function useAbortableEffectRef() {
  return useRef<AbortController | null>(null);
}
