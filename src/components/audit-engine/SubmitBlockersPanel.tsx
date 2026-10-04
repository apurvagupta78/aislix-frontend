import { forwardRef } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AISLIX_PALETTE, ACCENT_TINT } from "@/lib/ai-audit/kpi-palette";
import type { SubmitBlocker } from "@/lib/audit-engine/submit-readiness";

export type SubmitProblem = { title: string; items: string[] };

type Props = {
  /** Live checks from the page — update as the auditor fixes things. */
  blockers: SubmitBlocker[];
  /** Reason the last submit was rejected (server check, network, permissions). */
  problem: SubmitProblem | null;
  /** Non-blocking note, e.g. photos flagged for review. */
  notice?: string | null;
  onGoTo?: (blocker: SubmitBlocker) => void;
  onDismissProblem?: () => void;
};

const GO_TO_LABEL: Record<SubmitBlocker["kind"], string> = {
  cells: "Show rows",
  header: "Show field",
  photos: "Show rows",
  explanations: "Show rows",
  barcodes: "Show rows",
  expiry: "Show rows",
  evidence: "Show evidence",
};

export const SubmitBlockersPanel = forwardRef<HTMLElement, Props>(function SubmitBlockersPanel(
  { blockers, problem, notice, onGoTo, onDismissProblem },
  ref,
) {
  const blocked = blockers.length > 0;
  if (!blocked && !problem) {
    return (
      <section
        ref={ref}
        role="status"
        className="flex scroll-mt-24 items-center gap-3 rounded-2xl border bg-white px-5 py-4 shadow-sm"
        style={{ borderColor: AISLIX_PALETTE.border, boxShadow: `inset 4px 0 0 ${AISLIX_PALETTE.green}` }}
      >
        <CheckCircle2 className="size-5 shrink-0" style={{ color: AISLIX_PALETTE.green }} />
        <div>
          <p className="text-sm font-semibold text-[#102A43]">Everything required is done</p>
          <p className="text-xs text-[#667085]">You can submit the audit now.</p>
        </div>
      </section>
    );
  }

  const count = blockers.length;
  const title = blocked
    ? `${count === 1 ? "1 thing" : `${count} things`} to finish before you can submit`
    : problem!.title;

  return (
    <section
      ref={ref}
      role="alert"
      aria-live="polite"
      className="scroll-mt-24 overflow-hidden rounded-2xl border bg-white shadow-sm"
      style={{ borderColor: AISLIX_PALETTE.border }}
    >
      <div className="flex items-start gap-3 px-5 py-4" style={{ background: AISLIX_PALETTE.pink }}>
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-[#102A43]" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-[#102A43]">{title}</h3>
          <p className="mt-0.5 text-sm text-[#667085]">
            {blocked
              ? "Your work is saved. Complete the items below, then press Submit audit again."
              : "Your work is saved. Fix the items below and try again."}
          </p>
        </div>
        {!blocked && onDismissProblem ? (
          <button
            type="button"
            aria-label="Dismiss"
            className="rounded p-1 text-[#667085] hover:bg-white/60 hover:text-[#102A43]"
            onClick={onDismissProblem}
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      <ol className="divide-y divide-[#D9E2E8]">
        {blocked
          ? blockers.map((b, i) => (
              <li key={b.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-[#102A43]"
                  style={{ background: ACCENT_TINT.grey, border: `1px solid ${AISLIX_PALETTE.border}` }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#102A43]">{b.title}</p>
                  <p className="text-sm text-[#667085]">{b.detail}</p>
                </div>
                {onGoTo && (b.rowIndexes.length || b.kind === "header" || b.kind === "evidence") ? (
                  <Button type="button" variant="outline" size="sm" className="shrink-0 self-start sm:self-center" onClick={() => onGoTo(b)}>
                    {GO_TO_LABEL[b.kind]}
                  </Button>
                ) : null}
              </li>
            ))
          : problem!.items.map((item, i) => (
              <li key={`${i}-${item}`} className="flex items-start gap-3 px-5 py-3">
                <span
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-[#102A43]"
                  style={{ background: ACCENT_TINT.grey, border: `1px solid ${AISLIX_PALETTE.border}` }}
                >
                  {i + 1}
                </span>
                <p className="text-sm text-[#102A43]">{item}</p>
              </li>
            ))}
      </ol>

      {notice ? (
        <div className="flex items-start gap-2 border-t border-[#D9E2E8] px-5 py-3 text-xs text-[#667085]" style={{ background: AISLIX_PALETTE.grey }}>
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>{notice}</span>
        </div>
      ) : null}
    </section>
  );
});
