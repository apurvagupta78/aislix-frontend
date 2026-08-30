import { Fragment } from "react";
import { Check, Minus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  annualSaving,
  comparisonGroups,
  formatInr,
  plans,
  priceFor,
  type BillingCycle,
  type Plan,
  type PlanId,
} from "@/lib/pricing";

export function CycleToggle({
  cycle,
  onChange,
  className = "",
}: {
  cycle: BillingCycle;
  onChange: (c: BillingCycle) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1",
        className,
      )}
      role="group"
      aria-label="Billing cycle"
    >
      {(["monthly", "annual"] as const).map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={cycle === c}
          onClick={() => onChange(c)}
          className={cn(
            "rounded-full px-4 py-1.5 text-xs font-medium capitalize transition-all sm:text-sm",
            cycle === c
              ? "bg-brand text-brand-foreground shadow-soft"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {c}
          {c === "annual" && (
            <span
              className={cn(
                "ml-2 rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold",
                cycle === "annual"
                  ? "bg-accent-green/25 text-brand-foreground"
                  : "bg-accent-green/12 text-accent-green",
              )}
            >
              Save 17%
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function PlanCard({
  plan,
  cycle,
  currentPlanId,
  onSelect,
  pending,
}: {
  plan: Plan;
  cycle: BillingCycle;
  currentPlanId?: PlanId | undefined;
  onSelect?: ((plan: Plan) => void) | undefined;
  pending?: boolean | undefined;
}) {
  const isCurrent = currentPlanId === plan.id;
  const saving = annualSaving(plan);

  return (
    <div
      className={cn(
        "group relative flex h-full flex-col rounded-3xl px-6 pt-6 pb-10 transition-all duration-300",
        plan.popular
          ? "border-2 border-brand bg-card shadow-card hover:-translate-y-1 hover:shadow-lift"
          : "card-surface card-hover",
      )}
    >
      {plan.popular && (
        <Badge className="absolute -top-3 left-6 rounded-full bg-brand px-3 text-brand-foreground hover:bg-brand">
          <Sparkles className="mr-1 size-3" /> Most popular
        </Badge>
      )}

      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold tracking-tight">{plan.name}</h3>
        {isCurrent && (
          <Badge className="rounded-full bg-accent-green/12 text-accent-green hover:bg-accent-green/12">
            Current
          </Badge>
        )}
      </div>
      <p className="mt-1.5 min-h-10 text-xs leading-relaxed text-muted-foreground sm:text-sm">
        {plan.tagline}
      </p>

      <div className="mt-5 flex items-end gap-1.5">
        <span className="text-3xl font-semibold tracking-tight">{priceFor(plan, cycle)}</span>
        {plan.monthlyPrice !== null && (
          <span className="pb-1 text-xs text-muted-foreground">/ month</span>
        )}
      </div>
      <p className="mt-1 h-4 text-xs text-accent-green">
        {cycle === "annual" && saving > 0 ? `Save ${formatInr(saving)} a year` : ""}
      </p>
      <p className="mt-3 rounded-xl bg-brand-soft px-3 py-2 text-xs font-medium text-brand">
        {plan.scanLimitLabel}
        <span className="mt-0.5 block font-normal text-brand/80">
          {plan.seatLimit === null
            ? "Unlimited team users"
            : `${plan.seatLimit} team user${plan.seatLimit === 1 ? "" : "s"}`}
        </span>
      </p>

      <ul className="mt-5 flex-1 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2 text-sm text-muted-foreground">
            <Check className="mt-0.5 size-4 shrink-0 text-accent-green" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Button
        variant={plan.popular ? "brand" : isCurrent ? "soft" : "subtle"}
        className="mt-6 mb-2 w-full rounded-xl"
        disabled={isCurrent || pending}
        onClick={() => onSelect?.(plan)}
      >
        {isCurrent ? "Current plan" : pending ? "Redirecting…" : plan.cta}
      </Button>
    </div>
  );
}

export function PricingGrid({
  cycle,
  currentPlanId,
  onSelect,
  pendingPlanId,
}: {
  cycle: BillingCycle;
  currentPlanId?: PlanId | undefined;
  onSelect?: ((plan: Plan) => void) | undefined;
  pendingPlanId?: PlanId | null | undefined;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {plans.map((p) => (
        <PlanCard
          key={p.id}
          plan={p}
          cycle={cycle}
          currentPlanId={currentPlanId}
          onSelect={onSelect}
          pending={pendingPlanId === p.id}
        />
      ))}
    </div>
  );
}

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="mx-auto size-4 text-accent-green" />;
  if (value === false) return <Minus className="mx-auto size-4 text-muted-foreground/50" />;
  return <span className="text-sm text-muted-foreground">{value}</span>;
}

export function ComparisonTable() {
  const ids = plans.map((p) => p.id);
  return (
    <div className="card-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="px-5 py-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Feature
              </th>
              {plans.map((p) => (
                <th key={p.id} className="px-5 py-4 text-center text-sm font-semibold">
                  <span className={p.popular ? "text-brand" : undefined}>{p.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparisonGroups.map((group) => (
              <Fragment key={group.group}>
                <tr className="bg-brand-soft/50">
                  <td
                    colSpan={ids.length + 1}
                    className="px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-brand"
                  >
                    {group.group}
                  </td>
                </tr>
                {group.rows.map((row) => (
                  <tr key={group.group + row.label} className="border-b border-border/70 last:border-0">
                    <td className="px-5 py-3.5 text-sm font-medium text-foreground">{row.label}</td>
                    {ids.map((id) => (
                      <td key={id} className="px-5 py-3.5 text-center">
                        <Cell value={row.values[id]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
