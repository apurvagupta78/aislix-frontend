/** Per-section CSV downloads for AI audit result cards. */

import { downloadCsvFile } from "@/lib/kpi-details-csv";

function escapeCell(value: unknown): string {
  let text = value === undefined || value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadSectionCsv(
  scanId: string,
  sectionSlug: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): void {
  const lines = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ];
  const slug = sectionSlug.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
  downloadCsvFile(`aislix-${scanId || "audit"}-${slug}.csv`, lines.join("\n"));
}

export function downloadKeyValueCsv(
  scanId: string,
  sectionSlug: string,
  pairs: Array<{ label: string; value: string | number | null | undefined }>,
): void {
  downloadSectionCsv(
    scanId,
    sectionSlug,
    ["Metric", "Value"],
    pairs.map((p) => [p.label, p.value]),
  );
}
