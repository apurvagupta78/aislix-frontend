import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { toneClasses, type SemanticTone } from "@/lib/design-system";

type Props = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  selected?: boolean;
  tone?: SemanticTone;
  actionLabel?: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
};

/**
 * Interactive selection card — used for operating models, methods, templates, etc.
 * Supports click; drag-and-drop wrappers can compose around this.
 */
export function OptionCard({
  title,
  description,
  icon: Icon,
  selected = false,
  tone = "info",
  actionLabel,
  onClick,
  className,
  disabled,
}: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "play-card relative flex flex-col rounded-2xl p-4 text-left transition-all",
        toneClasses(tone, selected),
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      {selected ? (
        <span className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-sm">
          <Check className="size-3.5" />
        </span>
      ) : null}
      {Icon ? <Icon className="mb-3 size-6 text-foreground/85" aria-hidden /> : null}
      <p className="font-semibold leading-snug text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {actionLabel ? (
        <span className="mt-3 text-xs font-semibold text-brand">{actionLabel} →</span>
      ) : null}
    </button>
  );
}
