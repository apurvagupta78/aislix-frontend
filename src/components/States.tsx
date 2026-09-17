import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <Skeleton className="h-11 w-full" />
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-5" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="metric-tile space-y-3 p-5" aria-busy="true">
      <Skeleton className="h-9 w-9 rounded-xl" />
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string | undefined;
  action?: ReactNode | undefined;
  icon?: ReactNode | undefined;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--aislix-border)] bg-card px-6 py-14 text-center shadow-soft">
      <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-[var(--aislix-warehouse-border)] bg-[var(--aislix-warehouse-bg)] text-[var(--aislix-primary)]">
        {icon ?? <Inbox className="size-6" aria-hidden />}
      </span>
      <p className="mt-4 text-base font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "This didn't load",
  description = "We couldn't load this data. Try again in a moment.",
  onRetry,
}: {
  title?: string | undefined;
  description?: string | undefined;
  onRetry?: () => void | undefined;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-xl border border-status-danger bg-status-danger-soft px-6 py-14 text-center"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-card text-status-danger-strong shadow-soft">
        <AlertTriangle className="size-6" aria-hidden />
      </span>
      <p className="mt-4 text-base font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {onRetry && (
        <Button variant="subtle" size="sm" className="mt-5 rounded-xl" onClick={onRetry}>
          <RefreshCw className="size-4" aria-hidden /> Try again
        </Button>
      )}
    </div>
  );
}
