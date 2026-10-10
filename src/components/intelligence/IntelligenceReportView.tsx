import { useMemo } from "react";
import { Copy, Download, FileText, Image as ImageIcon, RotateCcw, Sheet as SheetIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { hideModelNames } from "@/lib/ai-display-text";
import { AISLIX_PALETTE } from "@/lib/ai-audit/kpi-palette";
import {
  ATTACHMENT_KIND_LABEL,
  ATTACHMENT_TYPES,
  INTELLIGENCE_ATTACHMENT_BUCKET,
  attachmentExtension,
  formatBytes,
  type IntelligenceAttachment,
} from "@/lib/intelligence/attachments";
import type { IntelligenceReport } from "@/lib/intelligence/intelligence.functions";
import { boldRuns, plainText, reportBlocks, reportPdf, type ReportBlock } from "@/lib/intelligence/report-format";
import { downloadBlobBytes } from "@/lib/scan-results";
import { chartAccents, formatChartValue, IntelligenceChartCard } from "@/components/intelligence/IntelligenceChartCard";

type Section = { title: string | null; blocks: ReportBlock[] };

const SECTION_DOT: Array<[RegExp, string]> = [
  [/insight/i, AISLIX_PALETTE.purple],
  [/trend|compar/i, AISLIX_PALETTE.blue],
  [/risk|opportunit/i, AISLIX_PALETTE.pink],
  [/action|recommend/i, AISLIX_PALETTE.green],
  [/limitation/i, AISLIX_PALETTE.grey],
];

function cleanTitle(text: string): string {
  return text.replace(/^\d+[.)]\s*/, "").trim();
}

function toSections(blocks: ReportBlock[]): Section[] {
  const sections: Section[] = [];
  let current: Section = { title: null, blocks: [] };
  for (const b of blocks) {
    if (b.kind === "heading" && b.level <= 2) {
      if (current.title || current.blocks.length) sections.push(current);
      current = { title: cleanTitle(b.text), blocks: [] };
      continue;
    }
    current.blocks.push(b);
  }
  if (current.title || current.blocks.length) sections.push(current);
  return sections;
}

export function formatReportTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function AttachmentIcon({ name, className }: { name: string; className?: string }) {
  const kind = ATTACHMENT_TYPES[attachmentExtension(name)]?.kind;
  if (kind === "image") return <ImageIcon className={className} />;
  if (kind === "csv" || kind === "xlsx") return <SheetIcon className={className} />;
  return <FileText className={className} />;
}

async function downloadAttachment(a: IntelligenceAttachment) {
  const { data, error } = await supabase.storage.from(INTELLIGENCE_ATTACHMENT_BUCKET).download(a.path);
  if (error || !data) {
    toast.error("Could not download this file.");
    return;
  }
  const mime = ATTACHMENT_TYPES[attachmentExtension(a.name)]?.mime ?? "application/octet-stream";
  downloadBlobBytes(new Uint8Array(await data.arrayBuffer()), a.name, mime);
}

export function IntelligenceReportView({
  report,
  onAskAnother,
}: {
  report: IntelligenceReport;
  onAskAnother: () => void;
}) {
  const text = hideModelNames(report.report);
  const sections = useMemo(() => toSections(reportBlocks(text)), [text]);
  const accents = useMemo(() => chartAccents(report.charts), [report.charts]);
  const summaryIndex = sections.findIndex((s) => s.title && /summary/i.test(s.title));
  const summary = summaryIndex >= 0 ? sections[summaryIndex] : sections[0]?.title === null ? sections[0] : undefined;
  const rest = sections.filter((s) => s !== summary);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Report copied");
    } catch {
      toast.error("Could not copy. Select the text and copy it instead.");
    }
  };

  const pdf = () => {
    const meta = [
      `Question: ${report.question}`,
      `${plural(report.audits.length, "audit")} · ${plural(report.attachments.length, "file")} · ${formatReportTime(report.created_at)}`,
      ...report.audits.map(
        (a, i) => `${i + 1}. ${a.label}${a.code ? ` [${a.code}]` : ""} (${a.mode === "digital" ? "Digital" : "AI"} audit, ${a.date})`,
      ),
      ...report.attachments.map((a) => `File: ${a.name}`),
    ];
    const chartText = report.charts
      .map((c) =>
        [
          `## ${c.title}`,
          c.caption ?? "",
          ...c.data.map((d) =>
            c.type === "stacked_bar"
              ? `- ${d.label}: ${c.series.map((s) => `${s.label} ${formatChartValue(Number(d[s.key] ?? 0), c.unit)}`).join(", ")}`
              : `- ${d.label}: ${formatChartValue(Number(d.value ?? 0), c.unit)}`,
          ),
        ].join("\n"),
      )
      .join("\n\n");
    const body = chartText ? `${text}\n\n# Charts\n\n${chartText}` : text;
    downloadBlobBytes(
      reportPdf("Aislix Intelligence report", meta, body),
      `aislix-intelligence-${report.created_at.slice(0, 10)}.pdf`,
      "application/pdf",
    );
    toast.success("PDF downloaded");
  };

  return (
    <article className="space-y-4">
      <header className="rounded-xl border border-[#D9E2E8] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 basis-64">
            <p className="text-xs text-[#667085]">
              AI analysis · {plural(report.audits.length, "audit")}
              {report.attachments.length ? ` · ${plural(report.attachments.length, "file")}` : ""} ·{" "}
              {formatReportTime(report.created_at)}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#04203F]">{report.question}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => void copy()}>
              <Copy className="size-4" /> Copy
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={pdf}>
              <Download className="size-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={onAskAnother}>
              <RotateCcw className="size-4" /> New question
            </Button>
          </div>
        </div>
        {report.audits.length || report.attachments.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {report.audits.map((a) => (
              <span
                key={a.id}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#D9E2E8] px-2 py-0.5 text-[11px] text-[#667085]"
                title={[a.label, a.code, a.date].filter(Boolean).join(" · ")}
              >
                <span
                  aria-hidden
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: a.mode === "digital" ? "#7DB7D6" : "#9B86D9" }}
                />
                <span className="truncate">{a.label}</span>
                {a.code ? <span className="shrink-0 font-mono">{a.code}</span> : null}
              </span>
            ))}
            {report.attachments.map((a) => (
              <button
                key={a.path}
                type="button"
                onClick={() => void downloadAttachment(a)}
                title={`Download ${a.name}`}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#D9E2E8] px-2 py-0.5 text-[11px] text-[#667085] transition-colors duration-150 hover:border-[#04203F] hover:text-[#04203F]"
              >
                <AttachmentIcon name={a.name} className="size-3 shrink-0" />
                <span className="truncate">{a.name}</span>
                <span className="shrink-0">
                  {ATTACHMENT_KIND_LABEL[a.kind]} · {formatBytes(a.size)}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </header>

      {summary ? (
        <section className="rounded-xl border border-[#D9E2E8] bg-white p-4 sm:p-5">
          <h3 className="text-base font-semibold text-[#04203F]">{summary.title ?? "Summary"}</h3>
          <div className="mt-2 space-y-2.5 text-sm leading-relaxed text-[#04203F]">
            {summary.blocks.map((b, i) => (
              <ReportBlockView key={i} block={b} />
            ))}
          </div>
        </section>
      ) : null}

      {report.charts.length ? (
        <section aria-label="Charts" className="grid gap-4 md:grid-cols-2">
          {report.charts.map((c, i) => (
            <IntelligenceChartCard key={c.id} chart={c} accent={accents[i] ?? null} />
          ))}
        </section>
      ) : null}

      {rest.map((s, i) => {
        const dot = SECTION_DOT.find(([re]) => s.title && re.test(s.title))?.[1];
        return (
          <section key={i} className="rounded-xl border border-[#D9E2E8] bg-white p-4 sm:p-5">
            {s.title ? (
              <h3 className="flex items-center gap-2 text-base font-semibold text-[#04203F]">
                {dot ? (
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full"
                    style={{ background: dot, boxShadow: dot === AISLIX_PALETTE.pink ? "0 0 0 1px #ECBDCC" : undefined }}
                  />
                ) : null}
                {s.title}
              </h3>
            ) : null}
            <div className="mt-2 space-y-2.5 text-sm leading-relaxed text-[#04203F]">
              {s.blocks.map((b, j) => (
                <ReportBlockView key={j} block={b} />
              ))}
            </div>
          </section>
        );
      })}

      <p className="px-1 text-xs text-[#667085]">
        AI analysis of the selected audits{report.attachments.length ? " and attached files" : ""}. Charts are drawn by
        Aislix from stored audit data. Check important figures before acting.
      </p>
    </article>
  );
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {boldRuns(text).map((r, i) =>
        r.bold ? (
          <strong key={i} className="font-semibold">
            {r.text}
          </strong>
        ) : (
          <span key={i}>{r.text}</span>
        ),
      )}
    </>
  );
}

function ReportBlockView({ block }: { block: ReportBlock }) {
  if (block.kind === "heading") {
    return <h4 className="pt-1 text-sm font-semibold">{block.text}</h4>;
  }
  if (block.kind === "paragraph") {
    return (
      <p>
        <Inline text={block.text} />
      </p>
    );
  }
  if (block.kind === "item") {
    return (
      <div className="flex gap-2" style={{ paddingLeft: `${block.depth * 16}px` }}>
        <span className="shrink-0 tabular-nums text-[#667085]">{block.marker}</span>
        <span className="min-w-0">
          <Inline text={block.text} />
        </span>
      </div>
    );
  }
  const [head, ...body] = block.rows;
  return (
    <div className="overflow-x-auto rounded-lg border border-[#D9E2E8]">
      <table className="w-full min-w-[480px] text-left text-xs">
        {head ? (
          <thead className="bg-[#F4F7F9] text-[#667085]">
            <tr>
              {head.map((c, i) => (
                <th key={i} className="px-3 py-2 font-medium">
                  {plainText(c)}
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody className="divide-y divide-[#EEF1F4]">
          {body.map((row, r) => (
            <tr key={r}>
              {row.map((c, i) => (
                <td key={i} className="px-3 py-2 align-top">
                  <Inline text={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
