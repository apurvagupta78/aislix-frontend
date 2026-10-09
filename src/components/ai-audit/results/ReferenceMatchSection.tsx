import { useEffect, useState } from "react";
import { ChevronDown, FileSpreadsheet, FileText } from "lucide-react";

import { AiAuditMetricTable } from "@/components/ai-audit/results/AiAuditMetricTable";
import { AiAuditCard } from "@/components/ai-audit/results/AiAuditUi";
import {
  AiPill,
  LocationStatusPill,
  PriceStatusPill,
  formatShelfPrice,
} from "@/components/ai-audit/results/AiLocationSections";
import { supabase } from "@/integrations/supabase/client";
import { ACCENT_TINT, AISLIX_PALETTE } from "@/lib/ai-audit/kpi-palette";
import { documentTypeLabel } from "@/lib/ai-audit/reference-document";
import type {
  ReferenceMatch,
  ReferenceMatchLine,
  ReferencePresence,
  ReferenceVerdict,
} from "@/lib/ai-audit/reference-match";
import { downloadSectionCsv } from "@/lib/ai-audit/section-csv";
import { cn } from "@/lib/utils";

const VERDICT: Record<ReferenceVerdict, { label: string; accent: string; tint: string }> = {
  MATCHES: { label: "Matches", accent: AISLIX_PALETTE.green, tint: ACCENT_TINT.green },
  PARTIAL: { label: "Partially matches", accent: AISLIX_PALETTE.purple, tint: ACCENT_TINT.purple },
  DOES_NOT_MATCH: { label: "Does not match", accent: "#F6CFDC", tint: AISLIX_PALETTE.pink },
};

const PRESENCE: Record<ReferencePresence, { label: string; tone: "green" | "pink" | "grey" | "blue" }> = {
  FOUND: { label: "Found", tone: "green" },
  FOUND_VARIANT_UNVERIFIED: { label: "Found · variant unclear", tone: "blue" },
  UNCLEAR: { label: "Needs review", tone: "grey" },
  MISSING: { label: "Missing", tone: "pink" },
};

function lineName(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" ") || "—";
}

function priceText(value: string | number | null): string | null {
  if (value === null) return null;
  return typeof value === "number" ? `₹${value}` : formatShelfPrice(value);
}

const PROMO_STATUS: Record<string, { label: string; tone: "green" | "pink" | "grey" | "blue" }> = {
  PROMO_SEEN: { label: "Offer seen", tone: "green" },
  PROMO_NOT_SEEN: { label: "Offer not seen", tone: "pink" },
  UNEXPECTED_PROMO: { label: "Offer not on document", tone: "blue" },
  NO_EXPECTED: { label: "No promo on document", tone: "grey" },
  NOT_ON_SHELF: { label: "Not on shelf", tone: "grey" },
};

function promoCell(line: ReferenceMatchLine) {
  const status = line.promo_status ? PROMO_STATUS[line.promo_status] : null;
  return (
    <div className="max-w-[200px] space-y-1">
      <p className="text-[11px] text-[#667085]">
        Doc {line.expected_promo ? `“${line.expected_promo}”` : "—"} · Shelf{" "}
        {line.shelf_promotion ? `“${line.shelf_promotion}”` : "—"}
        {line.shelf_promo_price != null ? ` (${priceText(line.shelf_promo_price)})` : ""}
      </p>
      {status ? <AiPill tone={status.tone}>{status.label}</AiPill> : <AiPill tone="grey">N/A</AiPill>}
    </div>
  );
}

function qtyCell(line: ReferenceMatchLine, countPending: boolean) {
  if (line.presence_status === "MISSING") return "0";
  if (line.presence_status === "UNCLEAR") return <AiPill tone="grey">N/A</AiPill>;
  if (countPending || line.qty_status === "PENDING") return <AiPill tone="grey">Pending</AiPill>;
  if (line.shelf_units == null) return <AiPill tone="grey">N/A</AiPill>;
  return line.shelf_units;
}

type DocumentItem = Record<string, unknown>;
type DocumentColumn = { key: string; header: string; value: (item: DocumentItem) => string };

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function itemExtra(item: DocumentItem): Record<string, unknown> {
  const extra = item.extra_fields;
  return extra && typeof extra === "object" && !Array.isArray(extra) ? (extra as Record<string, unknown>) : {};
}

/** The uploaded lines as a table: standard columns, then every extra column as printed. Empty columns are hidden. */
function documentColumns(items: DocumentItem[], extraColumns: string[]): DocumentColumn[] {
  const extraHeaders = extraColumns.length
    ? extraColumns
    : [...new Set(items.flatMap((item) => Object.keys(itemExtra(item))))];
  const columns: DocumentColumn[] = [
    { key: "brand", header: "Brand", value: (i) => cellText(i.brand) },
    { key: "product", header: "Product", value: (i) => cellText(i.product_name) },
    { key: "variant", header: "Variant", value: (i) => cellText(i.variant) },
    {
      key: "qty",
      header: "Qty",
      value: (i) => [cellText(i.invoice_qty), cellText(i.quantity_unit)].filter(Boolean).join(" "),
    },
    {
      key: "price",
      header: "Price",
      value: (i) => (cellText(i.expected_price) ? `₹${cellText(i.expected_price)}` : ""),
    },
    { key: "location", header: "Location", value: (i) => cellText(i.expected_location) },
    { key: "promo", header: "Promo", value: (i) => cellText(i.expected_promo) },
    ...extraHeaders
      .filter((header) => !/^(promo|offer|scheme|deal)/i.test(header))
      .map((header) => ({
        key: `extra:${header}`,
        header,
        value: (i: DocumentItem) => cellText(itemExtra(i)[header]),
      })),
  ];
  return columns.filter((column) => items.some((item) => column.value(item)));
}

function useDocumentUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return;
    }
    void supabase.storage
      .from("scan-images")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  return url;
}

function Tile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
  tint?: string;
}) {
  return (
    <div className="rounded-xl border border-[#D9E2E8] bg-white px-3 py-3">
      <p className="font-display text-2xl font-semibold tabular-nums text-[#04203F]">{value}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-[#04203F]">
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: accent }} aria-hidden />
        {label}
      </p>
      {sub ? <p className="mt-0.5 text-[10px] text-[#667085]">{sub}</p> : null}
    </div>
  );
}

/** Customer document vs shelf: verdict, 5 KPIs, side-by-side evidence, per-line table. */
export function ReferenceMatchSection({
  scanId,
  match,
  imageUrl,
  documentItems = [],
}: {
  scanId: string;
  match: ReferenceMatch;
  imageUrl: string | null | undefined;
  /** Document lines saved with the scan — shown as the uploaded table. */
  documentItems?: DocumentItem[];
}) {
  const [showExtra, setShowExtra] = useState(false);
  const { metrics: m, document: doc, count_pending: countPending } = match;
  const documentUrl = useDocumentUrl(doc.storage_path);
  const isPdf = (doc.mime_type ?? "").includes("pdf");
  const docColumns = documentColumns(documentItems, doc.extra_columns);
  const showDocumentTable = docColumns.length > 0 && (!documentUrl || isPdf);
  const verdict = match.verdict ? VERDICT[match.verdict] : null;
  const docLabel = doc.source === "csv" ? "CSV / Excel" : documentTypeLabel(doc.document_type);
  const showPromo = match.lines.some((line) => line.expected_promo || line.shelf_promotion);
  const compared = [
    `${docLabel}${doc.document_number ? ` ${doc.document_number}` : ""}`,
    doc.supplier_name,
    doc.document_date,
  ]
    .filter(Boolean)
    .join(" · ");

  const qtyValue = countPending
    ? "Pending"
    : m.invoice_qty_total == null || m.shelf_units_on_document_lines == null
      ? "N/A"
      : `${m.shelf_units_on_document_lines} / ${m.invoice_qty_total}`;

  function downloadLines() {
    downloadSectionCsv(
      scanId,
      "document-comparison",
      [
        "Line",
        "Product (document)",
        "As printed",
        "Matched on shelf",
        "Presence",
        "Document qty",
        "Unit",
        "AI detected qty (units)",
        "Document price",
        "Shelf price",
        "Price status",
        "Expected location",
        "Shelf location",
        "Location status",
        "Document promo",
        "Shelf promo",
        "Promo status",
      ],
      [
        ...match.lines.map((line) => [
          line.line_no,
          lineName([line.brand, line.product_name, line.variant]),
          line.raw_text,
          lineName([line.actual_brand, line.actual_product_name, line.actual_variant]),
          PRESENCE[line.presence_status].label,
          line.invoice_qty,
          line.quantity_unit,
          countPending ? "COUNT VERIFICATION PENDING" : line.shelf_units,
          line.expected_price,
          line.visible_price,
          line.price_status ?? "N/A",
          line.expected_location,
          line.shelf_location_label,
          line.location_status ?? "N/A",
          line.expected_promo,
          line.shelf_promotion,
          line.promo_status ? (PROMO_STATUS[line.promo_status]?.label ?? line.promo_status) : "N/A",
        ]),
        ...match.not_on_document.map((row) => [
          "",
          "",
          "",
          lineName([row.brand, row.product_name, row.variant]),
          "Not on this document",
          "",
          "",
          countPending ? "COUNT VERIFICATION PENDING" : row.shelf_units,
          "",
          row.visible_price,
          "",
          "",
          row.shelf_location_label,
          "",
          "",
          row.shelf_promotion,
          "",
        ]),
      ],
    );
  }

  return (
    <div className="space-y-4">
      <AiAuditCard
        title="Document comparison"
        description={compared ? `Compared against: ${compared}` : "Compared against your document"}
        csvDownload={{ onDownload: downloadLines }}
      >
        {verdict ? (
          <div className="rounded-xl border border-[#D9E2E8] bg-white px-4 py-3">
            <p className="flex items-center gap-2 font-display text-xl font-semibold text-[#04203F]">
              <span className="size-2 shrink-0 rounded-full" style={{ background: verdict.accent }} aria-hidden />
              {verdict.label}
            </p>
            <p className="mt-0.5 text-xs text-[#667085]">
              {doc.source === "csv"
                ? "Lines from your file"
                : doc.source === "manual"
                  ? "Product list typed in Aislix"
                  : "Read from document by AI"}{" "}
              · Shelf detected by AI
              {" · "}
              {m.lines_found} of {m.lines_total} lines found on the shelf
            </p>
          </div>
        ) : (
          <p className="text-sm text-[#667085]">Data unavailable — no document lines were compared.</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Tile
            label="Products found"
            value={`${m.lines_found} / ${m.lines_total}`}
            sub={m.lines_unclear ? `${m.lines_unclear} need review` : undefined}
            accent={AISLIX_PALETTE.green}
            tint={ACCENT_TINT.green}
          />
          <Tile
            label="On shelf vs document (units)"
            value={qtyValue}
            sub={countPending ? "Count verification pending" : m.qty_lines_checked ? `${m.qty_lines_covered} of ${m.qty_lines_checked} lines fully on shelf` : undefined}
            accent={AISLIX_PALETTE.cyan}
            tint={ACCENT_TINT.cyan}
          />
          <Tile
            label="Price match"
            value={m.price_lines_checked ? `${m.price_lines_matched} / ${m.price_lines_checked}` : "N/A"}
            sub={
              m.price_lines_checked
                ? undefined
                : m.prices_on_document
                  ? "No readable shelf prices"
                  : "No prices on document"
            }
            accent={AISLIX_PALETTE.blue}
            tint={ACCENT_TINT.blue}
          />
          <Tile
            label="Location match"
            value={m.location_lines_checked ? `${m.location_lines_correct} / ${m.location_lines_checked}` : "N/A"}
            sub={
              m.location_lines_checked
                ? undefined
                : m.locations_on_document
                  ? "Bins not readable in photo"
                  : "No bins on document"
            }
            accent={AISLIX_PALETTE.purple}
            tint={ACCENT_TINT.purple}
          />
          <Tile
            label="Missing lines"
            value={String(m.lines_missing)}
            sub={m.not_on_document ? `${m.not_on_document} on shelf not on document` : undefined}
            accent="#F6CFDC"
            tint={AISLIX_PALETTE.pink}
          />
        </div>
        <p className="mt-3 text-[11px] text-[#667085]">
          Matches = at least 90% of lines found with no price or bin mismatch · Partially = at least 60% found.
          Shelf quantity is what is visible in the photo, shown for information.
        </p>
      </AiAuditCard>

      {showDocumentTable ? (
        <AiAuditCard
          title="Your document"
          description={`${doc.filename ?? docLabel} · ${documentItems.length} line${documentItems.length === 1 ? "" : "s"} as uploaded`}
          csvDownload={{
            onDownload: () =>
              downloadSectionCsv(
                scanId,
                "your-document",
                ["Line", ...docColumns.map((c) => c.header)],
                documentItems.map((item, i) => [
                  cellText(item.line_no) || i + 1,
                  ...docColumns.map((c) => c.value(item)),
                ]),
              ),
          }}
        >
          <AiAuditMetricTable
            rows={documentItems}
            rowKey={(item) => `${cellText(item.line_no)}-${cellText(item.product_name)}`}
            columns={[
              {
                key: "line",
                header: "Line",
                cell: (item: DocumentItem) => cellText(item.line_no) || "—",
              },
              ...docColumns.map((column) => ({
                key: column.key,
                header: column.header,
                cell: (item: DocumentItem) => column.value(item) || "—",
              })),
            ]}
          />
          {documentUrl && isPdf ? (
            <a
              href={documentUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-xs font-semibold text-[#04203F] underline"
            >
              Open PDF
            </a>
          ) : null}
        </AiAuditCard>
      ) : null}

      <div className={cn("grid gap-4", !showDocumentTable && "lg:grid-cols-2")}>
        {showDocumentTable ? null : (
        <AiAuditCard title="Your document" description={doc.filename ?? docLabel}>
          {documentUrl && !isPdf ? (
            <img
              src={documentUrl}
              alt="Uploaded reference document"
              className="max-h-[420px] w-full rounded-lg border border-[#D9E2E8] object-contain bg-[#F4F7F9]"
            />
          ) : (
            <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-lg border border-[#D9E2E8] bg-[#F4F7F9] p-4 text-center text-xs text-[#667085]">
              {doc.source === "csv" ? <FileSpreadsheet className="size-6" /> : <FileText className="size-6" />}
              <span className="text-sm font-medium text-[#04203F]">{docLabel}</span>
              <span>{m.lines_total} lines compared</span>
              {documentUrl && isPdf ? (
                <a href={documentUrl} target="_blank" rel="noreferrer" className="font-semibold text-[#04203F] underline">
                  Open PDF
                </a>
              ) : null}
            </div>
          )}
        </AiAuditCard>
        )}
        <AiAuditCard title="Shelf scanned" description="Photo the AI checked">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Scanned shelf"
              className="max-h-[420px] w-full rounded-lg border border-[#D9E2E8] object-contain bg-[#F4F7F9]"
            />
          ) : (
            <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-[#D9E2E8] bg-[#EEF1F4] text-xs text-[#667085]">
              Shelf photo unavailable
            </div>
          )}
        </AiAuditCard>
      </div>

      <AiAuditCard
        title="Line-by-line comparison"
        description="Each document line checked against the shelf"
        csvDownload={{ onDownload: downloadLines }}
      >
        <AiAuditMetricTable
          rows={match.lines}
          rowKey={(line) => `${line.line_no}-${line.product_name ?? ""}`}
          columns={[
            { key: "n", header: "Line", cell: (line: ReferenceMatchLine) => line.line_no },
            {
              key: "doc",
              header: "Product (document)",
              className: "min-w-[180px]",
              cell: (line) => (
                <div className="max-w-[240px]">
                  <p className="font-medium leading-snug text-[#04203F]">
                    {lineName([line.brand, line.product_name, line.variant])}
                  </p>
                  {line.raw_text ? (
                    <p className="mt-0.5 text-[10px] text-[#667085]">As printed: {line.raw_text}</p>
                  ) : null}
                </div>
              ),
            },
            {
              key: "shelf",
              header: "Matched on shelf",
              className: "min-w-[160px]",
              cell: (line) => lineName([line.actual_brand, line.actual_product_name, line.actual_variant]),
            },
            {
              key: "presence",
              header: "Presence",
              cell: (line) => (
                <AiPill tone={PRESENCE[line.presence_status].tone}>{PRESENCE[line.presence_status].label}</AiPill>
              ),
            },
            {
              key: "qty",
              header: "Document qty",
              cell: (line) =>
                line.invoice_qty == null ? (
                  <AiPill tone="grey">N/A</AiPill>
                ) : (
                  `${line.invoice_qty}${line.quantity_unit ? ` ${line.quantity_unit}` : ""}`
                ),
            },
            { key: "onshelf", header: "AI detected qty", cell: (line) => qtyCell(line, countPending) },
            {
              key: "price",
              header: "Price",
              className: "min-w-[120px]",
              cell: (line) => (
                <div className="space-y-1">
                  <p className="text-[11px] text-[#667085]">
                    Doc {line.expected_price != null ? `₹${line.expected_price}` : "—"} · Shelf{" "}
                    {priceText(line.visible_price) ?? "—"}
                  </p>
                  {line.price_status ? (
                    <PriceStatusPill status={line.price_status} difference={line.price_difference} />
                  ) : (
                    <AiPill tone="grey">N/A</AiPill>
                  )}
                </div>
              ),
            },
            {
              key: "loc",
              header: "Location",
              className: "min-w-[130px]",
              cell: (line) => (
                <div className="space-y-1">
                  <p className="font-mono text-[10px] text-[#667085]">
                    {line.expected_location ?? "—"} → {line.shelf_location_label ?? "—"}
                  </p>
                  {line.location_status ? (
                    <LocationStatusPill status={line.location_status} />
                  ) : (
                    <AiPill tone="grey">N/A</AiPill>
                  )}
                </div>
              ),
            },
            ...(showPromo
              ? [{ key: "promo", header: "Promotion", className: "min-w-[150px]", cell: promoCell }]
              : []),
          ]}
        />

        {match.not_on_document.length ? (
          <div className="mt-4 rounded-xl border border-[#D9E2E8]">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-[#04203F]"
              onClick={() => setShowExtra((v) => !v)}
              aria-expanded={showExtra}
            >
              <span>
                Not on this document ({match.not_on_document.length} product
                {match.not_on_document.length === 1 ? "" : "s"} on shelf)
              </span>
              <ChevronDown className={cn("size-4 transition-transform", showExtra && "rotate-180")} />
            </button>
            {showExtra ? (
              <ul className="divide-y divide-[#D9E2E8] border-t border-[#D9E2E8] text-xs">
                {match.not_on_document.map((row, i) => (
                  <li key={`${row.product_name}-${i}`} className="flex flex-wrap items-center gap-3 px-4 py-2">
                    <span className="font-medium text-[#04203F]">
                      {lineName([row.brand, row.product_name, row.variant])}
                    </span>
                    {row.shelf_location_label ? (
                      <span className="font-mono text-[10px] text-[#667085]">{row.shelf_location_label}</span>
                    ) : null}
                    <span className="text-[#667085]">
                      {countPending || row.shelf_units == null ? "Units pending" : `${row.shelf_units} units`}
                    </span>
                    {priceText(row.visible_price) ? (
                      <span className="text-[#667085]">{priceText(row.visible_price)}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </AiAuditCard>
    </div>
  );
}
