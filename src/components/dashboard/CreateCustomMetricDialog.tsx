import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { generateDashboardCustomMetric } from "@/lib/dashboard-custom-metric.functions";
import {
  CATALOG_METRIC_OPTIONS,
  computeCatalogMetric,
  nextFreeCustomSlot,
  type CustomMetricDef,
  type CustomMetricMode,
} from "@/lib/dashboard-custom-metrics";
import type { DashboardTabKey } from "@/lib/dashboard-layout";
import type { LastTenAuditRow } from "@/lib/dashboard-ops-ai";
import { cn } from "@/lib/utils";

export function CreateCustomMetricDialog({
  open,
  onOpenChange,
  tab,
  existing,
  audits,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tab: DashboardTabKey;
  existing: CustomMetricDef[];
  audits: LastTenAuditRow[];
  onSave: (metric: CustomMetricDef) => void;
}) {
  const freeSlot = nextFreeCustomSlot(existing, tab);
  const [mode, setMode] = useState<CustomMetricMode>("catalog");
  const [catalogKey, setCatalogKey] = useState(CATALOG_METRIC_OPTIONS[0]!.key);
  const [question, setQuestion] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ title: string; value: string; context?: string } | null>(
    null,
  );

  const selectedAudits = useMemo(
    () => audits.filter((a) => selected.includes(a.id)),
    [audits, selected],
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 10) return prev;
      return [...prev, id];
    });
    setPreview(null);
  };

  const runPreview = async () => {
    setError(null);
    if (!freeSlot) {
      setError("You already have 3 custom metrics on this tab.");
      return;
    }
    if (!selected.length) {
      setError("Select at least one audit.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "catalog") {
        const computed = computeCatalogMetric(
          catalogKey,
          selectedAudits.map((a) => ({
            id: a.id,
            scorePct: a.scorePct,
            completionStage: a.completionStage,
          })),
        );
        setPreview(computed);
      } else {
        if (question.trim().length < 3) {
          setError("Enter a question for Luna.");
          setBusy(false);
          return;
        }
        const result = await generateDashboardCustomMetric({
          data: {
            question: question.trim(),
            audits: selectedAudits.map((a) => ({
              id: a.id,
              auditName: a.auditName,
              storeName: a.storeName,
              scorePct: a.scorePct,
              completionStage: a.completionStage,
              type: a.type,
              date: a.date,
            })),
          },
        });
        setPreview(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate metric");
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    if (!freeSlot || !preview) return;
    onSave({
      id: freeSlot,
      tab,
      mode,
      title: preview.title,
      value: preview.value,
      context: preview.context,
      catalogKey: mode === "catalog" ? catalogKey : undefined,
      question: mode === "luna" ? question.trim() : undefined,
      auditIds: selected,
      updatedAt: new Date().toISOString(),
    });
    onOpenChange(false);
    setPreview(null);
    setSelected([]);
    setQuestion("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#102A43]">Create custom metric</DialogTitle>
          <DialogDescription>
            Pick audits, then choose a catalog metric or ask Luna. Max 3 per tab.
          </DialogDescription>
        </DialogHeader>

        {!freeSlot ? (
          <p className="text-sm text-[#9b4b63]">All 3 custom slots are used. Hide or delete one first.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-[#667085]">1. Select audits</p>
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-[#D9E2E8] p-2">
                {audits.slice(0, 30).map((a) => (
                  <li key={a.id}>
                    <label className="flex cursor-pointer items-start gap-2 text-sm text-[#102A43]">
                      <input
                        type="checkbox"
                        checked={selected.includes(a.id)}
                        onChange={() => toggle(a.id)}
                        className="mt-1"
                      />
                      <span>
                        <span className="font-medium">{a.auditName}</span>
                        <span className="block text-xs text-[#667085]">
                          {a.storeName} · {a.type} · {a.completionStage}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
                {!audits.length ? (
                  <li className="text-sm text-[#667085]">No audits available</li>
                ) : null}
              </ul>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-[#667085]">2. Metric type</p>
              <div className="mb-2 flex gap-2">
                {(
                  [
                    ["catalog", "Catalog"],
                    ["luna", "Ask Luna"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setMode(id);
                      setPreview(null);
                    }}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium",
                      mode === id
                        ? "border-[#102A43] bg-[#102A43] text-white"
                        : "border-[#D9E2E8] bg-white text-[#667085]",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {mode === "catalog" ? (
                <select
                  className="w-full rounded-lg border border-[#D9E2E8] bg-white px-3 py-2 text-sm"
                  value={catalogKey}
                  onChange={(e) => {
                    setCatalogKey(e.target.value);
                    setPreview(null);
                  }}
                >
                  {CATALOG_METRIC_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <textarea
                  className="min-h-[72px] w-full rounded-lg border border-[#D9E2E8] bg-white px-3 py-2 text-sm"
                  placeholder="e.g. Which selected stores need a visit based on compliance?"
                  value={question}
                  onChange={(e) => {
                    setQuestion(e.target.value);
                    setPreview(null);
                  }}
                />
              )}
            </div>

            {preview ? (
              <div className="rounded-xl border border-[#C1E4F8] bg-[#EAF6FD]/50 p-3">
                <p className="text-xs uppercase text-[#667085]">Preview</p>
                <p className="mt-1 text-sm font-semibold text-[#102A43]">{preview.title}</p>
                <p className="text-2xl font-semibold text-[#102A43]">{preview.value}</p>
                {preview.context ? (
                  <p className="mt-1 text-xs text-[#557187]">{preview.context}</p>
                ) : null}
              </div>
            ) : null}

            {error ? <p className="text-sm text-[#9b4b63]">{error}</p> : null}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {!preview ? (
            <Button
              type="button"
              disabled={!freeSlot || busy}
              className="bg-[#102A43] text-white hover:bg-[#102A43]/90"
              onClick={() => void runPreview()}
            >
              {busy ? "Generating…" : "Preview"}
            </Button>
          ) : (
            <Button
              type="button"
              className="bg-[#102A43] text-white hover:bg-[#102A43]/90"
              onClick={confirm}
            >
              Add to dashboard
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
