import { Bot, Check, Smartphone } from "lucide-react";

import { cn } from "@/lib/utils";
import { NEW_AUDIT_CAPTURE_OPTIONS, type CaptureMethod } from "@/lib/new-audit/summary";

const METHOD_VISUAL: Record<
  CaptureMethod,
  { icon: typeof Smartphone; card: string; selected: string }
> = {
  digital: {
    icon: Smartphone,
    card: "border-sky-200 bg-sky-50/70 hover:border-sky-300",
    selected: "border-sky-500 bg-sky-50 ring-2 ring-sky-200",
  },
  ai: {
    icon: Bot,
    card: "border-status-evidence/30 bg-status-evidence-soft hover:border-status-evidence/50",
    selected: "border-status-evidence bg-status-evidence-soft ring-2 ring-status-evidence/25",
  },
};

type Props = {
  value: CaptureMethod;
  onChange: (method: CaptureMethod) => void;
  error?: string | null;
  hideHeader?: boolean;
};

export function AuditMethodCards({ value, onChange, error, hideHeader }: Props) {
  return (
    <section className="space-y-4">
      {!hideHeader ? (
        <div>
          <h2 className="text-lg font-semibold">How will your team perform the audit?</h2>
          <p className="text-sm text-muted-foreground">Pick the capture style that fits your team.</p>
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {NEW_AUDIT_CAPTURE_OPTIONS.map((option) => {
          const visual = METHOD_VISUAL[option.value];
          if (!visual) return null;
          const Icon = visual.icon;
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "relative rounded-2xl border p-4 text-left transition-all",
                selected ? visual.selected : visual.card,
              )}
            >
              {selected ? (
                <span className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full bg-brand text-brand-foreground">
                  <Check className="size-3.5" />
                </span>
              ) : null}
              <Icon className="mb-3 size-6" />
              <p className="font-semibold">{option.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {option.description}
              </p>
            </button>
          );
        })}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
