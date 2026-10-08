import { Sparkles } from "lucide-react";

import {
  AI_ANALYSIS_CHECKS,
  parseLunaAnalysis,
  type LunaAnalysis,
  type LunaFindingStatus,
} from "@/lib/ai-audit/ai-analysis";
import { AISLIX_PALETTE, ACCENT_TINT } from "@/lib/ai-audit/kpi-palette";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<LunaFindingStatus, { label: string; bg: string; border: string }> = {
  ok: { label: "OK", bg: ACCENT_TINT.green, border: AISLIX_PALETTE.green },
  issue: { label: "Needs attention", bg: AISLIX_PALETTE.pink, border: "#F5C6D6" },
  needs_review: { label: "Needs review", bg: ACCENT_TINT.blue, border: AISLIX_PALETTE.blue },
  not_available: { label: "Data unavailable", bg: AISLIX_PALETTE.grey, border: AISLIX_PALETTE.border },
};

function checkLabel(check: string): string {
  if (check === "question") return "Your question";
  return AI_ANALYSIS_CHECKS.find((c) => c.value === check)?.label ?? check;
}

/** Reads `metrics.luna_analysis` from a scan result (authenticated or landing demo). */
export function lunaAnalysisFromMetrics(metrics: unknown): LunaAnalysis | null {
  if (!metrics || typeof metrics !== "object") return null;
  return parseLunaAnalysis((metrics as Record<string, unknown>).luna_analysis);
}

type Props = {
  analysis: LunaAnalysis | null;
  className?: string;
};

export function LunaAnalysisCard({ analysis, className }: Props) {
  if (!analysis) return null;
  const askedChecks = AI_ANALYSIS_CHECKS.filter((c) => analysis.checks.includes(c.value));

  return (
    <section
      aria-label="AI analysis"
      className={cn("space-y-4 rounded-xl border bg-white p-5", className)}
      style={{ borderColor: AISLIX_PALETTE.border }}
    >
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 size-4 shrink-0" style={{ color: AISLIX_PALETTE.purple }} />
        <div>
          <h3 className="text-sm font-semibold text-[#04203F]">AI analysis</h3>
          <p className="mt-0.5 text-xs text-[#667085]">
            Your request, answered from the AI shelf counts and Aislix&apos;s document match. Nothing is
            recounted here.
          </p>
        </div>
      </div>

      {askedChecks.length || analysis.question ? (
        <div className="rounded-xl border border-[#D9E2E8] bg-[#F4F7F9] px-4 py-3 text-xs text-[#667085]">
          <p className="font-semibold text-[#04203F]">You asked AI to analyse</p>
          {askedChecks.length ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {askedChecks.map((c) => (
                <span key={c.value} className="rounded-md border border-[#D9E2E8] bg-white px-2 py-0.5 text-[11px] text-[#04203F]">
                  {c.label}
                </span>
              ))}
            </div>
          ) : null}
          {analysis.question ? <p className="mt-2 italic">“{analysis.question}”</p> : null}
        </div>
      ) : null}

      {analysis.status === "failed" ? (
        <p
          className="rounded-xl border px-4 py-3 text-sm text-[#04203F]"
          style={{ background: AISLIX_PALETTE.grey, borderColor: AISLIX_PALETTE.border }}
        >
          AI analysis unavailable — {analysis.error ?? "it could not be completed."} The shelf counts and
          document comparison below are complete.
        </p>
      ) : (
        <>
          {analysis.answer ? (
            <p className="text-sm leading-relaxed text-[#04203F]">{analysis.answer}</p>
          ) : null}

          {analysis.findings.length ? (
            <ul className="grid gap-2 md:grid-cols-2">
              {analysis.findings.map((finding, index) => {
                const style = STATUS_STYLE[finding.status];
                return (
                  <li
                    key={`${finding.check}-${index}`}
                    className="space-y-1.5 rounded-xl border bg-white px-4 py-3"
                    style={{ borderColor: AISLIX_PALETTE.border }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium text-[#667085]">
                        {checkLabel(finding.check)}
                      </span>
                      <span
                        className="rounded-full border px-2 py-0.5 text-[10px] font-semibold text-[#04203F]"
                        style={{ background: style.bg, borderColor: style.border }}
                      >
                        {style.label}
                      </span>
                    </div>
                    {finding.title ? <p className="text-[13px] font-semibold text-[#04203F]">{finding.title}</p> : null}
                    {finding.note ? <p className="text-xs leading-relaxed text-[#667085]">{finding.note}</p> : null}
                    {finding.rows.length ? (
                      <p className="text-[11px] text-[#667085]">
                        Document line{finding.rows.length === 1 ? "" : "s"} {finding.rows.join(", ")}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {analysis.needs_review.length ? (
            <div className="rounded-xl border border-[#D9E2E8] bg-white px-4 py-3">
              <p className="text-xs font-semibold text-[#04203F]">Verification required</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-[#667085]">
                {analysis.needs_review.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
