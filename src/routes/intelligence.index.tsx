import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Check,
  History,
  ListChecks,
  Loader2,
  MessageSquareText,
  Paperclip,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { ErrorState, Skeleton } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { AuditPickerSheet, type AuditOption } from "@/components/intelligence/AuditPickerSheet";
import {
  AttachmentIcon,
  formatReportTime,
  IntelligenceReportView,
} from "@/components/intelligence/IntelligenceReportView";
import { supabase } from "@/integrations/supabase/client";
import { requireOrgId } from "@/lib/db/context";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MAX_FILES,
  formatBytes,
  isIntelligenceAttachment,
  precheckAttachment,
  type IntelligenceAttachment,
} from "@/lib/intelligence/attachments";
import { assignedAuditName, auditDescription, auditName, auditShortId } from "@/lib/intelligence/audit-label";
import { isIntelligenceChart } from "@/lib/intelligence/intelligence-charts";
import {
  INTELLIGENCE_MAX_AUDITS,
  INTELLIGENCE_MAX_QUESTION,
  runIntelligenceAnalysis,
  uploadIntelligenceAttachment,
  type IntelligenceReport,
} from "@/lib/intelligence/intelligence.functions";
import { cn } from "@/lib/utils";

const DESCRIPTION =
  "Select audits, attach your own files if you like, and ask a question. AI writes the insights; Aislix turns them into charts.";

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

type PendingFile = {
  key: string;
  name: string;
  size: number;
  status: "checking" | "ready" | "blocked";
  attachment?: IntelligenceAttachment;
  error?: string;
};

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

async function fetchAuditOptions(): Promise<AuditOption[]> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("shelf_scans")
    .select("id, created_at, audit_mode, category, shelf_label, store_id, notes, assignment_id")
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
    notes: string | null;
    assignment_id: string | null;
  }>;
  const storeIds = [...new Set(rows.map((r) => r.store_id).filter(Boolean) as string[])];
  const assignmentIds = [...new Set(rows.map((r) => r.assignment_id).filter(Boolean) as string[])];
  const stores = new Map<string, string>();
  const assignments = new Map<string, { scope_values: unknown; instructions: string | null }>();
  for (let i = 0; i < storeIds.length; i += 100) {
    const { data: page } = await supabase.from("stores").select("id, name").in("id", storeIds.slice(i, i + 100));
    for (const s of (page ?? []) as Array<{ id: string; name: string }>) stores.set(s.id, s.name);
  }
  for (let i = 0; i < assignmentIds.length; i += 100) {
    const { data: page } = await supabase
      .from("scan_assignments")
      .select("id, scope_values, instructions")
      .in("id", assignmentIds.slice(i, i + 100));
    for (const a of (page ?? []) as Array<{ id: string; scope_values: unknown; instructions: string | null }>) {
      assignments.set(a.id, a);
    }
  }
  return rows.map((r) => {
    const store = (r.store_id && stores.get(r.store_id)) || "Store";
    const assignment = r.assignment_id ? assignments.get(r.assignment_id) : undefined;
    return {
      id: r.id,
      code: auditShortId(r.id),
      created_at: r.created_at,
      mode: r.audit_mode === "digital" ? "digital" : "ai",
      store,
      name: auditName({
        assignedName: assignedAuditName(assignment?.scope_values),
        store,
        category: r.category,
        shelf: r.shelf_label,
      }),
      description: auditDescription({ instructions: assignment?.instructions, notes: r.notes }),
    };
  });
}

async function fetchPastReports(): Promise<IntelligenceReport[]> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("intelligence_reports" as never)
    .select("id, question, report, audits, charts, attachments, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    question: String(r.question ?? ""),
    report: String(r.report ?? ""),
    created_at: String(r.created_at ?? ""),
    audits: Array.isArray(r.audits) ? (r.audits as IntelligenceReport["audits"]) : [],
    charts: Array.isArray(r.charts) ? r.charts.filter(isIntelligenceChart) : [],
    attachments: Array.isArray(r.attachments) ? r.attachments.filter(isIntelligenceAttachment) : [],
  }));
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function IntelligencePage() {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [report, setReport] = useState<IntelligenceReport | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const audits = useQuery({ queryKey: ["intelligence", "audits"], queryFn: fetchAuditOptions });
  const past = useQuery({ queryKey: ["intelligence", "reports"], queryFn: fetchPastReports });
  const options = audits.data ?? [];
  const byId = new Map(options.map((a) => [a.id, a]));

  const readyFiles = files.filter((f) => f.status === "ready" && f.attachment);
  const checking = files.some((f) => f.status === "checking");
  const activeFiles = files.filter((f) => f.status !== "blocked").length;
  const hasInput = selected.length > 0 || readyFiles.length > 0;

  const scrollToReport = () =>
    window.requestAnimationFrame(() =>
      document.getElementById("intelligence-report")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );

  const run = useMutation({
    mutationFn: async () => {
      if (!hasInput) throw new Error("Select at least one audit or attach a file.");
      if (question.trim().length < 5) throw new Error("Write what you would like to analyse.");
      const orgId = await requireOrgId();
      return runIntelligenceAnalysis({
        data: {
          activeOrgId: orgId,
          scanIds: selected,
          question: question.trim(),
          attachments: readyFiles.map((f) => ({ path: f.attachment!.path, name: f.attachment!.name })),
        },
      });
    },
    onSuccess: (out) => {
      setReport(out);
      void queryClient.invalidateQueries({ queryKey: ["intelligence", "reports"] });
      scrollToReport();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "The analysis failed. Try again."),
  });

  const toggle = (id: string) =>
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= INTELLIGENCE_MAX_AUDITS) {
        toast.info(`You can select up to ${INTELLIGENCE_MAX_AUDITS} audits.`);
        return cur;
      }
      return [...cur, id];
    });

  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    const room = ATTACHMENT_MAX_FILES - activeFiles;
    const incoming = Array.from(list);
    if (incoming.length > room) toast.info(`You can attach up to ${ATTACHMENT_MAX_FILES} files.`);
    const orgId = await requireOrgId();
    for (const file of incoming.slice(0, Math.max(0, room))) {
      const problem = precheckAttachment(file);
      if (problem) {
        toast.error(problem);
        continue;
      }
      const key = `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setFiles((cur) => [...cur, { key, name: file.name, size: file.size, status: "checking" }]);
      try {
        const base64 = await readAsBase64(file);
        const attachment = await uploadIntelligenceAttachment({ data: { activeOrgId: orgId, name: file.name, base64 } });
        setFiles((cur) => cur.map((f) => (f.key === key ? { ...f, status: "ready", attachment } : f)));
      } catch (e) {
        const error = e instanceof Error ? e.message : `${file.name} could not be checked.`;
        setFiles((cur) => cur.map((f) => (f.key === key ? { ...f, status: "blocked", error } : f)));
        toast.error(error);
      }
    }
  };

  const startNew = () => {
    setReport(null);
    setQuestion("");
    setSelected([]);
    setFiles([]);
    setHistoryOpen(false);
    window.requestAnimationFrame(() => document.getElementById("intelligence-question")?.focus());
  };

  const openPast = (r: IntelligenceReport) => {
    setReport(r);
    setQuestion(r.question);
    const known = audits.data ? new Set(audits.data.map((a) => a.id)) : null;
    setSelected(
      r.audits
        .map((a) => a.id)
        .filter((id) => !known || known.has(id))
        .slice(0, INTELLIGENCE_MAX_AUDITS),
    );
    setFiles(
      r.attachments.map((a) => ({ key: a.path, name: a.name, size: a.size, status: "ready" as const, attachment: a })),
    );
    setHistoryOpen(false);
    scrollToReport();
  };

  const selectedAudits = selected.map((id) => byId.get(id)).filter(Boolean) as AuditOption[];
  const shownAudits = selectedAudits.slice(0, 4);
  const canRun = hasInput && question.trim().length >= 5 && !checking && !run.isPending;

  const history = (
    <HistoryList
      loading={past.isLoading}
      error={past.isError}
      onRetry={() => void past.refetch()}
      reports={past.data ?? []}
      activeId={report?.id ?? null}
      onOpen={openPast}
    />
  );

  return (
    <AppShell title="Intelligence" description={DESCRIPTION}>
      <div className="grid gap-4 lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="hidden lg:block" aria-label="Past analyses">
          <div className="sticky top-20 space-y-3">
            <Button variant="outline" className="h-10 w-full justify-start rounded-xl" onClick={startNew}>
              <Plus className="size-4" /> New analysis
            </Button>
            <div className="rounded-xl border border-[#D9E2E8] bg-white">
              <h2 className="flex items-center gap-2 border-b border-[#EEF1F4] px-3 py-2.5 text-sm font-semibold text-[#04203F]">
                <History className="size-4" /> Past analyses
              </h2>
              <div className="max-h-[calc(100vh-14rem)] overflow-y-auto">{history}</div>
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          <div className="flex gap-2 lg:hidden">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setHistoryOpen(true)}>
              <History className="size-4" /> Past analyses
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={startNew}>
              <Plus className="size-4" /> New
            </Button>
          </div>

          <section aria-labelledby="composer-title" className="rounded-xl border border-[#D9E2E8] bg-white">
            <div className="p-4 sm:p-5">
              <h2 id="composer-title" className="text-base font-semibold text-[#04203F]">
                What would you like to analyse?
              </h2>
              <Textarea
                id="intelligence-question"
                value={question}
                maxLength={INTELLIGENCE_MAX_QUESTION}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                className="mt-3 resize-y rounded-xl"
                placeholder="e.g. Which products are frequently out of stock across these stores, and what should we do?"
                aria-label="What would you like to analyse?"
              />
              {!question.trim() ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {EXAMPLE_QUESTIONS.slice(0, 4).map((q) => (
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
              ) : null}
            </div>

            <div className="space-y-3 border-t border-[#EEF1F4] px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 w-14 shrink-0 text-xs font-medium text-[#667085]">Audits</span>
                {shownAudits.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-full border border-[#D9E2E8] py-0.5 pl-2 pr-1 text-xs text-[#04203F]"
                    title={`${a.name} · ${a.code}`}
                  >
                    <span
                      aria-hidden
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: a.mode === "digital" ? "#7DB7D6" : "#9B86D9" }}
                    />
                    <span className="truncate">{a.name}</span>
                    <button
                      type="button"
                      onClick={() => toggle(a.id)}
                      aria-label={`Remove ${a.name}`}
                      className="rounded-full p-0.5 text-[#667085] hover:bg-[#F4F7F9] hover:text-[#04203F]"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                {selectedAudits.length > shownAudits.length ? (
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="rounded-full border border-[#D9E2E8] px-2 py-0.5 text-xs text-[#667085] hover:border-[#04203F] hover:text-[#04203F]"
                  >
                    +{selectedAudits.length - shownAudits.length} more
                  </button>
                ) : null}
                <Button variant="outline" size="sm" className="h-7 rounded-full px-2.5 text-xs" onClick={() => setPickerOpen(true)}>
                  <ListChecks className="size-3.5" />
                  {selected.length ? `Edit (${selected.length}/${INTELLIGENCE_MAX_AUDITS})` : "Select audits"}
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 w-14 shrink-0 text-xs font-medium text-[#667085]">Files</span>
                {files.map((f) => (
                  <span
                    key={f.key}
                    className={cn(
                      "inline-flex max-w-[18rem] items-center gap-1.5 rounded-full border py-0.5 pl-2 pr-1 text-xs",
                      f.status === "blocked" ? "border-[#ECBDCC] text-[#04203F]" : "border-[#D9E2E8] text-[#04203F]",
                    )}
                    title={f.error ?? `${f.name} · ${formatBytes(f.size)}`}
                  >
                    {f.status === "checking" ? (
                      <Loader2 className="size-3 shrink-0 animate-spin text-[#667085]" />
                    ) : f.status === "ready" ? (
                      <AttachmentIcon name={f.name} className="size-3 shrink-0 text-[#667085]" />
                    ) : (
                      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[#FFEAF1] ring-1 ring-[#ECBDCC]" />
                    )}
                    <span className="truncate">{f.name}</span>
                    <span className="shrink-0 text-[#667085]">
                      {f.status === "checking" ? "Checking…" : f.status === "blocked" ? "Blocked" : formatBytes(f.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles((cur) => cur.filter((x) => x.key !== f.key))}
                      aria-label={`Remove ${f.name}`}
                      className="rounded-full p-0.5 text-[#667085] hover:bg-[#F4F7F9] hover:text-[#04203F]"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full px-2.5 text-xs"
                  disabled={activeFiles >= ATTACHMENT_MAX_FILES}
                  onClick={() => fileInput.current?.click()}
                >
                  <Paperclip className="size-3.5" /> Attach files
                </Button>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  accept={ATTACHMENT_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    void addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-[#EEF1F4] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="flex items-start gap-1.5 text-xs text-[#667085]">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                CSV, Excel, PDF or images, up to {ATTACHMENT_MAX_FILES} files of 10 MB. Every file is safety-checked and
                kept private to you.
              </p>
              <Button variant="brand" className="h-10 shrink-0 rounded-xl px-5" disabled={!canRun} onClick={() => run.mutate()}>
                {run.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Analysing…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" /> Analyse
                  </>
                )}
              </Button>
            </div>
          </section>

          <section id="intelligence-report" aria-label="Report" className="scroll-mt-20">
            {run.isPending ? (
              <div className="rounded-xl border border-[#D9E2E8] bg-white p-5" aria-busy="true">
                <p className="flex items-center gap-2 text-sm font-medium text-[#04203F]">
                  <Loader2 className="size-4 animate-spin" />
                  {`AI is reading ${[
                    selected.length ? plural(selected.length, "audit") : null,
                    readyFiles.length ? plural(readyFiles.length, "file") : null,
                  ]
                    .filter(Boolean)
                    .join(" and ")}…`}
                </p>
                <p className="mt-1 text-xs text-[#667085]">An analysis can take up to two minutes.</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ) : report ? (
              <IntelligenceReportView report={report} onAskAnother={startNew} />
            ) : (
              <EmptyReport />
            )}
          </section>
        </div>
      </div>

      <AuditPickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        options={options}
        loading={audits.isLoading}
        error={audits.isError}
        onRetry={() => void audits.refetch()}
        selected={selected}
        max={INTELLIGENCE_MAX_AUDITS}
        onToggle={toggle}
        onClear={() => setSelected([])}
      />

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="left" className="flex w-full flex-col gap-0 p-0 sm:max-w-sm">
          <SheetHeader className="border-b border-[#D9E2E8] px-5 pb-4 pt-5 text-left">
            <SheetTitle className="text-base text-[#04203F]">Past analyses</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">{history}</div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

function HistoryList({
  loading,
  error,
  onRetry,
  reports,
  activeId,
  onOpen,
}: {
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  reports: IntelligenceReport[];
  activeId: string | null;
  onOpen: (r: IntelligenceReport) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2 p-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-3">
        <ErrorState onRetry={onRetry} />
      </div>
    );
  }
  if (!reports.length) {
    return <p className="px-3 py-4 text-sm text-[#667085]">Analyses you run are saved here so you can reopen them.</p>;
  }
  return (
    <ul className="divide-y divide-[#EEF1F4]">
      {reports.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => onOpen(r)}
            className={cn(
              "flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-[#F4F7F9]",
              activeId === r.id && "bg-[#F4F7F9]",
            )}
          >
            <span className="min-w-0">
              <span className="line-clamp-2 text-sm font-medium text-[#04203F]">{r.question}</span>
              <span className="mt-0.5 block text-xs text-[#667085]">
                {[
                  r.audits.length ? plural(r.audits.length, "audit") : null,
                  r.attachments.length ? plural(r.attachments.length, "file") : null,
                  formatReportTime(r.created_at),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            {activeId === r.id ? <Check className="mt-0.5 size-4 shrink-0 text-[#04203F]" /> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

function EmptyReport() {
  const steps = [
    {
      icon: ListChecks,
      title: "Pick audits",
      text: "Choose up to 20 completed AI or Digital audits by name, ID or date.",
    },
    {
      icon: MessageSquareText,
      title: "Ask and attach",
      text: "Write your question and add sales sheets, price lists, planograms or photos.",
    },
    {
      icon: BarChart3,
      title: "Get insights with charts",
      text: "AI writes the findings and actions; Aislix draws the charts from your audit data.",
    },
  ];
  return (
    <div className="rounded-xl border border-[#D9E2E8] bg-white p-5 sm:p-6">
      <h2 className="text-base font-semibold text-[#04203F]">Your analysis will appear here</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {steps.map((s) => (
          <div key={s.title} className="rounded-lg border border-[#D9E2E8] p-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-[#F4F7F9] text-[#04203F]">
              <s.icon className="size-4" />
            </span>
            <p className="mt-3 text-sm font-medium text-[#04203F]">{s.title}</p>
            <p className="mt-1 text-xs text-[#667085]">{s.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
