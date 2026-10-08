import { Bot, Check, Smartphone } from "lucide-react";

import { cn } from "@/lib/utils";
import { NEW_AUDIT_CAPTURE_OPTIONS, type CaptureMethod } from "@/lib/new-audit/summary";

const METHOD_ICON: Partial<Record<CaptureMethod, typeof Smartphone>> = {
  digital: Smartphone,
  ai: Bot,
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
          const Icon = METHOD_ICON[option.value];
          if (!Icon) return null;
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "relative min-h-[44px] rounded-xl border bg-white p-4 text-left transition-colors",
                selected
                  ? "border-[#04203F] ring-1 ring-[#04203F]"
                  : "border-[#D9E2E8] hover:border-[#9FB3C8]",
              )}
            >
              {selected ? (
                <span className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full bg-[#04203F] text-white">
                  <Check className="size-3.5" />
                </span>
              ) : null}
              <Icon className="mb-3 size-5 text-[#04203F]" aria-hidden />
              <p className="font-semibold text-[#04203F]">{option.title}</p>
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
