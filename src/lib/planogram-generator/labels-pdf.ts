/**
 * Printable shelf labels: A4 sheets of 2 x 4 labels, each with a vector QR code, the location ID,
 * the physical position and the products that belong in that space.
 */

import { assemblePdf, escapePdf, pdfSafe } from "@/lib/intelligence/report-format";
import { encodeQr } from "@/lib/qr/qr-code";

export type LabelSpace = {
  locationCode: string;
  position: string;
  url: string;
  products: Array<{ name: string; brand: string; facings: number | null }>;
};

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 28;
const GAP = 12;
const COLS = 2;
const ROWS = 4;
const LABEL_W = (PAGE_W - MARGIN * 2 - GAP * (COLS - 1)) / COLS;
const LABEL_H = (PAGE_H - MARGIN * 2 - GAP * (ROWS - 1)) / ROWS;
const PAD = 12;
const QR_SIZE = 96;
const QUIET = 2;

const NAVY = "0.016 0.125 0.247";
const GREY = "0.4 0.439 0.522";
const BORDER = "0.851 0.886 0.910";

function fit(text: string, size: number, width: number): string {
  const safe = pdfSafe(text);
  const max = Math.max(4, Math.floor(width / (size * 0.5)));
  return safe.length > max ? `${safe.slice(0, max - 3).trimEnd()}...` : safe;
}

function textOp(text: string, x: number, y: number, size: number, bold: boolean, color: string): string {
  return `${color} rg BT /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${escapePdf(text)}) Tj ET`;
}

function qrOps(url: string, x: number, top: number): string {
  const matrix = encodeQr(url);
  const modules = matrix.length + QUIET * 2;
  const m = QR_SIZE / modules;
  const rects: string[] = [];
  matrix.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (!dark) return;
      const rx = x + (c + QUIET) * m;
      const ry = top - (r + QUIET + 1) * m;
      rects.push(`${rx.toFixed(2)} ${ry.toFixed(2)} ${m.toFixed(3)} ${m.toFixed(3)} re`);
    }),
  );
  return `0 0 0 rg\n${rects.join("\n")}\nf`;
}

function labelOps(space: LabelSpace, storeName: string, x: number, top: number): string[] {
  const ops: string[] = [];
  ops.push(`${BORDER} RG 0.8 w ${x.toFixed(1)} ${(top - LABEL_H).toFixed(1)} ${LABEL_W.toFixed(1)} ${LABEL_H.toFixed(1)} re S`);
  ops.push(qrOps(space.url, x + PAD - 4, top - PAD + 4));

  const tx = x + PAD + QR_SIZE;
  const tw = LABEL_W - PAD * 2 - QR_SIZE + 4;
  let ty = top - PAD - 12;
  ops.push(textOp(fit(space.locationCode, 12, tw), tx, ty, 12, true, NAVY));
  ty -= 15;
  ops.push(textOp(fit(space.position.replace(/→/g, ">"), 8.5, tw), tx, ty, 8.5, false, GREY));
  ty -= 13;
  ops.push(textOp(fit(storeName, 8.5, tw), tx, ty, 8.5, false, GREY));
  ty -= 22;
  ops.push(textOp(fit("Scan to see what", 8, tw), tx, ty, 8, false, GREY));
  ty -= 10;
  ops.push(textOp(fit("belongs here", 8, tw), tx, ty, 8, false, GREY));

  const listX = x + PAD;
  const listW = LABEL_W - PAD * 2;
  let ly = top - PAD - QR_SIZE - 6;
  const maxLines = Math.floor((ly - (top - LABEL_H + PAD)) / 11);
  const lines = space.products.length
    ? space.products.map((p) => {
        const facings = p.facings ? `${p.facings}x  ` : "";
        const brand = p.brand && !p.name.toLowerCase().includes(p.brand.toLowerCase()) ? `${p.brand} ` : "";
        return `${facings}${brand}${p.name}`;
      })
    : ["Leave this space free"];
  const shown = lines.length > maxLines ? [...lines.slice(0, maxLines - 1), `+ ${lines.length - maxLines + 1} more products`] : lines;
  for (const line of shown) {
    ops.push(textOp(fit(line, 8.5, listW), listX, ly, 8.5, false, NAVY));
    ly -= 11;
  }
  return ops;
}

export function shelfLabelsPdf(storeName: string, spaces: LabelSpace[]): Uint8Array {
  const perPage = COLS * ROWS;
  const pages: string[] = [];
  for (let start = 0; start < spaces.length; start += perPage) {
    const ops: string[] = [];
    spaces.slice(start, start + perPage).forEach((space, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = MARGIN + col * (LABEL_W + GAP);
      const top = PAGE_H - MARGIN - row * (LABEL_H + GAP);
      ops.push(...labelOps(space, storeName, x, top));
    });
    pages.push(ops.join("\n"));
  }
  return assemblePdf(pages.length ? pages : [""]);
}
