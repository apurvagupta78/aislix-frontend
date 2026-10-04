import { Sparkles } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import {
  AI_ANALYSIS_CHECKS,
  AI_QUESTION_MAX,
  availableAiChecks,
  type AiAnalysisCheck,
} from "@/lib/ai-audit/ai-analysis";
import type { ReferenceRow } from "@/lib/ai-audit/reference-document";
import { AISLIX_PALETTE, ACCENT_TINT } from "@/lib/ai-audit/kpi-palette";
import { cn } from "@/lib/utils";

type Props = {
  /** Document lines, or null for a shelf-only audit. */
  rows: ReferenceRow[] | null;
  checks: AiAnalysisCheck[];
  question: string;
  onChecksChange: (checks: AiAnalysisCheck[]) => void;
  onQuestionChange: (question: string) => void;
  disabled?: boolean;
};

const NEEDS_LABEL: Record<string, string> = {
  product: "Needs a document",
  qty: "Needs a Qty column",
  price: "Needs a Price column",
  location: "Needs a Location column",
};

export function AiAnalysisQuestionCard({
  rows,
  checks,
  question,
  onChecksChange,
  onQuestionChange,
  disabled,
}: Props) {
  const available = availableAiChecks(rows);

  function toggle(value: AiAnalysisCheck, on: boolean) {
    onChecksChange(on ? [...new Set([...checks, value])] : checks.filter((c) => c !== value));
  }

  return (
    <div
      id="step-3-ai-question"
      className={cn("space-y-4 rounded-2xl border border-[#D9E2E8] bg-white p-4", disabled && "opacity-60")}
    >
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 size-4 shrink-0" style={{ color: AISLIX_PALETTE.purple }} />
        <div>
          <h4 className="text-sm font-semibold text-[#102A43]">What should AI analyse?</h4>
          <p className="mt-0.5 text-xs text-[#667085]">
            {rows
              ? "Astra identifies and counts the products in your shelf photos. Aislix matches them to your document. Luna then answers what you tick and ask here."
              : "Astra identifies and counts the products in your shelf photos. Aislix totals facings and brand share. Luna then answers what you tick and ask here."}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {AI_ANALYSIS_CHECKS.map((option) => {
          const enabled = available.has(option.value) && !disabled;
          const checked = checks.includes(option.value) && available.has(option.value);
          return (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors",
                !enabled && "cursor-not-allowed",
              )}
              style={{
                borderColor: checked ? AISLIX_PALETTE.purple : AISLIX_PALETTE.border,
                background: checked ? ACCENT_TINT.purple : enabled ? "#FFFFFF" : ACCENT_TINT.grey,
              }}
            >
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[#9B86D9]"
                checked={checked}
                disabled={!enabled}
                onChange={(event) => toggle(option.value, event.target.checked)}
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-[#102A43]">{option.label}</span>
                <span className="block text-[11px] text-[#667085]">
                  {!available.has(option.value) && option.needs ? NEEDS_LABEL[option.needs] : option.hint}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="ai-audit-question" className="text-xs font-semibold text-[#102A43]">
          Anything else you want to know? <span className="font-normal text-[#667085]">(optional)</span>
        </label>
        <Textarea
          id="ai-audit-question"
          rows={2}
          maxLength={AI_QUESTION_MAX}
          disabled={disabled}
          placeholder={
            rows
              ? "e.g. Which invoice items are short on the shelf and by how much?"
              : "e.g. Which brand has the most facings and where are the gaps?"
          }
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
        />
        <p className="text-right text-[10px] text-[#667085]">
          {question.length}/{AI_QUESTION_MAX}
        </p>
      </div>
    </div>
  );
}
