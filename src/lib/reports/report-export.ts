/**
 * Report center exports built from the same ReportDocument shown on screen.
 */

import * as XLSX from "xlsx";
import { accentHex } from "@/lib/ai-audit/kpi-palette";
import { downloadBlobBytes } from "@/lib/scan-results";
import { reportDate, type ReportDocument } from "@/lib/reports/report-document";

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function reportFileName(doc: ReportDocument, ext: string): string {
  const day = new Date(doc.generatedAt).toISOString().slice(0, 10);
  return `aislix-${slug(doc.title)}-${day}.${ext}`;
}

function sheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[\\/?*[\]:]/g, " ").slice(0, 28).trim() || "Sheet";
  let out = base;
  for (let i = 2; used.has(out); i += 1) out = `${base.slice(0, 26)} ${i}`;
  used.add(out);
  return out;
}

export function buildReportWorkbook(doc: ReportDocument): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  const summary: string[][] = [
    [`Aislix · ${doc.title}`],
    [doc.subtitle],
    [doc.question],
    [doc.labeledDemo ? "Demo data" : "Your workspace data"],
    [doc.provenance],
    [`Generated ${reportDate(doc.generatedAt, true)}`],
    [],
    [doc.empty ? doc.emptyMessage : (doc.headline ?? "")],
    [],
    ["Measure", "Value", "Context"],
    ...doc.kpis.map((k) => [k.label, k.value, k.context]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), sheetName("Summary", used));
  for (const table of doc.tables) {
    const rows = [table.columns, ...table.rows];
    if (table.note) rows.push([], [table.note]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName(table.title, used));
  }
  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

export function downloadReportExcel(doc: ReportDocument): void {
  downloadBlobBytes(
    buildReportWorkbook(doc),
    reportFileName(doc, "xlsx"),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Print-ready HTML for "Save as PDF". All values are escaped; images must be https signed URLs. */
export function buildReportPrintHtml(doc: ReportDocument): string {
  const kpis = doc.kpis
    .map(
      (k) => `<div class="kpi" style="border-left-color:${accentHex(k.accent)}">
  <div class="kpi-label">${esc(k.label)}</div>
  <div class="kpi-value${k.unavailable ? " na" : ""}">${esc(k.value)}</div>
  <div class="kpi-context">${esc(k.context)}</div>
</div>`,
    )
    .join("");
  const tables = doc.tables
    .filter((t) => t.rows.length)
    .map(
      (t) => `<section><h2>${esc(t.title)}</h2>
<table><thead><tr>${t.columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
<tbody>${t.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>
${t.note ? `<p class="note">${esc(t.note)}</p>` : ""}</section>`,
    )
    .join("");
  const photos = doc.photos
    .map((p) => ({ ...p, src: safeImageUrl(p.url) }))
    .filter((p) => p.src)
    .map(
      (p) => `<figure><img src="${esc(p.src)}" alt="${esc(`Shelf photo at ${p.storeName}`)}" />
<figcaption><strong>${esc(p.storeName)}</strong><br />${esc(p.takenAt)} · ${esc(p.capturedBy)}<br />${esc(p.location)}</figcaption></figure>`,
    )
    .join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${esc(`Aislix · ${doc.title}`)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Inter, Arial, sans-serif; color: #04203F; margin: 32px; }
  .brand { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #667085; }
  h1 { font-size: 22px; margin: 6px 0 4px; }
  .sub { color: #667085; font-size: 13px; margin: 0; }
  .tags { margin: 10px 0 0; font-size: 11px; color: #667085; }
  .tag { display: inline-block; border: 1px solid #D9E2E8; border-radius: 999px; padding: 2px 8px; margin-right: 6px; }
  .demo { background: #EEF1F4; font-weight: 600; text-transform: uppercase; }
  .headline { margin: 16px 0; padding: 10px 12px; border: 1px solid #D9E2E8; border-radius: 10px; background: #F4F7F9; font-size: 13px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .kpi { border: 1px solid #D9E2E8; border-left-width: 3px; border-radius: 10px; padding: 10px 12px; }
  .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #667085; }
  .kpi-value { font-size: 20px; font-weight: 600; margin-top: 4px; }
  .kpi-value.na { color: #667085; }
  .kpi-context { font-size: 11px; color: #557187; margin-top: 2px; }
  section { margin-top: 20px; break-inside: auto; }
  h2 { font-size: 14px; margin: 0 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; color: #667085; font-weight: 500; border-bottom: 1px solid #D9E2E8; padding: 6px; }
  td { border-bottom: 1px solid #EEF1F4; padding: 6px; vertical-align: top; }
  tr { break-inside: avoid; }
  .note { font-size: 11px; color: #667085; }
  .photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  figure { margin: 0; border: 1px solid #D9E2E8; border-radius: 10px; overflow: hidden; break-inside: avoid; }
  figure img { width: 100%; height: 160px; object-fit: cover; display: block; background: #EEF1F4; }
  figcaption { font-size: 10px; padding: 6px 8px; color: #04203F; }
  footer { margin-top: 24px; font-size: 10px; color: #667085; border-top: 1px solid #D9E2E8; padding-top: 8px; }
  @page { margin: 14mm; }
  @media print { body { margin: 0; } }
</style></head>
<body>
  <div class="brand">Aislix report</div>
  <h1>${esc(doc.title)}</h1>
  <p class="sub">${esc(doc.subtitle)}</p>
  <p class="sub">${esc(doc.question)}</p>
  <div class="tags">${doc.labeledDemo ? '<span class="tag demo">Demo data</span>' : ""}<span class="tag">${esc(doc.provenance)}</span></div>
  ${doc.empty ? `<p class="headline">${esc(doc.emptyMessage)}</p>` : `${doc.headline ? `<p class="headline">${esc(doc.headline)}</p>` : ""}<div class="kpis">${kpis}</div>${tables}`}
  ${!doc.empty && photos ? `<section><h2>Shelf photos</h2><div class="photos">${photos}</div></section>` : ""}
  <footer>Generated by Aislix on ${esc(reportDate(doc.generatedAt, true))} (India time).</footer>
</body></html>`;
}

/** Opens the print view; the browser's "Save as PDF" turns it into the PDF report. */
export function openPrintableReport(doc: ReportDocument): boolean {
  const html = buildReportPrintHtml(doc);
  const win = window.open("", "_blank");
  if (win) {
    win.opener = null;
    writeAndPrint(win, html);
    return true;
  }
  return printInFrame(html);
}

/** Pop-ups are often blocked in installed apps and phone browsers, so print from a hidden frame instead. */
function printInFrame(html: string): boolean {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const win = frame.contentWindow;
  if (!win) {
    frame.remove();
    return false;
  }
  const cleanup = () => setTimeout(() => frame.remove(), 1000);
  win.addEventListener("afterprint", cleanup, { once: true });
  setTimeout(() => frame.isConnected && frame.remove(), 120_000);
  writeAndPrint(win, html);
  return true;
}

function writeAndPrint(win: Window, html: string): void {
  win.document.open();
  win.document.write(html);
  win.document.close();
  const print = () => {
    win.focus();
    win.print();
  };
  const images = Array.from(win.document.images);
  if (!images.length) {
    setTimeout(print, 150);
    return;
  }
  let pending = images.length;
  const done = () => {
    pending -= 1;
    if (pending === 0) print();
  };
  for (const img of images) {
    if (img.complete) done();
    else {
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    }
  }
  setTimeout(() => {
    if (pending > 0) {
      pending = 0;
      print();
    }
  }, 8000);
}
