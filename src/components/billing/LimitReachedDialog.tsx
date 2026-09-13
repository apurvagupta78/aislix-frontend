import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpRight, Clock, Store as StoreIcon, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  cooldownClock,
  isLimitReachedError,
  scanUsageLabel,
  storeUsageLabel,
  type LimitReachedError,
} from "@/lib/subscription-limits";

/** Live HH:MM:SS countdown until the Free-plan rolling window frees an audit. */
function CooldownTimer({ until }: { until: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-base font-semibold tabular-nums text-foreground">
      {cooldownClock(until, now)}
    </span>
  );
}

export type LimitDialogState = LimitReachedError | null;

/** Reads a caught error and returns dialog state when it is a plan limit. */
export function toLimitDialogState(error: unknown): LimitDialogState {
  return isLimitReachedError(error) ? error : null;
}

/**
 * Plan-limit modal shown when an audit or store creation is blocked. Enterprise
 * workspaces never see an upgrade CTA (they are already unlimited/quote-based).
 */
export function LimitReachedDialog({
  limit,
  onClose,
}: {
  limit: LimitDialogState;
  onClose: () => void;
}) {
  const usage = limit?.usage;
  const isStore = limit?.limit === "store_limit";
  const isCooldown = limit?.limit === "scan_cooldown";
  const showUpgrade = !!usage && usage.plan_code !== "enterprise";

  return (
    <Dialog open={!!limit} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
            {isStore ? (
              <StoreIcon className="size-5" />
            ) : isCooldown ? (
              <Clock className="size-5" />
            ) : (
              <AlertTriangle className="size-5" />
            )}
          </div>
          <DialogTitle>
            {isStore
              ? "Store limit reached"
              : isCooldown
                ? "Daily audit limit reached"
                : "Monthly audit limit reached"}
          </DialogTitle>
          <DialogDescription>{limit?.message}</DialogDescription>
        </DialogHeader>

        {usage ? (
          <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Current plan</span>
              <span className="font-medium text-foreground">{usage.plan_name}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{isStore ? "Stores" : "Audits"}</span>
              <span className="font-medium text-foreground">
                {isStore ? storeUsageLabel(usage) : scanUsageLabel(usage)}
              </span>
            </div>
            {isCooldown && limit?.cooldownUntil ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Next audit unlocks in</span>
                <CooldownTimer until={limit.cooldownUntil} />
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="subtle" className="rounded-xl" onClick={onClose}>
            Close
          </Button>
          {showUpgrade ? (
            <Button asChild variant="brand" className="rounded-xl">
              <Link to="/billing" onClick={onClose}>
                {usage?.plan_code === "professional" ? "Talk to sales" : "Upgrade plan"}
                <ArrowUpRight className="ml-1 size-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild variant="brand" className="rounded-xl">
              <Link to="/contact" onClick={onClose}>
                Contact your account manager
                <Zap className="ml-1 size-4" />
              </Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
