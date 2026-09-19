import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Bot, ClipboardList, Copy } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/States";
import { fetchScanDebugPayload, type AuditResultKind, type ScanDebugSection } from "@/lib/scan-debug";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/results/debug")({
  validateSearch: (search: Record<string, unknown>): { scan?: string } => {
    const raw = search["scan"] ?? search["audit"];
    return typeof raw === "string" && raw.length > 0 ? { scan: raw } : {};
  },
  head: () => ({
    meta: [{ title: "Scan debug inspector — Aislix" }],
  }),
  component: ResultsDebugPage,
});

const KIND_LABEL: Record<AuditResultKind, { label: string; icon: typeof Bot; className: string }> = {
  ai: {
    label: "AI Audit (Astra)",
    icon: Bot,
    className: "bg-status-ai-soft text-status-ai-strong border-status-ai/25",
  },
  digital: {
    label: "Digital Audit (variance)",
    icon: ClipboardList,
    className: "bg-[var(--aislix-warehouse-bg)] text-[var(--aislix-primary)]",
  },
  ai_assisted: {
    label: "AI-Assisted",
    icon: Bot,
    className: "bg-status-warn-soft text-status-warn-strong",
  },
  unknown: {
    label: "Unknown type",
    icon: Bot,
    className: "bg-muted text-muted-foreground",
  },
};

function JsonBlock({ data }: { data: unknown }) {
  const text = useMemo(() => JSON.stringify(data, null, 2), [data]);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-2 top-2 h-7 rounded-lg text-[11px]"
        onClick={() => void copy()}
      >
        <Copy className="size-3.5" />
        {copied ? "Copied" : "Copy JSON"}
      </Button>
      <pre className="max-h-[480px] overflow-auto rounded-xl border border-border bg-muted/30 p-4 pt-10 text-[11px] leading-relaxed text-foreground">
        {text}
      </pre>
    </div>
  );
}

function SectionCard({ section, defaultOpen }: { section: ScanDebugSection; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const size =
    section.data == null
      ? "null"
      : Array.isArray(section.data)
        ? `${section.data.length} rows`
        : typeof section.data === "object"
          ? `${Object.keys(section.data as object).length} keys`
          : String(section.data);

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <p className="text-sm font-semibold text-foreground">{section.label}</p>
          {section.note ? <p className="mt-0.5 text-xs text-muted-foreground">{section.note}</p> : null}
        </div>
        <Badge variant="secondary" className="shrink-0 tabular-nums">
          {open ? "Hide" : size}
        </Badge>
      </button>
      {open ? (
        <div className="border-t border-border px-4 pb-4 pt-3">
          <JsonBlock data={section.data} />
        </div>
      ) : null}
    </div>
  );
}

function ResultsDebugPage() {
  const { scan } = Route.useSearch();
  const query = useQuery({
    queryKey: ["scan-debug", scan],
    queryFn: () => fetchScanDebugPayload(scan!),
    enabled: Boolean(scan),
    retry: 1,
  });

  const payload = query.data;
  const kind = payload ? KIND_LABEL[payload.result_kind] : null;
  const KindIcon = kind?.icon ?? Bot;

  return (
    <AppShell
      title="Scan debug inspector"
      description={
        scan
          ? `Raw payload for ${scan} — use this to see what Astra or Digital Audit stored before rebuilding /results.`
          : "Pass ?scan=UUID to inspect an audit."
      }
      actions={
        scan ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="subtle" size="sm" className="rounded-xl">
              <Link to="/results" search={{ scan }}>
                <ArrowLeft className="size-4" /> Full results page
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link to="/history">Audit history</Link>
            </Button>
          </div>
        ) : null
      }
    >
      {!scan ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
          Add <code className="rounded bg-muted px-1.5 py-0.5">?scan=YOUR-SCAN-ID</code> to the URL.
        </div>
      ) : query.isError ? (
        <ErrorState
          title="Could not load debug payload"
          description={query.error instanceof Error ? query.error.message : "Unknown error"}
          onRetry={() => void query.refetch()}
        />
      ) : query.isPending ? (
        <div className="rounded-xl border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          Loading raw scan data…
        </div>
      ) : payload ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              {kind ? (
                <Badge className={cn("rounded-full border", kind.className)}>
                  <KindIcon className="mr-1 size-3.5" />
                  {kind.label}
                </Badge>
              ) : null}
              <Badge variant="outline">Status: {payload.status}</Badge>
              {payload.analysis_mode ? (
                <Badge variant="secondary">analysis_mode: {payload.analysis_mode}</Badge>
              ) : null}
              <Badge variant="secondary">Astra UI mode: {payload.astra_mode}</Badge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {payload.result_kind === "ai" ? (
                <>
                  This is an <strong>AI Audit</strong>. The meaningful payload is in{" "}
                  <code className="text-xs">metrics.astra_*</code>,{" "}
                  <code className="text-xs">adhoc_planogram.expected_products</code>, and{" "}
                  <code className="text-xs">detected_products</code>. The full /results page tries to
                  render KPI charts + competitor intel on top — that layer is what is crashing today.
                </>
              ) : payload.result_kind === "digital" ? (
                <>
                  This is a <strong>Digital Audit</strong>. Variance lives in{" "}
                  <code className="text-xs">digital_audit_session.lines</code> — expected vs actual qty,
                  RCA, and value impact.
                </>
              ) : (
                <>Could not classify this audit automatically — inspect all sections below.</>
              )}
            </p>
            {payload.errors.length ? (
              <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                Partial load warnings: {payload.errors.join(" · ")}
              </div>
            ) : null}
          </div>

          {payload.image_url ? (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border px-4 py-2 text-sm font-medium">Shelf image</div>
              <img
                src={payload.image_url}
                alt="Audit shelf"
                className="max-h-[420px] w-full object-contain bg-muted/20"
              />
            </div>
          ) : null}

          <div className="space-y-3">
            {payload.sections.map((section, index) => (
              <SectionCard key={section.id} section={section} defaultOpen={index < 3} />
            ))}
          </div>

          <div className="rounded-xl border border-brand/20 bg-brand-soft/20 px-4 py-3 text-xs text-muted-foreground">
            Next step: once the Astra / Digital payload looks correct here, we rebuild{" "}
            <Link to="/results" search={{ scan }} className="font-medium text-brand hover:underline">
              /results
            </Link>{" "}
            as two separate views — AI (Astra comparison + shelf intel) vs Digital (variance table).
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
