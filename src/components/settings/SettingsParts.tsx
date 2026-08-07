import type { ReactNode } from "react";
import { Check, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function SettingsCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("card-surface card-hover overflow-hidden", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          {Icon && (
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
              <Icon className="size-4" />
            </span>
          )}
          <div>
            <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | undefined;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export function SaveBar({
  dirty,
  saving,
  saved,
  onReset,
  error,
  label = "Save changes",
}: {
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  onReset?: () => void;
  error?: string | null | undefined;
  label?: string;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-5">
      <Button type="submit" variant="brand" size="sm" className="rounded-xl" disabled={!dirty || saving}>
        {saving && <Loader2 className="size-4 animate-spin" />}
        {label}
      </Button>
      {onReset && (
        <Button
          type="button"
          variant="subtle"
          size="sm"
          className="rounded-xl"
          onClick={onReset}
          disabled={!dirty || saving}
        >
          Discard
        </Button>
      )}
      {saved && !dirty && !saving && (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-green">
          <Check className="size-3.5" /> Saved
        </span>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

export function FormSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2" aria-busy="true">
      {Array.from({ length: rows * 2 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function ToggleRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-surface px-4 py-3.5 transition-colors hover:border-brand/30">
      <div>
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}
