import type { ReactNode } from "react";
import { Download, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadSectionCsv } from "@/lib/ai-audit/section-csv";
import { cn } from "@/lib/utils";

export function AiAuditCard({
  title,
  description,
  action,
  children,
  className,
  csvDownload,
  headerClassName,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  csvDownload?: { onDownload: () => void } | null;
  headerClassName?: string;
}) {
  function handleCsv() {
    try {
      csvDownload?.onDownload();
      toast.success("CSV downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download CSV.");
    }
  }

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-3",
          headerClassName,
        )}
      >
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {csvDownload ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-lg bg-white/80 text-[11px]"
              onClick={handleCsv}
            >
              <Download className="size-3.5" /> Download CSV
            </Button>
          ) : null}
          {action}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function AiMetricStat({
  label,
  value,
  sub,
  status,
  bg,
}: {
  label: string;
  value: string | number;
  sub?: string;
  status?: string | null;
  bg?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-black/5 px-3 py-3 shadow-sm",
        !bg && "bg-muted/20",
      )}
      style={bg ? { background: bg } : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-navy/60">{label}</p>
        {status ? (
          <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-navy/70">
            {status}
          </span>
        ) : null}
      </div>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-navy">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-navy/55">{sub}</p> : null}
    </div>
  );
}

/** Compact mode strip — no duplicate scan meta (that lives in ScanResultHeader). */
export function AiResultsHero({
  modeLabel,
  operatingModel,
}: {
  scanId?: string;
  modeLabel: string;
  operatingModel?: string;
  timestamp?: string;
  category?: string | null;
  subCategory?: string | null;
  location?: string | null;
  store?: string | null;
  processingTimeMs?: number | null;
  averageConfidence?: number | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#D9E2E8] bg-white px-3 py-2.5">
      <Badge className="gap-1 rounded-full bg-[#F3EFFB] text-[#102A43]">
        <Sparkles className="size-3" /> AI Audit
      </Badge>
      <Badge variant="outline">{modeLabel}</Badge>
      {operatingModel ? <Badge variant="secondary">{operatingModel}</Badge> : null}
    </div>
  );
}

type SummaryBlock =
  | { kind: "heading"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "paragraph"; text: string };

function parseExecutiveSummary(raw: string): SummaryBlock[] {
  const normalized = raw
    .replace(/\r\n/g, "\n")
    .replace(/\u2022/g, "•")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .trim();
  if (!normalized) return [];

  const lines = normalized
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const blocks: SummaryBlock[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length) {
      blocks.push({ kind: "bullets", items: bullets });
      bullets = [];
    }
  };

  const isBullet = (line: string) => /^([•\-\*]|\d+[.)])\s+/.test(line);
  const stripBullet = (line: string) => line.replace(/^([•\-\*]|\d+[.)])\s+/, "").trim();
  const isMdHeading = (line: string) => /^#{1,3}\s+/.test(line);
  const stripMdHeading = (line: string) => line.replace(/^#{1,3}\s+/, "").replace(/:$/, "").trim();

  for (const line of lines) {
    if (isMdHeading(line)) {
      flushBullets();
      blocks.push({ kind: "heading", text: stripMdHeading(line) });
      continue;
    }
    if (isBullet(line)) {
      bullets.push(stripBullet(line));
      continue;
    }
    if (/^[^:]{2,48}:\s+.+$/.test(line) && !line.includes(". ")) {
      bullets.push(line);
      continue;
    }
    flushBullets();
    if (
      (/^[A-Z][A-Za-z0-9 /&-]{2,60}:$/.test(line) ||
        (/^[A-Z][A-Za-z0-9 /&-]{2,48}$/.test(line) && line === line.toUpperCase())) &&
      line.length < 60
    ) {
      blocks.push({ kind: "heading", text: line.replace(/:$/, "") });
      continue;
    }
    if (line.length > 160 && (line.match(/\.\s+[A-Z]/g)?.length ?? 0) >= 2) {
      const parts = line
        .split(/(?<=\.)\s+(?=[A-Z])/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 3) {
        blocks.push({ kind: "bullets", items: parts });
        continue;
      }
    }
    blocks.push({ kind: "paragraph", text: line });
  }
  flushBullets();

  if (blocks.length === 1 && blocks[0]?.kind === "paragraph") {
    const text = blocks[0].text;
    const parts = text
      .split(/(?<=\.)\s+(?=[A-Z•\-\d])/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      return [{ kind: "bullets", items: parts }];
    }
  }

  return blocks;
}

export function AiExecutiveSummary({
  text,
  scanId = "audit",
}: {
  text?: string | null;
  scanId?: string;
}) {
  if (!text?.trim()) return null;
  const blocks = parseExecutiveSummary(text);

  return (
    <AiAuditCard
      title="Executive summary"
      description="Key findings from this shelf audit"
      headerClassName="bg-[#F3EFFB]"
      csvDownload={{
        onDownload: () => {
          const rows: Array<[string, string]> = [];
          for (const block of blocks) {
            if (block.kind === "heading") rows.push(["Section", block.text]);
            if (block.kind === "paragraph") rows.push(["Summary", block.text]);
            if (block.kind === "bullets") {
              for (const item of block.items) rows.push(["Finding", item]);
            }
          }
          downloadSectionCsv(scanId, "executive-summary", ["Type", "Text"], rows);
        },
      }}
    >
      <div className="space-y-4 text-sm leading-relaxed text-foreground">
        {blocks.map((block, i) => {
          if (block.kind === "heading") {
            return (
              <h4
                key={i}
                className="rounded-md bg-[#EEF6FA] px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-[#102A43]"
              >
                {block.text}
              </h4>
            );
          }
          if (block.kind === "bullets") {
            return (
              <ul key={i} className="list-disc space-y-2 pl-5 marker:text-[#9B86D9]">
                {block.items.map((item, j) => (
                  <li key={j} className="pl-1">
                    {item}
                  </li>
                ))}
              </ul>
            );
          }
          return (
            <p key={i} className="text-foreground/90">
              {block.text}
            </p>
          );
        })}
      </div>
    </AiAuditCard>
  );
}

/** Shows the original shelf photo the AI analysed, as audit evidence. */
export function AiEvidencePanel({ imageUrl }: { imageUrl: string | null | undefined }) {
  if (!imageUrl) return null;
  return (
    <AiAuditCard title="Shelf photo" description="Original image used for this analysis.">
      <div className="overflow-hidden rounded-xl border border-border bg-muted">
        <img
          src={imageUrl}
          alt="Shelf photo evidence"
          className="mx-auto max-h-[480px] w-full object-contain"
          loading="lazy"
        />
      </div>
    </AiAuditCard>
  );
}
