import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Download, History, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { FilterSearch } from "@/components/design-system";
import { ErrorState, Skeleton } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { hideModelNames } from "@/lib/ai-display-text";
import { requireOrgId } from "@/lib/db/context";
import {
  INTELLIGENCE_MAX_AUDITS,
  INTELLIGENCE_MAX_QUESTION,
  runIntelligenceAnalysis,
  type IntelligenceAuditRef,
  type IntelligenceReport,
} from "@/lib/intelligence/intelligence.functions";
import { boldRuns, plainText, reportBlocks, reportPdf, type ReportBlock } from "@/lib/intelligence/report-format";
import { downloadBlobBytes } from "@/lib/scan-results";
import { cn } from "@/lib/utils";

const DESCRIPTION =
  "Select completed audits, ask a question, and AI turns the audit data into insights and recommended actions.";

export const Route = createFileRoute("/intelligence/")({
  head: () => ({
    meta: [{ title: "Intelligence — Aislix" }, { name: "description", content: DESCRIPTION }],
  }),
  component: IntelligencePage,
});

const EXAMPLE_QUESTIONS = [
  "Which products are frequently out of stock, and what should we do to improve availability?",
  "Compare shelf performance across these stores and explain the biggest gaps.",
  "Analyse brand visibility and share of shelf across these audits.",
  "Where are the planogram compliance issues, and how do we fix them?",
  "Which products have the largest stock variances, and what are the likely causes?",
  "What problems keep recurring across these audits?",
];

type AuditOption = {
  id: string;
  created_at: string;
  mode: "ai" | "digital";
  store: string;
  category: string | null;
  shelf: string | null;
};

type ModeFilter = "all" | "ai" | "digital";

function auditsLabel(n: number): string {
  return `${n} audit${n === 1 ? "" : "s"}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

async function fetchAuditOptions(): Promise<AuditOption[]> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("shelf_scans")
    .select("id, created_at, audit_mode, category, shelf_label, store_id")
    .eq("org_id", orgId)
    .eq("status", "completed")
    .is("parent_scan_id", null)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    id: string;
    created_at: string;
    audit_mode: string | null;
    category: string | null;
    shelf_label: string | null;
    store_id: string | null;
  }>;
  const storeIds = [...new Set(rows.map((r) => r.store_id).filter(Boolean) as string[])];
  const names = new Map<string, string>();
  for (let i = 0; i < storeIds.length; i += 100) {
    const { data: stores } = await supabase.from("stores").select("id, name").in("id", storeIds.slice(i, i + 100));
    for (const s of (stores ?? []) as Array<{ id: string; name: string }>) names.set(s.id, s.name);
  }
  return rows.map((r) => ({
    id: r.id,
    created_at: r.created_at,
    mode: r.audit_mode === "digital" ? "digital" : "ai",
    store: (r.store_id && names.get(r.store_id)) || "Store",
    category: r.category,
    shelf: r.shelf_label,
  }));
}

async function fetchPastReports(): Promise<IntelligenceReport[]> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("intelligence_reports" as never)
    .select("id, question, report, audits, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return ((data ?? []) as IntelligenceReport[]).map((r) => ({
    ...r,
    audits: Array.isArray(r.audits) ? r.audits : [],
  }));
}

function IntelligencePage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<ModeFilter>("all");
  const [report, setReport] = useState<IntelligenceReport | null>(null);

  const audits = useQuery({ queryKey: ["intelligence", "audits"], queryFn: fetchAuditOptions });
  const past = useQuery({ queryKey: ["intelligence", "reports"], queryFn: fetchPastReports });

  const run = useMutation({
    mutationFn: async () => {
      if (!selected.length) throw new Error("Select at least one audit.");
      if (question.trim().length < 5) throw new Error("Write what you would like to analyse.");
      const orgId = await requireOrgId();
      return runIntelligenceAnalysis({ data: { activeOrgId: orgId, scanIds: selected, question: question.trim() } });
    },
    onSuccess: (out) => {
      setReport(out);
      void queryClient.invalidateQueries({ queryKey: ["intelligence", "reports"] });
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() =>
          document.getElementById("intelligence-report")?.scrollIntoView({ behavior: "smooth", block: "start" }),
        );
      }
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "The analysis failed. Try again."),
  });

  const options = audits.data ?? [];
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return options.filter((a) => {
      if (mode !== "all" && a.mode !== mode) return false;
      if (!q) return true;
      return [a.store, a.category, a.shelf, formatDate(a.created_at)].some((v) => v?.toLowerCase().includes(q));
    });
  }, [options, search, mode]);

  const full = selected.length >= INTELLIGENCE_MAX_AUDITS;
  const toggle = (id: string) =>
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= INTELLIGENCE_MAX_AUDITS) {
        toast.info(`You can select up to ${INTELLIGENCE_MAX_AUDITS} audits.`);
        return cur;
      }
      return [...cur, id];
    });

  const openPast = (r: IntelligenceReport) => {
    setReport(r);
    setQuestion(r.question);
    const known = new Set(options.map((a) => a.id));
    setSelected(r.audits.map((a) => a.id).filter((id) => known.has(id)).slice(0, INTELLIGENCE_MAX_AUDITS));
    window.requestAnimationFrame(() =>
      document.getElementById("intelligence-report")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  return (
    <AppShell title="Intelligence" description={DESCRIPTION}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <section aria-labelledby="pick-audits" className="rounded-2xl border border-[#D9E2E8] bg-white p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="pick-audits" className="text-base font-semibold text-[#04203F]">
                1. Select audits
              </h2>
              <span className={cn("text-xs tabular-nums", full ? "font-medium text-[#04203F]" : "text-[#667085]")}>
                {selected.length} of {INTELLIGENCE_MAX_AUDITS} selected
              </span>
            </div>
            <p className="mt-1 text-sm text-[#667085]">Completed AI and Digital audits you can see.</p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <FilterSearch value={search} onChange={setSearch} placeholder="Search store, category or date" />
              <div className="flex rounded-lg border border-[#D9E2E8] p-0.5 text-xs" role="group" aria-label="Audit type">
                {(
                  [
                    ["all", "All"],
                    ["ai", "AI"],
                    ["digital", "Digital"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    aria-pressed={mode === value}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 transition-colors duration-150",
                      mode === value ? "bg-[#F4F7F9] font-medium text-[#04203F]" : "text-[#667085] hover:text-[#04203F]",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {selected.length ? (
              <button
                type="button"
                onClick={() => setSelected([])}
                className="mt-2 text-xs text-[#667085] underline-offset-2 hover:text-[#04203F] hover:underline"
              >
                Clear selection
              </button>
            ) : null}

            <div className="mt-3 max-h-[420px] overflow-y-auto rounded-xl border border-[#D9E2E8]">
              {audits.isLoading ? (
                <div className="space-y-2 p-3">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : audits.isError ? (
                <div className="p-3">
                  <ErrorState onRetry={() => void audits.refetch()} />
                </div>
              ) : !visible.length ? (
                <p className="px-3 py-6 text-center text-sm text-[#667085]">
                  {options.length ? "No audits match your search." : "No completed audits yet. Run an audit first."}
                </p>
              ) : (
                <ul className="divide-y divide-[#EEF1F4]">
                  {visible.map((a) => {
                    const checked = selected.includes(a.id);
                    return (
                      <li key={a.id}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors duration-150 hover:bg-[#F4F7F9]",
                            checked && "bg-[#F4F7F9]",
                            !checked && full && "cursor-not-allowed opacity-60",
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={!checked && full}
                            onCheckedChange={() => toggle(a.id)}
                            className="mt-0.5"
                            aria-label={`Select ${a.store} audit on ${formatDate(a.created_at)}`}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-[#04203F]">{a.store}</span>
                            <span className="block truncate text-xs text-[#667085]">
                              {[a.category, a.shelf].filter(Boolean).join(" · ") || "Audit"} · {formatDate(a.created_at)}
                            </span>
                          </span>
                          <ModePill mode={a.mode} />
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section aria-labelledby="ask-question" className="rounded-2xl border border-[#D9E2E8] bg-white p-4 sm:p-5">
            <h2 id="ask-question" className="text-base font-semibold text-[#04203F]">
              2. What would you like to analyse?
            </h2>
            <Textarea
              value={question}
              maxLength={INTELLIGENCE_MAX_QUESTION}
              onChange={(e) => setQuestion(e.target.value)}
              rows={4}
              className="mt-3 resize-y rounded-xl"
              placeholder="e.g. Analyse these audits to identify which products are frequently out of stock and recommend actions to improve availability."
              aria-label="What would you like to analyse?"
            />
            <p className="mt-2 text-xs text-[#667085]">Try one of these:</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuestion(q)}
                  className="rounded-full border border-[#D9E2E8] bg-white px-2.5 py-1 text-left text-xs text-[#04203F] transition-colors duration-150 hover:border-[#04203F]"
                >
                  {q}
                </button>
              ))}
            </div>
            <Button
              variant="brand"
              className="mt-4 h-11 w-full rounded-xl"
              disabled={!selected.length || question.trim().length < 5 || run.isPending}
              onClick={() => run.mutate()}
            >
              {run.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> {`Analysing ${auditsLabel(selected.length)}…`}
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> {selected.length ? `Analyse ${auditsLabel(selected.length)}` : "Analyse audits"}
                </>
              )}
            </Button>
            <p className="mt-2 text-xs text-[#667085]">An analysis can take up to two minutes.</p>
          </section>
        </div>

        <div className="min-w-0 space-y-4">
          <section id="intelligence-report" aria-label="Report" className="scroll-mt-20">
            {run.isPending ? (
              <div className="rounded-2xl border border-[#D9E2E8] bg-white p-5" aria-busy="true">
                <p className="flex items-center gap-2 text-sm font-medium text-[#04203F]">
                  <Loader2 className="size-4 animate-spin" /> {`AI is reading ${auditsLabel(selected.length)}…`}
                </p>
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="mt-4 h-5 w-1/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ) : report ? (
              <ReportView
                report={report}
                onAskAnother={() => {
                  setReport(null);
                  window.requestAnimationFrame(() => document.getElementById("ask-question")?.scrollIntoView({ behavior: "smooth" }));
                }}
              />
            ) : (
              <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-[#D9E2E8] bg-white px-6 py-10 text-center">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#F4F7F9] text-[#04203F]">
                  <Sparkles className="size-5" />
                </span>
                <h2 className="mt-3 text-base font-semibold text-[#04203F]">Your report will appear here</h2>
                <p className="mt-1 max-w-md text-sm text-[#667085]">
                  Select one or more audits, write what you want to understand, and AI returns a summary, key insights,
                  risks and recommended actions.
                </p>
              </div>
            )}
          </section>

          <section aria-labelledby="past-analyses" className="rounded-2xl border border-[#D9E2E8] bg-white p-4 sm:p-5">
            <h2 id="past-analyses" className="flex items-center gap-2 text-base font-semibold text-[#04203F]">
              <History className="size-4" /> Past analyses
            </h2>
            {past.isLoading ? (
              <div className="mt-3 space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : past.isError ? (
              <div className="mt-3">
                <ErrorState onRetry={() => void past.refetch()} />
              </div>
            ) : !past.data?.length ? (
              <p className="mt-2 text-sm text-[#667085]">Reports you run are saved here so you can reopen them.</p>
            ) : (
              <ul className="mt-3 divide-y divide-[#EEF1F4] rounded-xl border border-[#D9E2E8]">
                {past.data.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => openPast(r)}
                      className={cn(
                        "flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-[#F4F7F9]",
                        report?.id === r.id && "bg-[#F4F7F9]",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="line-clamp-2 text-sm font-medium text-[#04203F]">{r.question}</span>
                        <span className="mt-0.5 block text-xs text-[#667085]">
                          {r.audits.length} audit{r.audits.length === 1 ? "" : "s"} · {formatDateTime(r.created_at)}
                        </span>
                      </span>
                      {report?.id === r.id ? <Check className="mt-0.5 size-4 shrink-0 text-[#04203F]" /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function ModePill({ mode }: { mode: "ai" | "digital" }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#D9E2E8] px-2 py-0.5 text-[11px] text-[#667085]">
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ background: mode === "digital" ? "#7DB7D6" : "#9B86D9" }}
      />
      {mode === "digital" ? "Digital" : "AI"}
    </span>
  );
}

function reportFileName(report: IntelligenceReport): string {
  return `aislix-intelligence-${report.created_at.slice(0, 10)}.pdf`;
}

function ReportView({ report, onAskAnother }: { report: IntelligenceReport; onAskAnother: () => void }) {
  const text = hideModelNames(report.report);
  const blocks = useMemo(() => reportBlocks(text), [text]);
  const auditList = report.audits as IntelligenceAuditRef[];

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
      `${auditList.length} audit${auditList.length === 1 ? "" : "s"} · ${formatDateTime(report.created_at)}`,
      ...auditList.map((a, i) => `${i + 1}. ${a.label} (${a.mode === "digital" ? "Digital" : "AI"} audit, ${a.date})`),
    ];
    downloadBlobBytes(reportPdf("Aislix Intelligence report", meta, text), reportFileName(report), "application/pdf");
    toast.success("PDF downloaded");
  };

  return (
    <article className="rounded-2xl border border-[#D9E2E8] bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <p className="text-xs text-[#667085]">
            AI analysis · {auditList.length} audit{auditList.length === 1 ? "" : "s"} · {formatDateTime(report.created_at)}
          </p>
          <h2 className="mt-1 text-base font-semibold text-[#04203F]">{report.question}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => void copy()}>
            <Copy className="size-4" /> Copy
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={pdf}>
            <Download className="size-4" /> Download PDF
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={onAskAnother}>
            <RotateCcw className="size-4" /> Ask another question
          </Button>
        </div>
      </div>

      {auditList.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {auditList.map((a) => (
            <span
              key={a.id}
              className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-[#D9E2E8] px-2 py-0.5 text-[11px] text-[#667085]"
              title={`${a.label} · ${a.date}`}
            >
              <span
                aria-hidden
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: a.mode === "digital" ? "#7DB7D6" : "#9B86D9" }}
              />
              <span className="truncate">
                {a.label} · {a.date}
              </span>
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-5 space-y-3 border-t border-[#EEF1F4] pt-4 text-sm leading-relaxed text-[#04203F]">
        {blocks.map((block, i) => (
          <ReportBlockView key={i} block={block} />
        ))}
      </div>
      <p className="mt-5 text-xs text-[#667085]">
        AI analysis of the selected audits. Check important figures against the audits before acting.
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
    return block.level === 1 ? (
      <h3 className="pt-2 text-lg font-semibold">{block.text}</h3>
    ) : block.level === 2 ? (
      <h3 className="pt-2 text-base font-semibold">{block.text}</h3>
    ) : (
      <h4 className="pt-1 text-sm font-semibold">{block.text}</h4>
    );
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
    <div className="overflow-x-auto rounded-xl border border-[#D9E2E8]">
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
