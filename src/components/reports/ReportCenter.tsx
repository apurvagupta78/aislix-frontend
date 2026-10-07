import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { FileSpreadsheet, Link2, Mail, MessageCircle, Printer, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { DemoPreviewToggle } from "@/components/control-tower/DemoPreviewToggle";
import { SegmentKpiCard } from "@/components/dashboard/SegmentHomePanel";
import { ReportsLibrary } from "@/components/reports/ReportsLibrary";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceContext } from "@/hooks/use-customer-context";
import { supabase } from "@/integrations/supabase/client";
import { requireOrgId } from "@/lib/db/context";
import {
  fetchReportDocument,
  fetchReportStores,
  reportPeriod,
  reportUrl,
  signReportPhotos,
} from "@/lib/reports/report-data";
import {
  DEFAULT_REPORT_FOR_SEGMENT,
  REPORT_DAYS,
  REPORT_KIND_INFO,
  REPORT_KINDS,
  reportShareText,
  type ReportDays,
  type ReportDocument,
  type ReportKind,
  type ReportTable,
} from "@/lib/reports/report-document";
import { downloadReportExcel, openPrintableReport } from "@/lib/reports/report-export";
import { emailReport } from "@/lib/reports/report-email.functions";
import { normalizeSegmentId, readStoredSegment, type SegmentId } from "@/lib/segments/segment-config";
import { resolveSegmentScope } from "@/lib/segments/segment-dashboard";
import { narrowToSegment } from "@/lib/segments/segment-stores";
import { useDemoPreview } from "@/lib/use-demo-preview";
import { cn } from "@/lib/utils";

export type ReportCenterTab = ReportKind | "audit";

export type ReportCenterSearch = {
  type?: ReportCenterTab;
  days?: ReportDays;
  store?: string;
};

const TAB_ORDER: ReportCenterTab[] = [...REPORT_KINDS, "audit"];
const TAB_LABEL: Record<ReportCenterTab, string> = {
  store: REPORT_KIND_INFO.store.label,
  exec: REPORT_KIND_INFO.exec.label,
  restock: REPORT_KIND_INFO.restock.label,
  field: REPORT_KIND_INFO.field.label,
  claim: REPORT_KIND_INFO.claim.label,
  audit: "Single audit reports",
};
const MAX_TABLE_ROWS = 50;

export function ReportCenter({
  search,
  onSearch,
}: {
  search: ReportCenterSearch;
  onSearch: (patch: ReportCenterSearch) => void;
}) {
  const workspace = useWorkspaceContext();
  const demo = useDemoPreview();
  const [storedSegment, setStoredSegment] = useState<SegmentId | null>(null);
  useEffect(() => setStoredSegment(readStoredSegment()), []);
  const segment: SegmentId =
    storedSegment ?? (workspace.data ? normalizeSegmentId(workspace.data.customerType) : "supermarket");

  const tab: ReportCenterTab = search.type ?? DEFAULT_REPORT_FOR_SEGMENT[segment];
  const days: ReportDays = search.days ?? 30;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Report type" className="flex flex-wrap gap-1.5">
          {TAB_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={id === tab}
              onClick={() => onSearch({ type: id, days, store: search.store })}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150",
                id === tab
                  ? "border-[#102A43] bg-[#102A43] text-white"
                  : "border-[#D9E2E8] bg-white text-[#667085] hover:bg-[#F4F7F9]",
              )}
            >
              {TAB_LABEL[id]}
            </button>
          ))}
        </div>
        <DemoPreviewToggle compact enabled={demo.previewDemo} onChange={demo.setPreviewDemo} />
      </div>

      {tab === "audit" ? (
        <ReportsLibrary />
      ) : (
        <ReportView
          kind={tab}
          days={days}
          storeParam={search.store ?? null}
          segment={segment}
          previewDemo={demo.previewDemo}
          userEmail={demo.userEmail}
          onSearch={(patch) => onSearch({ type: tab, days, store: search.store, ...patch })}
        />
      )}
    </div>
  );
}

function ReportView({
  kind,
  days,
  storeParam,
  segment,
  previewDemo,
  userEmail,
  onSearch,
}: {
  kind: ReportKind;
  days: ReportDays;
  storeParam: string | null;
  segment: SegmentId;
  previewDemo: boolean;
  userEmail: string | null;
  onSearch: (patch: ReportCenterSearch) => void;
}) {
  const info = REPORT_KIND_INFO[kind];
  const period = useMemo(() => reportPeriod(days), [days]);
  const [emailOpen, setEmailOpen] = useState(false);

  const scope = useQuery({
    queryKey: ["report-scope", previewDemo, userEmail],
    queryFn: () => resolveSegmentScope(null, { previewDemo, userEmail }),
    staleTime: 60_000,
  });
  const scopeData = scope.data?.signedIn ? scope.data : null;

  const stores = useQuery({
    queryKey: ["report-stores", scopeData?.dataOrgId, scopeData?.storeIds, days, segment],
    queryFn: async () =>
      fetchReportStores(supabase as never, {
        dataOrgId: scopeData!.dataOrgId,
        from: period.from,
        to: period.to,
        storeIds: await narrowToSegment(supabase as never, scopeData!.dataOrgId, segment, scopeData!.storeIds),
      }),
    enabled: Boolean(scopeData && !scopeData.outOfScope),
    staleTime: 60_000,
  });
  const storeOptions = stores.data ?? [];
  const pickedStore = storeOptions.find((s) => s.store_id === storeParam) ?? null;
  const storeId = info.needsStore ? (pickedStore ?? storeOptions[0] ?? null)?.store_id ?? null : pickedStore?.store_id ?? null;
  const storeName = storeOptions.find((s) => s.store_id === storeId)?.store_name ?? null;
  const waitingForStore = info.needsStore && stores.isPending;

  const report = useQuery({
    queryKey: ["report-doc", kind, segment, days, storeId, previewDemo, scopeData?.dataOrgId],
    queryFn: async (): Promise<ReportDocument | null> => {
      const s = await resolveSegmentScope(storeId, { previewDemo, userEmail });
      if (!s.signedIn || s.outOfScope) return null;
      if (info.needsStore && !storeId) return null;
      const doc = await fetchReportDocument(supabase as never, {
        kind,
        segment,
        dataOrgId: s.dataOrgId,
        labeledDemo: s.labeledDemo,
        from: period.from,
        to: period.to,
        storeIds: storeId ? s.storeIds : await narrowToSegment(supabase as never, s.dataOrgId, segment, s.storeIds),
        storeName,
      });
      return kind === "claim" ? signReportPhotos(supabase as never, doc) : doc;
    },
    enabled: Boolean(scopeData) && !waitingForStore,
    staleTime: 60_000,
  });
  const doc = report.data ?? null;

  const link = typeof window === "undefined" ? "" : reportUrl(window.location.origin, { kind, days, storeId });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Report link copied. Teammates sign in to open it.");
    } catch {
      toast.error("Could not copy the link");
    }
  };

  const whatsapp = () => {
    if (!doc) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(reportShareText(doc, link))}`, "_blank", "noopener");
  };

  const print = () => {
    if (!doc) return;
    if (!openPrintableReport(doc)) toast.error("Allow pop-ups for aislix.com to save the PDF.");
  };

  const ready = Boolean(doc) && !report.isFetching;

  return (
    <section
      aria-labelledby="report-title"
      className="rounded-2xl border border-[#D9E2E8] bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="report-title" className="text-base font-semibold text-[#102A43]">
              {info.label}
            </h2>
            {doc?.labeledDemo ? (
              <span className="rounded-full border border-[#D9E2E8] bg-[#EEF1F4] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#667085]">
                Demo data
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-[#667085]">{info.question}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(days)} onValueChange={(v) => onSearch({ days: Number(v) as ReportDays })}>
            <SelectTrigger className="h-9 w-[140px] rounded-xl" aria-label="Report period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_DAYS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  Last {d} days
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {kind === "store" || kind === "claim" || kind === "restock" ? (
            <Select
              value={storeId ?? "all"}
              onValueChange={(v) => onSearch({ store: v === "all" ? undefined : v })}
              disabled={!storeOptions.length}
            >
              <SelectTrigger className="h-9 w-[220px] rounded-xl" aria-label="Store">
                <SelectValue placeholder={storeOptions.length ? "Choose a store" : "No audited stores"} />
              </SelectTrigger>
              <SelectContent>
                {kind === "claim" || kind === "restock" ? <SelectItem value="all">All stores</SelectItem> : null}
                {storeOptions.map((s) => (
                  <SelectItem key={s.store_id} value={s.store_id}>
                    {s.city ? `${s.store_name} · ${s.city}` : s.store_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085]">
          <span className="inline-flex items-center gap-1 rounded-full border border-[#C1E4F8] bg-[#EEF6FA] px-2 py-0.5 text-[#102A43]">
            <Sparkles className="size-3" aria-hidden />
            AI detected · Calculated by Aislix
          </span>
          {doc ? <span>{doc.subtitle}</span> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="subtle" size="sm" className="rounded-xl" disabled={!ready} onClick={print}>
            <Printer className="size-4" /> PDF
          </Button>
          <Button
            variant="subtle"
            size="sm"
            className="rounded-xl"
            disabled={!ready}
            onClick={() => doc && downloadReportExcel(doc)}
          >
            <FileSpreadsheet className="size-4" /> Excel
          </Button>
          <Button variant="subtle" size="sm" className="rounded-xl" disabled={!ready} onClick={copyLink}>
            <Link2 className="size-4" /> Copy link
          </Button>
          <Button variant="subtle" size="sm" className="rounded-xl" disabled={!ready} onClick={whatsapp}>
            <MessageCircle className="size-4" /> WhatsApp
          </Button>
          <Button variant="brand" size="sm" className="rounded-xl" disabled={!ready} onClick={() => setEmailOpen(true)}>
            <Mail className="size-4" /> Email
          </Button>
        </div>
      </div>

      {scope.isPending || waitingForStore || report.isPending ? (
        <ReportSkeleton />
      ) : scope.isError || stores.isError || report.isError ? (
        <Notice title="Report unavailable" body="The report could not load. Refresh the page to try again." />
      ) : !scope.data?.signedIn ? (
        <Notice title="Sign in to see reports" body="Reports are built from your workspace's AI audits." />
      ) : scope.data.outOfScope ? (
        <Notice
          title="No stores in your access"
          body="Ask your workspace admin to add stores to your access to see reports."
        />
      ) : info.needsStore && !storeId ? (
        <Notice title="No audited stores in this period" body="Run an AI audit to build this report." cta />
      ) : !doc ? (
        <Notice title="Data unavailable" body="This report has no data for the selected period." />
      ) : doc.empty ? (
        <Notice title={doc.emptyMessage} body="Values show N/A until audits are completed." cta />
      ) : (
        <ReportBody doc={doc} />
      )}

      {doc ? (
        <EmailReportDialog
          open={emailOpen}
          onOpenChange={setEmailOpen}
          doc={doc}
          request={{ kind, days, segment, storeId, previewDemo }}
        />
      ) : null}
    </section>
  );
}

function ReportBody({ doc }: { doc: ReportDocument }) {
  return (
    <div className="mt-4 space-y-4">
      {doc.headline ? (
        <p className="rounded-xl border border-[#D9E2E8] bg-[#F4F7F9] px-3 py-2 text-sm text-[#102A43]">
          {doc.headline}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {doc.kpis.map((k) => (
          <SegmentKpiCard key={k.label} kpi={k} />
        ))}
      </div>
      {doc.tables.map((t) => (
        <ReportTableCard key={t.title} table={t} />
      ))}
      {doc.photos.length ? <PhotoGrid doc={doc} /> : null}
    </div>
  );
}

function ReportTableCard({ table }: { table: ReportTable }) {
  const rows = table.rows.slice(0, MAX_TABLE_ROWS);
  return (
    <div className="overflow-hidden rounded-xl border border-[#D9E2E8]">
      <div className="flex items-center justify-between gap-2 border-b border-[#D9E2E8] bg-[#F4F7F9] px-4 py-2.5">
        <h3 className="text-sm font-semibold text-[#102A43]">{table.title}</h3>
        <span className="text-xs text-[#667085]">
          {table.rows.length > rows.length
            ? `First ${rows.length} of ${table.rows.length} · all rows in Excel`
            : `${table.rows.length} ${table.rows.length === 1 ? "row" : "rows"}`}
        </span>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[#667085]">
                {table.columns.map((c, i) => (
                  <th key={c} className={cn("px-3 py-2 font-medium", i === 0 ? "pl-4 text-left" : "text-right")}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-t border-[#EEF1F4]">
                  {r.map((cell, ci) => (
                    <td
                      key={ci}
                      className={cn(
                        "px-3 py-2",
                        ci === 0 ? "pl-4 font-medium text-[#102A43]" : "text-right tabular-nums",
                        ci > 0 && (cell === "N/A" || cell === "No GPS" || cell === "No photo")
                          ? "text-[#667085]"
                          : "text-[#102A43]",
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-4 text-sm text-[#667085]">Data unavailable for this period.</p>
      )}
      {table.note ? <p className="border-t border-[#EEF1F4] px-4 py-2 text-xs text-[#667085]">{table.note}</p> : null}
    </div>
  );
}

function PhotoGrid({ doc }: { doc: ReportDocument }) {
  const withUrl = doc.photos.filter((p) => p.url);
  return (
    <div className="rounded-xl border border-[#D9E2E8] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#102A43]">Shelf photos</h3>
        <span className="text-[10px] font-medium uppercase tracking-wide text-[#667085]">Read from image</span>
      </div>
      {withUrl.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {withUrl.map((p) => (
            <figure key={p.scanId} className="overflow-hidden rounded-lg border border-[#D9E2E8] bg-white">
              <Link to="/results" search={{ scan: p.scanId }}>
                <img
                  src={p.url!}
                  alt={`Shelf photo at ${p.storeName}`}
                  loading="lazy"
                  className="h-36 w-full bg-[#EEF1F4] object-cover"
                />
              </Link>
              <figcaption className="space-y-0.5 px-2.5 py-2 text-xs">
                <p className="truncate font-medium text-[#102A43]">{p.storeName}</p>
                <p className="text-[#667085]">
                  {p.takenAt} · {p.capturedBy}
                </p>
                <p className={p.location === "No GPS" ? "text-[#667085]" : "text-[#102A43]"}>{p.location}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <p className="rounded-lg bg-[#EEF1F4] px-3 py-4 text-sm text-[#667085]">
          Photos are not available to your account for these audits.
        </p>
      )}
    </div>
  );
}

function EmailReportDialog({
  open,
  onOpenChange,
  doc,
  request,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: ReportDocument;
  request: { kind: ReportKind; days: ReportDays; segment: SegmentId; storeId: string | null; previewDemo: boolean };
}) {
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const send = useMutation({
    mutationFn: async () => {
      const recipients = to
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const activeOrgId = await requireOrgId();
      return emailReport({ data: { ...request, activeOrgId, recipients, message: message || null } });
    },
    onSuccess: (r) => {
      toast.success(r.sent === 1 ? "Report emailed" : `Report emailed to ${r.sent} people`);
      onOpenChange(false);
      setTo("");
      setMessage("");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not send the email."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Email this report</DialogTitle>
          <DialogDescription>
            Sends the {doc.title.toLowerCase()} summary with a link to the full report. Up to 5 addresses.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            type="text"
            inputMode="email"
            placeholder="name@company.com, other@company.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-label="Email addresses"
          />
          <Textarea
            placeholder="Add a note (optional)"
            value={message}
            maxLength={500}
            onChange={(e) => setMessage(e.target.value)}
            aria-label="Note"
          />
        </div>
        <DialogFooter>
          <Button variant="subtle" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="brand" disabled={!to.trim() || send.isPending} onClick={() => send.mutate()}>
            {send.isPending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Notice({ title, body, cta }: { title: string; body: string; cta?: boolean }) {
  return (
    <div className="mt-4 rounded-xl border border-[#D9E2E8] bg-[#EEF1F4]/80 px-4 py-4">
      <p className="text-sm font-semibold text-[#102A43]">{title}</p>
      <p className="mt-1 text-sm text-[#667085]">{body}</p>
      {cta ? (
        <Link
          to="/new-audit"
          search={{ templateId: undefined, systemKey: undefined, assign: false }}
          className="mt-3 inline-flex rounded-lg bg-[#102A43] px-3 py-2 text-xs font-medium text-white"
        >
          Start Audit
        </Link>
      ) : null}
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="mt-4 space-y-3" aria-busy="true" aria-live="polite">
      <p className="text-sm text-[#667085]">Loading report…</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-[#D9E2E8] bg-[#F4F7F9]" />
        ))}
      </div>
    </div>
  );
}
