import { Fragment } from "react";
import { Check, Minus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { trackEvent, AnalyticsEvents } from "@/lib/analytics";
import { currencyList, type CurrencyCode } from "@/lib/display-currency";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ANNUAL_DISCOUNT_PERCENT,
  annualSavingInr,
  COMPARISON_GROUPS,
  displayPrice,
  ENTERPRISE_PLAN,
  formatPrice,
  PLAN_DEFINITIONS,
  SUBSCRIPTION_PLANS,
  type BillingCycle,
  type PlanDefinition,
  type PlanId,
} from "@/lib/plan-entitlements";

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
        "inline-flex items-center gap-1 rounded-full border border-border/60 bg-white p-1 shadow-sm",
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
              ? "bg-brand text-brand-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {c === "monthly" ? "Monthly" : "Annual"}
          {c === "annual" ? (
            <span
              className={cn(
                "ml-2 rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold",
                cycle === "annual"
                  ? "bg-white/20 text-brand-foreground"
                  : "bg-accent-green/12 text-accent-green",
              )}
            >
              Save {ANNUAL_DISCOUNT_PERCENT}%
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function ControlStat({
  value,
  label,
  period,
  compact,
}: {
  value: number | null | string;
  label: string;
  period?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("min-w-0", compact ? "text-center" : "")}>
      <p className="text-lg font-semibold tabular-nums tracking-tight text-brand sm:text-xl">
        {typeof value === "number" ? value.toLocaleString("en-IN") : value}
      </p>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
        {period ? ` / ${period}` : ""}
      </p>
    </div>
  );
}

function PlanControls({ plan }: { plan: PlanDefinition }) {
  const { audits, users, stores, masterSetups } = plan.controls;
  if (plan.payAsYouGo) {
    return (
      <div className="mt-4 space-y-3 rounded-xl border border-border/50 bg-muted/10 p-3">
        <p className="text-xs font-medium text-foreground">Pay per completed audit</p>
        <div className="grid grid-cols-3 gap-2">
          <ControlStat value={users.value ?? "—"} label={users.label} compact />
          <ControlStat value={stores.value ?? "—"} label={stores.label} compact />
          <ControlStat value={masterSetups.value ?? "—"} label="Master setups" compact />
        </div>
      </div>
    );
  }
  if (plan.contactSales) {
    return (
      <div className="mt-4 grid gap-2 rounded-xl border border-border/50 bg-muted/10 p-3 text-xs text-muted-foreground sm:grid-cols-2">
        <span>{audits.label}</span>
        <span>{users.label}</span>
        <span>{stores.label}</span>
        <span>{masterSetups.label}</span>
      </div>
    );
  }
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-border/50 bg-muted/10 p-3 sm:grid-cols-4">
      <ControlStat
        value={audits.value ?? "—"}
        label={audits.label}
        period={audits.period}
      />
      <ControlStat value={users.value ?? "—"} label={users.label} />
      <ControlStat value={stores.value ?? "—"} label={stores.label} />
      <ControlStat value={masterSetups.value ?? "—"} label="Master setups" />
    </div>
  );
}

export function PlanCard({
  plan,
  cycle,
  currentPlanId,
  onSelect,
  pending,
  currency = "INR",
}: {
  plan: PlanDefinition;
  cycle: BillingCycle;
  currentPlanId?: PlanId | undefined;
  onSelect?: ((plan: PlanDefinition) => void) | undefined;
  pending?: boolean | undefined;
  currency?: CurrencyCode;
}) {
  const isCurrent = currentPlanId === plan.id;
  const saving = annualSavingInr(plan);
  const isPayg = plan.payAsYouGo;
  const isFree = plan.id === "free";

  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-2xl border bg-white p-5 shadow-sm transition-shadow",
        plan.popular
          ? "border-2 border-brand shadow-md"
          : isPayg
            ? "border-brand/40 shadow-md"
            : isFree
              ? "border-border/50"
              : "border-border/60 hover:shadow-md",
      )}
    >
      {plan.popular ? (
        <Badge className="absolute -top-3 left-5 rounded-full bg-brand px-2.5 text-[10px] text-brand-foreground hover:bg-brand">
          <Sparkles className="mr-1 size-3" /> Most Popular
        </Badge>
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{plan.name}</h3>
        {isCurrent ? (
          <Badge variant="secondary" className="rounded-full text-[10px]">
            Current
          </Badge>
        ) : null}
      </div>
      <p className="mt-1.5 min-h-[2.5rem] text-xs leading-relaxed text-muted-foreground">
        {plan.description}
      </p>

      <div className="mt-4 flex items-end gap-1">
        <span className="text-3xl font-semibold tracking-tight text-foreground">
          {displayPrice(plan, cycle, currency)}
        </span>
        {plan.periodLabel ? (
          <span className="pb-1 text-xs text-muted-foreground">{plan.periodLabel}</span>
        ) : null}
      </div>
      {cycle === "annual" && saving > 0 && !isPayg && !plan.contactSales ? (
        <p className="mt-1 text-[11px] text-accent-green">
          Save {formatPrice(saving, currency)} a year
        </p>
      ) : null}
      {isPayg ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          No subscription. No unused monthly credits.
        </p>
      ) : null}

      <PlanControls plan={plan} />

      <ul className="mt-4 flex-1 space-y-2">
        {plan.features.slice(0, isFree ? 8 : 10).map((f) => (
          <li key={f} className="flex gap-2 text-[11px] leading-relaxed text-muted-foreground">
            <Check className="mt-0.5 size-3.5 shrink-0 text-brand" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Button
        variant={plan.popular || isPayg ? "brand" : isCurrent ? "soft" : "subtle"}
        className="mt-5 h-10 w-full rounded-xl text-xs"
        disabled={isCurrent || pending}
        onClick={() => {
          trackEvent(AnalyticsEvents.PricingPlanClick, { plan_id: plan.id, plan_name: plan.name, cycle });
          onSelect?.(plan);
        }}
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
  currency = "INR",
}: {
  cycle: BillingCycle;
  currentPlanId?: PlanId | undefined;
  onSelect?: ((plan: PlanDefinition) => void) | undefined;
  pendingPlanId?: PlanId | null | undefined;
  currency?: CurrencyCode;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {SUBSCRIPTION_PLANS.map((p) => (
        <PlanCard
          key={p.id}
          plan={p}
          cycle={cycle}
          currentPlanId={currentPlanId}
          onSelect={onSelect}
          pending={pendingPlanId === p.id}
          currency={currency}
        />
      ))}
    </div>
  );
}

export function EnterpriseSection({
  plan,
  onSelect,
  pending,
}: {
  plan?: PlanDefinition;
  onSelect?: (plan: PlanDefinition) => void;
  pending?: boolean;
}) {
  const enterprise = plan ?? ENTERPRISE_PLAN;
  return (
    <div className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Enterprise
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight">{enterprise.name}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{enterprise.description}</p>
          <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            {enterprise.features.slice(0, 8).map((f) => (
              <span key={f} className="flex items-center gap-2">
                <Check className="size-3.5 shrink-0 text-brand" />
                {f}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
          <p className="text-3xl font-semibold tracking-tight">Custom</p>
          <Button
            variant="brand"
            className="rounded-xl"
            disabled={pending}
            onClick={() => onSelect?.(enterprise)}
          >
            {pending ? "Redirecting…" : enterprise.cta}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="mx-auto size-4 text-brand" />;
  if (value === false) return <Minus className="mx-auto size-4 text-muted-foreground/40" />;
  return <span className="text-xs text-muted-foreground">{value}</span>;
}

export function ComparisonTable() {
  const ids = PLAN_DEFINITIONS.map((p) => p.id);
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-border/60 bg-muted/10">
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Feature
              </th>
              {PLAN_DEFINITIONS.map((p) => (
                <th key={p.id} className="px-3 py-3 text-center text-xs font-semibold">
                  <span className={p.popular ? "text-brand" : undefined}>{p.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_GROUPS.map((group) => (
              <Fragment key={group.group}>
                <tr className="bg-brand-soft/30">
                  <td
                    colSpan={ids.length + 1}
                    className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-brand"
                  >
                    {group.group}
                  </td>
                </tr>
                {group.rows.map((row) => (
                  <tr key={`${group.group}-${row.label}`} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2.5 text-xs font-medium text-foreground">{row.label}</td>
                    {ids.map((id) => (
                      <td key={id} className="px-3 py-2.5 text-center">
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

export function CurrencySelect({
  currency,
  onChange,
  className = "",
}: {
  currency: CurrencyCode;
  onChange: (c: CurrencyCode) => void;
  className?: string;
}) {
  return (
    <Select value={currency} onValueChange={(v) => onChange(v as CurrencyCode)}>
      <SelectTrigger
        aria-label="Display currency"
        className={cn("h-9 w-[7.5rem] rounded-full border-border/60 bg-white text-xs", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {currencyList.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
