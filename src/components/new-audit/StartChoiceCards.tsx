import type { ReactNode } from "react";
import { Check, FileSpreadsheet, LayoutTemplate, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StartChoice } from "@/lib/new-audit/summary";

type Props = {
  value: StartChoice;
  onChange: (choice: StartChoice) => void;
  selectedTemplateName?: string;
  error?: string | null;
  children?: ReactNode;
  onOpenTemplatePicker?: () => void;
  hideHeader?: boolean;
};

const OPTIONS: {
  value: Exclude<StartChoice, null>;
  title: string;
  description: string;
  icon: typeof LayoutTemplate;
}[] = [
  {
    value: "csv",
    title: "Upload your document",
    description: "Invoice, stock list or price list — PDF, photo, CSV or Excel.",
    icon: FileSpreadsheet,
  },
  {
    value: "template",
    title: "Use a template",
    description: "Start with an existing Aislix audit template.",
    icon: LayoutTemplate,
  },
  {
    value: "custom",
    title: "Start from scratch",
    description: "Build a new audit yourself.",
    icon: Plus,
  },
];

export function StartChoiceCards({
  value,
  onChange,
  selectedTemplateName,
  error,
  children,
  onOpenTemplatePicker,
  hideHeader,
}: Props) {
  return (
    <section className="space-y-4">
      {!hideHeader ? (
        <div>
          <h2 className="text-lg font-semibold">What should Aislix work with?</h2>
          <p className="text-sm text-muted-foreground">
            Upload planogram, documents, templates, evidence, images, or other reference material to set up your audit.
          </p>
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-3">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
              className={cn(
                "relative flex min-h-[44px] flex-col rounded-xl border bg-white p-4 text-left transition-colors",
                selected
                  ? "border-[#04203F] ring-1 ring-[#04203F]"
                  : "border-[#D9E2E8] hover:border-[#9FB3C8]",
              )}
            >
              {selected ? (
                <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-[#04203F] text-white">
                  <Check className="size-3" />
                </span>
              ) : null}
              <Icon className="mb-3 size-5 text-[#04203F]" />
              <p className="font-semibold text-[#04203F]">{option.title}</p>
              <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">
                {option.description}
              </p>
            </button>
          );
        })}
      </div>
      {selectedTemplateName && value === "template" ? (
        <p className="rounded-xl border border-[#D9E2E8] px-4 py-3 text-sm">
          Selected: <strong>{selectedTemplateName}</strong>
        </p>
      ) : null}
      {value === "template" && selectedTemplateName ? (
        <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={onOpenTemplatePicker}>
          Change template
        </Button>
      ) : null}
      {value === "csv" || value === "custom" ? children : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
