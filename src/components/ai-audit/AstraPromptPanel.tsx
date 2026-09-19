import { useState } from "react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildAstraVisionPrompt, type AstraPromptInput } from "@/lib/ai-audit/astra-prompt";
import { cn } from "@/lib/utils";

type Props = {
  input: AstraPromptInput;
  className?: string;
  defaultOpen?: boolean;
};

export function AstraPromptPanel({ input, className, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const prompt = buildAstraVisionPrompt(input);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-[var(--aislix-border)] bg-[var(--aislix-surface)]/50",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--aislix-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-[var(--aislix-primary)]" />
          <div>
            <p className="text-sm font-semibold text-[var(--aislix-primary)]">
              Astra vision prompt
            </p>
            <p className="text-[11px] text-[var(--aislix-secondary)]">
              Sent with your shelf photo when the audit runs
            </p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? (
            <>
              Hide <ChevronUp className="size-4" />
            </>
          ) : (
            <>
              View prompt <ChevronDown className="size-4" />
            </>
          )}
        </Button>
      </div>
      {open ? (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap p-4 font-mono text-[11px] leading-relaxed text-[var(--aislix-primary)]">
          {prompt}
        </pre>
      ) : null}
    </div>
  );
}
