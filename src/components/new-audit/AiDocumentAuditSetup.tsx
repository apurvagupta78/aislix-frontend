import { useRef, useState, type ReactNode } from "react";
import { Camera, Check, FileSpreadsheet, ListPlus, ScanSearch } from "lucide-react";

import { AiAnalysisQuestionCard } from "@/components/new-audit/AiAnalysisQuestionCard";
import { NewAuditDemoSetupPanel } from "@/components/new-audit/NewAuditDemoSetupPanel";
import { ReferenceSourcePanel } from "@/components/new-audit/ReferenceSourcePanel";
import { defaultAiChecks, type AiAnalysisCheck } from "@/lib/ai-audit/ai-analysis";
import {
  blankProductList,
  usableReferenceRows,
  type ReferenceDocumentState,
} from "@/lib/ai-audit/reference-document";
import type { NewAuditPlanogramChoice } from "@/lib/new-audit/planogram-setup";
import type { ScanContextState } from "@/lib/scan-context";
import { cn } from "@/lib/utils";

type Props = {
  choice: NewAuditPlanogramChoice;
  scanContext: ScanContextState;
  onScanContextChange: (ctx: ScanContextState) => void;
  onChoiceChange: (choice: NewAuditPlanogramChoice) => void;
  checks: AiAnalysisCheck[];
  question: string;
  onChecksChange: (checks: AiAnalysisCheck[]) => void;
  onQuestionChange: (question: string) => void;
  /** Extra action shown above the document panel when "Upload document" is selected. */
  uploadAction?: ReactNode;
};

type SourceMode = "upload" | "scratch" | "without";

const SOURCE_CARDS: Array<{
  value: SourceMode;
  title: string;
  description: string;
  icon: typeof FileSpreadsheet;
}> = [
  {
    value: "upload",
    title: "Upload document",
    description: "Planogram, invoice, stock list or price list — PDF, photo, CSV or Excel.",
    icon: FileSpreadsheet,
  },
  {
    value: "scratch",
    title: "Start from scratch",
    description: "Type the products that should be on the shelf, with qty, price, location and promo.",
    icon: ListPlus,
  },
  {
    value: "without",
    title: "Continue without document",
    description: "AI reads the shelf as it is — products, facings, brand share, prices and offers.",
    icon: ScanSearch,
  },
];

function initialMode(choice: NewAuditPlanogramChoice, reference: ReferenceDocumentState | undefined): SourceMode {
  if (choice === "without") return "without";
  return reference?.meta.source === "manual" ? "scratch" : "upload";
}

/**
 * AI Audit Step 3: what the AI audits against — an uploaded document, a typed product list,
 * or nothing (shelf only) — plus what AI should analyse.
 */
export function AiDocumentAuditSetup({
  choice,
  scanContext,
  onScanContextChange,
  onChoiceChange,
  checks,
  question,
  onChecksChange,
  onQuestionChange,
  uploadAction,
}: Props) {
  const [mode, setMode] = useState<SourceMode>(() => initialMode(choice, scanContext.reference));
  const stash = useRef<Partial<Record<"upload" | "scratch", ReferenceDocumentState | undefined>>>({});
  const rows = scanContext.reference?.rows ?? [];
  const hasLines = usableReferenceRows(rows).length > 0;

  function selectMode(next: SourceMode) {
    if (next === mode) return;
    if (mode !== "without") stash.current[mode] = scanContext.reference;
    setMode(next);
    if (next === "without") {
      onChoiceChange("without");
      onChecksChange(defaultAiChecks(null));
      return;
    }
    const reference = next in stash.current ? stash.current[next] : next === "scratch" ? blankProductList() : undefined;
    onScanContextChange({ ...scanContext, reference });
    onChoiceChange("reference");
    const usable = usableReferenceRows(reference?.rows ?? []);
    onChecksChange(defaultAiChecks(usable.length ? reference!.rows : []));
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="What should AI audit against?">
        {SOURCE_CARDS.map((card) => {
          const Icon = card.icon;
          const selected = mode === card.value;
          return (
            <button
              key={card.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => selectMode(card.value)}
              className={cn(
                "relative flex flex-col rounded-xl border bg-white p-4 text-left transition-colors",
                selected ? "border-[#04203F] ring-1 ring-[#04203F]" : "border-[#D9E2E8] hover:border-[#9FB3C8]",
              )}
            >
              {selected ? (
                <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-[#04203F] text-white">
                  <Check className="size-3" />
                </span>
              ) : null}
              <Icon className="mb-3 size-5 text-[#04203F]" />
              <p className="font-semibold text-[#04203F]">{card.title}</p>
              <p className="mt-1 flex-1 text-xs leading-relaxed text-[#667085]">{card.description}</p>
            </button>
          );
        })}
      </div>

      {mode === "without" ? (
        <>
          <NewAuditDemoSetupPanel
            planogramChoice="without"
            scanContext={scanContext}
            onScanContextChange={onScanContextChange}
          />
          <AiAnalysisQuestionCard
            rows={null}
            checks={checks}
            question={question}
            onChecksChange={onChecksChange}
            onQuestionChange={onQuestionChange}
          />
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-[#D9E2E8] bg-white px-4 py-3 text-xs text-[#667085]">
            <span className="inline-flex items-center gap-1.5">
              <FileSpreadsheet className="size-4 text-[#04203F]" />
              <span>
                <strong className="font-semibold text-[#04203F]">
                  1. {mode === "scratch" ? "Your product list" : "Your document"}
                </strong>{" "}
                → editable lines
              </span>
            </span>
            <span>
              <strong className="font-semibold text-[#04203F]">2. What AI should analyse</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Camera className="size-4 text-[#04203F]" />
              <span>
                <strong className="font-semibold text-[#04203F]">3. Shelf photos</strong> — AI counts and explains
              </span>
            </span>
          </div>

          {mode === "upload" && uploadAction ? uploadAction : null}

          <ReferenceSourcePanel
            key={mode}
            mode={mode === "scratch" ? "manual" : "upload"}
            value={scanContext.reference}
            onChange={(reference) => {
              const hadLines = usableReferenceRows(scanContext.reference?.rows ?? []).length > 0;
              onScanContextChange({ ...scanContext, reference });
              if (!hadLines && reference && usableReferenceRows(reference.rows).length) {
                onChecksChange(defaultAiChecks(reference.rows));
              }
            }}
            category={scanContext.planogramMeta?.category}
            subCategory={scanContext.planogramMeta?.sub_category}
          />

          <AiAnalysisQuestionCard
            rows={hasLines ? rows : []}
            checks={checks}
            question={question}
            onChecksChange={onChecksChange}
            onQuestionChange={onQuestionChange}
            disabled={!hasLines}
          />
        </>
      )}
    </div>
  );
}
