/**
 * Brand & competition analysis — Share of Shelf + Product Mix (FMCG / demo audits).
 */

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  buildBrandAnalysisMeta,
  buildProductMixRows,
  buildShareOfShelfSegments,
  formatPlannedActualLine,
} from "@/lib/brand-analysis-data";
import {
  downloadBrandAnalysisCsv,
  downloadProductMixCsv,
  downloadShareOfShelfCsv,
} from "@/lib/brand-analysis-export";
import { formatCompetitorBrandLabel } from "@/lib/brand-intel";
import { DEMO_PLANOGRAM_LABEL, isDemoOralCareResult } from "@/lib/demo-oral-care-planogram";
import type { ScanResult } from "@/lib/scan-results";
import { cn } from "@/lib/utils";

const PRODUCT_PREVIEW = 7;

function ShareOfShelfStackedBar({ segments }: { segments: ReturnType<typeof buildShareOfShelfSegments> }) {
  const total = segments.reduce((s, x) => s + x.share, 0) || 1;
  return (
    <div className="space-y-3">
      <div className="flex h-4 overflow-hidden rounded-full border border-border/60 bg-muted/40">
        {segments.map((seg) => (
          <div
            key={seg.brand}
            className={cn("transition-all", seg.bar_class)}
            style={{ width: `${(seg.share / total) * 100}%` }}
            title={`${seg.brand} ${Number(seg.share ?? 0).toFixed(1)}%`}
          />
        ))}
      </div>
      <ul className="space-y-1.5">
        {segments.map((seg) => (
          <li key={seg.brand} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="flex min-w-0 items-center gap-2">
              <span className={cn("size-2 shrink-0 rounded-sm", seg.bar_class)} />
              <span
                className={cn(
                  "truncate font-medium",
                  seg.is_primary ? "text-brand" : "text-foreground",
                )}
              >
                {formatCompetitorBrandLabel(seg.brand, false)}
              </span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {Math.round(seg.share)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PanelDownloadButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className="shrink-0 rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:border-brand/30 hover:bg-muted/50 hover:text-brand"
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      <Download className="size-3.5" />
    </button>
  );
}

export function DemoBrandProductAnalysis({
  data,
  loading,
}: {
  data?: ScanResult;
  loading?: boolean;
}) {
  const [showAllProducts, setShowAllProducts] = useState(false);
  const snapshot = data?.competitor_intel;
  const inventory = data?.inventory ?? [];

  const meta = useMemo(
    () => (data ? buildBrandAnalysisMeta(data, snapshot) : null),
    [data, snapshot],
  );

  const segments = useMemo(
    () => buildShareOfShelfSegments(snapshot, meta?.total_linear ?? 100),
    [snapshot, meta?.total_linear],
  );

  const productRows = useMemo(
    () => buildProductMixRows(inventory, snapshot?.primary_brand ?? meta?.target_brand ?? ""),
    [inventory, snapshot?.primary_brand, meta?.target_brand],
  );

  const visibleProducts = showAllProducts
    ? productRows
    : productRows.slice(0, PRODUCT_PREVIEW);
  const maxFacings = productRows[0]?.facings ?? 1;

  if (loading) {
    return (
      <section className="rounded-xl border border-border/70 bg-muted/30 p-5 sm:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-40 rounded bg-muted" />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-48 rounded-lg bg-muted" />
            <div className="h-48 rounded-lg bg-muted" />
          </div>
        </div>
      </section>
    );
  }

  if (!snapshot?.primary_brand && productRows.length === 0) return null;

  const isDemo = isDemoOralCareResult(data);
  const primaryBrand = snapshot?.primary_brand ?? productRows[0]?.brand ?? "Your brand";
  const ownShare = meta?.actual_share ?? snapshot?.own_brand_share_percent ?? 0;

  return (
    <section className="rounded-xl border border-border/70 bg-muted/30 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight sm:text-lg">Brand &amp; Competition</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            See how your brand is positioned on the shelf, how much space competitors occupy and
            which products make up the category.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isDemo ? (
            <Badge variant="outline" className="text-[10px]">
              {DEMO_PLANOGRAM_LABEL}
            </Badge>
          ) : null}
          {data ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg text-xs"
              onClick={() => downloadBrandAnalysisCsv(data, snapshot)}
            >
              <Download className="mr-1.5 size-3.5" />
              Download Brand Analysis ↓
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {/* Share of Shelf */}
        <article className="rounded-lg border border-border/80 border-l-[3px] border-l-brand bg-card px-4 py-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-foreground">Share of Shelf</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Your brand&apos;s shelf space compared with competing brands.
              </p>
            </div>
            {data ? (
              <PanelDownloadButton
                label="Download Share of Shelf data"
                onClick={() => downloadShareOfShelfCsv(data, snapshot)}
              />
            ) : null}
          </div>

          <p className="mt-4 text-xl font-semibold tabular-nums tracking-tight text-brand">
            {primaryBrand} · {Math.round(ownShare)}%
          </p>

          <div className="mt-3">
            {segments.length > 0 ? (
              <ShareOfShelfStackedBar segments={segments} />
            ) : (
              <p className="text-xs text-muted-foreground">No brand share data for this audit.</p>
            )}
          </div>

          {meta ? (
            <p className="mt-3 text-[11px] text-muted-foreground">{formatPlannedActualLine(meta)}</p>
          ) : null}
        </article>

        {/* Product Mix */}
        <article className="rounded-lg border border-border/80 border-l-[3px] border-l-brand/60 bg-card px-4 py-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-foreground">
                Product Mix on the Shelf
              </h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                See which products and brands occupy the shelf, and how much visible presence each
                one has.
              </p>
            </div>
            {data ? (
              <PanelDownloadButton
                label="Download Product Mix data"
                onClick={() => downloadProductMixCsv(data, snapshot)}
              />
            ) : null}
          </div>

          <div className="mt-4 space-y-2.5">
            {visibleProducts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No products detected on this shelf.</p>
            ) : (
              visibleProducts.map((row) => (
                <div key={`${row.brand}-${row.product}-${row.sku ?? ""}`} className="space-y-1">
                  <div className="flex justify-between gap-2 text-[11px]">
                    <span className="min-w-0 truncate font-medium text-foreground">
                      {row.is_unknown ? (
                        <span className="text-muted-foreground">Unknown {row.product}</span>
                      ) : (
                        <>
                          {row.brand}{" "}
                          <span className="font-normal text-muted-foreground">{row.product}</span>
                        </>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {row.facings} facings
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full transition-all", row.bar_class)}
                      style={{ width: `${(row.facings / maxFacings) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {productRows.length > PRODUCT_PREVIEW ? (
            <button
              type="button"
              className="mt-3 text-[11px] font-medium text-brand hover:underline"
              onClick={() => setShowAllProducts((v) => !v)}
            >
              {showAllProducts ? "Show fewer products" : "View all products →"}
            </button>
          ) : null}
        </article>
      </div>

      {snapshot?.upper_hand?.length ? (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Insights
          </p>
          {snapshot.upper_hand.map((edge) => (
            <div
              key={edge.brand}
              className="rounded-lg border border-border/60 bg-card px-3 py-2 text-[11px] text-muted-foreground"
            >
              {edge.note.replace(/shelf share/gi, "Share of Shelf").replace(/facing share/gi, "Share of Shelf")}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
