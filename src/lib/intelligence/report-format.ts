/** Turns an Intelligence report (Markdown from the AI) into display blocks and a plain PDF. */

export type ReportBlock =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "item"; marker: string; depth: number; text: string }
  | { kind: "table"; rows: string[][] };

const TABLE_DIVIDER = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/;

function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

export function reportBlocks(markdown: string): ReportBlock[] {
  const blocks: ReportBlock[] = [];
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const line = raw.trim();
    if (!line || /^(-{3,}|\*{3,}|_{3,})$/.test(line) || line.startsWith("```")) {
      flush();
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const level = Math.min(3, heading[1]!.length) as 1 | 2 | 3;
      blocks.push({ kind: "heading", level, text: heading[2]!.replace(/\*\*/g, "").trim() });
      continue;
    }
    const boldHeading = /^\*\*(\d+\.\s+[^*]+)\*\*$/.exec(line);
    if (boldHeading) {
      flush();
      blocks.push({ kind: "heading", level: 2, text: boldHeading[1]!.trim() });
      continue;
    }
    if (line.startsWith("|") && TABLE_DIVIDER.test((lines[i + 1] ?? "").trim())) {
      flush();
      const rows = [tableCells(line)];
      i += 1;
      while (i + 1 < lines.length && (lines[i + 1] ?? "").trim().startsWith("|")) {
        i += 1;
        rows.push(tableCells(lines[i] ?? ""));
      }
      blocks.push({ kind: "table", rows });
      continue;
    }
    const item = /^(\s*)([-*•]|\d+[.)])\s+(.*)$/.exec(raw);
    if (item) {
      flush();
      const depth = Math.min(2, Math.floor((item[1] ?? "").replace(/\t/g, "  ").length / 2));
      const marker = /\d/.test(item[2]!) ? item[2]!.replace(")", ".") : "•";
      blocks.push({ kind: "item", marker, depth, text: item[3]!.trim() });
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return blocks;
}

/** Splits `**bold**` runs so the UI can render them. */
export function boldRuns(text: string): Array<{ text: string; bold: boolean }> {
  const runs: Array<{ text: string; bold: boolean }> = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index), bold: false });
    runs.push({ text: m[1]!, bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), bold: false });
  return runs.map((r) => ({ ...r, text: r.text.replace(/\*(\S[^*]*?)\*/g, "$1").replace(/`/g, "") }));
}

export function plainText(text: string): string {
  return boldRuns(text)
    .map((r) => r.text)
    .join("");
}

/* ---------------------------- PDF ---------------------------- */

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 50;

/** Standard PDF fonts only cover Latin-1, so map common symbols and drop the rest. */
function pdfSafe(text: string): string {
  return text
    .replace(/₹/g, "INR ")
    .replace(/[“”„]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[•·]/g, "\u00B7")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/→/g, "->")
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "");
}

function escapePdf(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Helvetica averages ~0.5em per character; good enough for wrapping plain report text. */
function wrap(text: string, size: number, width: number): string[] {
  const maxChars = Math.max(20, Math.floor(width / (size * 0.5)));
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      out.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}

type PdfLine = { text: string; size: number; bold: boolean; x: number; gapBefore: number };

export function reportPdf(title: string, meta: string[], markdown: string): Uint8Array {
  const width = PAGE_W - MARGIN * 2;
  const lines: PdfLine[] = [];
  const push = (text: string, size: number, bold: boolean, indent = 0, gapBefore = 0) => {
    wrap(pdfSafe(text), size, width - indent).forEach((t, i) =>
      lines.push({ text: t, size, bold, x: MARGIN + indent, gapBefore: i === 0 ? gapBefore : 0 }),
    );
  };

  push(title, 16, true);
  for (const m of meta) push(m, 9, false, 0, 2);

  for (const block of reportBlocks(markdown)) {
    if (block.kind === "heading") push(block.text, block.level === 1 ? 14 : 12, true, 0, 12);
    else if (block.kind === "paragraph") push(plainText(block.text), 10, false, 0, 6);
    else if (block.kind === "item") {
      const indent = 12 + block.depth * 14;
      push(`${block.marker} ${plainText(block.text)}`, 10, false, indent, 3);
    } else {
      block.rows.forEach((row, i) => push(row.map(plainText).join("  |  "), 9, i === 0, 0, i === 0 ? 6 : 2));
    }
  }

  const pages: string[] = [];
  let ops: string[] = [];
  let y = PAGE_H - MARGIN;
  const newPage = () => {
    if (ops.length) pages.push(ops.join("\n"));
    ops = [];
    y = PAGE_H - MARGIN;
  };
  for (const line of lines) {
    const lead = line.size * 1.4;
    if (y - line.gapBefore - lead < MARGIN) newPage();
    else y -= line.gapBefore;
    y -= lead;
    ops.push(
      `BT /${line.bold ? "F2" : "F1"} ${line.size} Tf ${line.x} ${y.toFixed(1)} Td (${escapePdf(line.text)}) Tj ET`,
    );
  }
  newPage();

  const fontObjs = 3;
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  const pageIds = pages.map((_, i) => fontObjs + 2 + i * 2);
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  pages.forEach((stream, i) => {
    const pageId = pageIds[i]!;
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${pageId + 1} 0 R ` +
      "/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>";
    objects[pageId + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}
