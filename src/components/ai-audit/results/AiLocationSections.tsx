import type { ReactNode } from "react";
import { AiAuditMetricTable } from "@/components/ai-audit/results/AiAuditMetricTable";
import { AiAuditCard } from "@/components/ai-audit/results/AiAuditUi";
import type { AstraLocationAnalysis, AstraLocationRow } from "@/lib/ai-audit/astra-response";
import { AISLIX_PALETTE, ACCENT_TINT } from "@/lib/ai-audit/kpi-palette";
import { downloadSectionCsv } from "@/lib/ai-audit/section-csv";
import { cn } from "@/lib/utils";

type PillTone = "grey" | "pink" | "green" | "blue";

const PILL_STYLE: Record<PillTone, { background: string; color: string; borderColor: string }> = {
  grey: { background: AISLIX_PALETTE.grey, color: AISLIX_PALETTE.secondary, borderColor: AISLIX_PALETTE.border },
  pink: { background: AISLIX_PALETTE.pink, color: AISLIX_PALETTE.navy, borderColor: "#F6CFDC" },
  green: { background: ACCENT_TINT.green, color: AISLIX_PALETTE.navy, borderColor: AISLIX_PALETTE.green },
  blue: { background: ACCENT_TINT.blue, color: AISLIX_PALETTE.navy, borderColor: AISLIX_PALETTE.blue },
};

export function AiPill({
  tone,
  children,
  mono,
  className,
}: {
  tone: PillTone;
  children: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium",
        mono && "font-mono tracking-tight",
        className,
      )}
      style={PILL_STYLE[tone]}
    >
      {children}
    </span>
  );
}

export function formatShelfPrice(price: string | null | undefined): string | null {
  const text = (price ?? "").trim();
  if (!text) return null;
  return /^\d/.test(text) ? `₹${text}` : text;
}

/** Shelf-edge label as read by Astra; partial reads keep their '?' and get a grey PARTIAL pill. */
export function LocationLabelCell({ label, status }: { label: string | null; status?: string }) {
  if (!label) return <AiPill tone="grey">Not readable</AiPill>;
  const partial = status === "PARTIAL" || label.includes("?");
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-[11px] text-[#102A43]">{label}</span>
      {partial ? <AiPill tone="grey">PARTIAL</AiPill> : null}
    </span>
  );
}

export function ShelfPriceCell({ price }: { price: string | null }) {
  const formatted = formatShelfPrice(price);
  return formatted ? <span>{formatted}</span> : <AiPill tone="grey">Not readable</AiPill>;
}

const LOCATION_STATUS: Record<string, { label: string; tone: PillTone }> = {
  CORRECT: { label: "Correct bin", tone: "green" },
  WRONG_LOCATION: { label: "Wrong bin", tone: "pink" },
  NOT_READABLE: { label: "Not readable", tone: "grey" },
  EXPECTED_NOT_IN_PHOTO: { label: "Bin not in photo", tone: "grey" },
  NO_EXPECTED: { label: "N/A", tone: "grey" },
};

export function LocationStatusPill({ status }: { status: string }) {
  const entry = LOCATION_STATUS[status] ?? { label: "N/A", tone: "grey" as const };
  return <AiPill tone={entry.tone}>{entry.label}</AiPill>;
}

export function locationStatusLabel(status: string): string {
  return LOCATION_STATUS[status]?.label ?? "N/A";
}

const PRICE_STATUS: Record<string, { label: string; tone: PillTone }> = {
  MATCH: { label: "Match", tone: "green" },
  MISMATCH: { label: "Mismatch", tone: "pink" },
  NOT_READABLE: { label: "Not readable", tone: "grey" },
  NO_EXPECTED: { label: "N/A", tone: "grey" },
};

export function PriceStatusPill({ status, difference }: { status: string; difference?: number | null }) {
  const entry = PRICE_STATUS[status] ?? { label: "N/A", tone: "grey" as const };
  const suffix =
    status === "MISMATCH" && difference != null && difference !== 0
      ? ` ${difference > 0 ? "+" : "−"}₹${Math.abs(difference)}`
      : "";
  return (
    <AiPill tone={entry.tone}>
      {entry.label}
      {suffix}
    </AiPill>
  );
}

export function priceStatusLabel(status: string): string {
  return PRICE_STATUS[status]?.label ?? "N/A";
}

/** "By location" + "Empty labelled locations" — only rendered when Astra read at least one shelf-edge label. */
export function AiLocationCards({
  scanId,
  locationAnalysis,
}: {
  scanId: string;
  locationAnalysis: AstraLocationAnalysis | undefined;
}) {
  if (!locationAnalysis?.locations.length) return null;
  const { locations, empty_locations: empty } = locationAnalysis;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <AiAuditCard
        title="By location"
        description="Products and facings per shelf-edge label"
        csvDownload={{
          onDownload: () =>
            downloadSectionCsv(
              scanId,
              "by-location",
              ["Location", "Rack", "Products", "Total Facings", "Visible units", "Label read"],
              locations.map((row) => [
                row.label,
                row.rack_marker ?? "N/A",
                row.products,
                row.facings,
                row.visible_units,
                row.label_status || "READ",
              ]),
            ),
        }}
      >
        <AiAuditMetricTable
          rows={locations}
          rowKey={(row) => row.label}
          columns={[
            {
              key: "l",
              header: "Location",
              cell: (row: AstraLocationRow) => <LocationLabelCell label={row.label} status={row.label_status} />,
            },
            { key: "r", header: "Rack", cell: (row) => row.rack_marker ?? "—" },
            { key: "p", header: "Products", cell: (row) => row.products },
            {
              key: "f",
              header: "Total Facings",
              cell: (row) => (row.empty ? <AiPill tone="pink">Empty</AiPill> : row.facings),
            },
          ]}
        />
      </AiAuditCard>
      <AiAuditCard title="Empty labelled locations" description="Labels read with no product above them">
        {empty.length ? (
          <ul className="space-y-3">
            {empty.map((row) => (
              <li key={row.label} className="flex flex-wrap items-center gap-3 text-sm text-[#102A43]">
                <AiPill tone="pink" mono className="px-3 py-1 text-xs">
                  {row.label}
                </AiPill>
                <span className="text-[#667085]">
                  {row.rack_marker ? `Rack ${row.rack_marker} · ` : ""}Possible out of stock
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Every labelled location read in this photo has product above it.</p>
        )}
        <p className="mt-4 text-[11px] text-muted-foreground">Read from shelf-edge labels · QR codes not decoded</p>
      </AiAuditCard>
    </div>
  );
}
