import { Link } from "@tanstack/react-router";
import type { DemoAllowance } from "@/lib/demo-allowance";
import { formatNextAvailable } from "@/lib/demo-allowance";
import { signupUrl } from "@/lib/landing-scan-api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DemoAllowanceIndicator({
  allowance,
  className,
}: {
  allowance: DemoAllowance;
  className?: string;
}) {
  const { used, limit, remaining, nextAvailableAt } = allowance;
  const atLimit = remaining <= 0;
  const progress = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <div className={cn("rounded-lg border border-border/70 bg-card px-3.5 py-3", className)}>
      {atLimit ? (
        <>
          <p className="text-xs font-semibold text-foreground">Free demo limit reached</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Your next AI audit will be available 24 hours after your last completed demo audit.
          </p>
          {nextAvailableAt ? (
            <p className="mt-1 text-[11px] font-medium text-foreground">
              Next available: {formatNextAvailable(nextAvailableAt)}
            </p>
          ) : null}
          <Button asChild size="sm" variant="brand" className="mt-2.5 w-full sm:w-auto">
            <Link to={signupUrl()}>Create Free Workspace →</Link>
          </Button>
        </>
      ) : (
        <>
          <p className="text-xs font-medium text-foreground">
            {used} of {limit} free AI audits used
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {remaining} free AI audit{remaining === 1 ? "" : "s"} remaining
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Your free allowance resets 24 hours after your 5th audit.
          </p>
        </>
      )}
    </div>
  );
}
