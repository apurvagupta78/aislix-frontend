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
};

const OPTIONS: {
  value: Exclude<StartChoice, null>;
  title: string;
  description: string;
  action: string;
  icon: typeof LayoutTemplate;
  card: string;
  selected: string;
}[] = [
  {
    value: "template",
    title: "Select Template",
    description: "Start with a ready-made audit.",
    action: "Choose Template",
    icon: LayoutTemplate,
    card: "border-sky-200 bg-sky-50/70 hover:border-sky-300",
    selected: "border-sky-500 bg-sky-50 ring-2 ring-sky-200",
  },
  {
    value: "csv",
    title: "Upload CSV",
    description: "Bring your own product or audit data.",
    action: "Upload CSV",
    icon: FileSpreadsheet,
    card: "border-emerald-200 bg-emerald-50/70 hover:border-emerald-300",
    selected: "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200",
  },
  {
    value: "custom",
    title: "Create from Scratch",
    description: "Build a completely custom audit.",
    action: "Create Custom",
    icon: Plus,
    card: "border-violet-200 bg-violet-50/70 hover:border-violet-300",
    selected: "border-violet-500 bg-violet-50 ring-2 ring-violet-200",
  },
];

export function StartChoiceCards({
  value,
  onChange,
  selectedTemplateName,
  error,
  children,
  onOpenTemplatePicker,
}: Props) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">How do you want to start?</h2>
        <p className="text-sm text-muted-foreground">
          Pick a template, upload a spreadsheet, or build your own.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                if (option.value === "template") onOpenTemplatePicker?.();
              }}
              className={cn(
                "relative flex flex-col rounded-2xl border p-4 text-left transition-all",
                selected ? option.selected : option.card,
              )}
            >
              {selected ? (
                <span className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full bg-brand text-brand-foreground">
                  <Check className="size-3.5" />
                </span>
              ) : null}
              <Icon className="mb-3 size-6" />
              <p className="font-semibold">{option.title}</p>
              <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">
                {option.description}
              </p>
              <span className="mt-3 inline-flex text-xs font-semibold text-brand">
                {option.action} →
              </span>
            </button>
          );
        })}
      </div>
      {selectedTemplateName && value === "template" ? (
        <p className="rounded-xl border border-brand/20 bg-brand-soft/20 px-4 py-3 text-sm">
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
