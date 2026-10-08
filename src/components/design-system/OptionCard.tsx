import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SemanticTone } from "@/lib/design-system";

const optionSurface = (selected: boolean) =>
  selected ? "border-2 border-navy bg-white" : "border border-line bg-white";

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
  /** Smaller card: icon beside the title, tighter padding, two-line description. */
  compact?: boolean;
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
  actionLabel,
  onClick,
  className,
  disabled,
  compact = false,
}: Props) {
  if (compact) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-pressed={selected}
        className={cn(
          "play-card relative flex flex-col rounded-xl px-3 py-2.5 text-left transition-colors",
          optionSurface(selected),
          disabled && "cursor-not-allowed opacity-60",
          className,
        )}
      >
        <span className="flex items-center gap-2 pr-5">
          {Icon ? <Icon className="size-4 shrink-0 text-foreground/85" aria-hidden /> : null}
          <span className="text-sm font-semibold leading-snug text-foreground">{title}</span>
        </span>
        {selected ? (
          <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-sm">
            <Check className="size-3" />
          </span>
        ) : null}
        {description ? (
          <span className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{description}</span>
        ) : null}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "play-card relative flex flex-col rounded-xl p-4 text-left transition-colors",
        optionSurface(selected),
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
