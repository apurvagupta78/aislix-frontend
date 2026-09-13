import { Fragment } from "react";
import { ArrowRight, Check, Minus, Sparkles } from "lucide-react";
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

/** Fixed feature-area height so CTAs align across the five main cards. */
const FEATURE_AREA_MIN_H = "min-h-[13.5rem]";

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
        "inline-flex min-w-0 items-center gap-0.5 rounded-full border border-border/60 bg-white p-1 shadow-sm",
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
            "rounded-full px-3.5 py-1.5 text-xs font-medium transition-all sm:px-4 sm:text-sm",
            cycle === c
              ? "bg-brand text-brand-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {c === "monthly" ? "Monthly" : "Annual"}
          {c === "annual" && cycle === "annual" ? (
            <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[0.65rem] font-semibold">
              Save {ANNUAL_DISCOUNT_PERCENT}%
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function formatControlValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("en-IN");
}

function singularLabel(count: number | null | undefined, singular: string, plural: string): string {
  if (count === 1) return singular;
  return plural;
}

type ControlCell = { value: string; primary: string; secondary?: string };

function buildControlCells(plan: PlanDefinition): ControlCell[] {
  const { audits, users, stores, masterSetups } = plan.controls;

  if (plan.payAsYouGo) {
    return [
      { value: "Pay per", primary: "Completed audit" },
      {
        value: formatControlValue(users.value),
        primary: singularLabel(users.value, "User", "Users"),
      },
      {
        value: formatControlValue(stores.value),
        primary: singularLabel(stores.value, "Store", "Stores"),
      },
      {
        value: formatControlValue(masterSetups.value),
        primary: singularLabel(masterSetups.value, "Master setup", "Master setups"),
      },
    ];
  }

  const auditPeriod =
    plan.quotaPeriod === "rolling_24h"
      ? "/ 24 hours"
      : audits.period === "month"
        ? "/ month"
        : undefined;

  return [
    {
      value: formatControlValue(audits.value),
      primary: "AI audits",
      secondary: auditPeriod,
    },
    {
      value: formatControlValue(users.value),
      primary: singularLabel(users.value, "User", "Users"),
    },
    {
      value: formatControlValue(stores.value),
      primary: singularLabel(stores.value, "Store", "Stores"),
    },
    {
      value: formatControlValue(masterSetups.value),
      primary: singularLabel(masterSetups.value, "Master setup", "Master setups"),
    },
  ];
}

function PlanControls({ plan }: { plan: PlanDefinition }) {
  const cells = buildControlCells(plan);

  return (
    <div
      className="mt-4 grid min-w-0 grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/50 bg-border/40"
      aria-label={`${plan.name} plan limits`}
    >
      {cells.map((cell, index) => (
        <div
          key={`${cell.primary}-${index}`}
          className="min-w-0 bg-muted/5 px-1.5 py-2.5 text-center sm:px-2 sm:py-3"
        >
          <p className="break-words text-sm font-semibold tabular-nums leading-none tracking-tight text-foreground sm:text-base">
            {cell.value}
          </p>
          <p className="mt-1.5 break-words text-[9px] font-medium uppercase leading-snug tracking-wide text-muted-foreground sm:text-[10px]">
            {cell.primary}
          </p>
          {cell.secondary ? (
            <p className="mt-0.5 text-[9px] uppercase leading-snug text-muted-foreground/80">
              {cell.secondary}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function PlanPrice({
  plan,
  cycle,
  currency,
}: {
  plan: PlanDefinition;
  cycle: BillingCycle;
  currency: CurrencyCode;
}) {
  const amount = displayPrice(plan, cycle, currency);
  const period = plan.payAsYouGo ? "/ completed AI audit" : plan.periodLabel;

  return (
    <div className="mt-4 min-w-0">
      <p className="break-words text-2xl font-semibold tracking-tight text-foreground sm:text-[1.65rem]">
        {amount}
      </p>
      {period ? (
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{period}</p>
      ) : null}
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
  const featureCount = isFree ? 8 : 10;

  return (
    <article
      className={cn(
        "relative flex h-full min-w-0 flex-col rounded-2xl border bg-white p-4 shadow-sm sm:p-5",
        plan.popular
          ? "border-2 border-brand shadow-md"
          : isPayg
            ? "border-brand/35"
            : isFree
              ? "border-border/50"
              : "border-border/60",
      )}
    >
      {plan.popular ? (
        <Badge className="absolute -top-2.5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-medium text-brand-foreground hover:bg-brand">
          <Sparkles className="mr-1 inline size-3" aria-hidden />
          Most Popular
        </Badge>
      ) : null}

      <div className={cn("flex min-w-0 flex-col", plan.popular && "pt-2")}>
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{plan.name}</h3>
          {isCurrent ? (
            <Badge variant="secondary" className="shrink-0 rounded-full text-[10px]">
              Current
            </Badge>
          ) : null}
        </div>

        <p className="mt-1.5 min-h-[2.75rem] text-xs leading-relaxed text-muted-foreground">
          {plan.description}
        </p>

        <PlanPrice plan={plan} cycle={cycle} currency={currency} />

        {cycle === "annual" && saving > 0 && !isPayg && !plan.contactSales ? (
          <p className="mt-1 text-[11px] text-accent-green">
            Save {formatPrice(saving, currency)} a year
          </p>
        ) : null}

        {isPayg ? (
          <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
            Only completed AI audits are billed.
          </p>
        ) : (
          <div className="mt-1.5 min-h-[1rem]" aria-hidden />
        )}

        <PlanControls plan={plan} />
      </div>

      <ul className={cn("mt-4 min-w-0 flex-1 space-y-2", FEATURE_AREA_MIN_H)}>
        {plan.features.slice(0, featureCount).map((feature) => (
          <li key={feature} className="flex min-w-0 gap-2 text-xs leading-snug text-muted-foreground">
            <Check className="mt-0.5 size-3.5 shrink-0 text-accent-green" aria-hidden />
            <span className="min-w-0 break-words [overflow-wrap:anywhere]">{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto min-w-0 pt-4">
        <Button
          variant={plan.popular || isPayg ? "brand" : isCurrent ? "soft" : "subtle"}
          className="h-10 w-full min-w-0 rounded-xl text-xs font-medium leading-tight sm:text-sm"
          disabled={isCurrent || pending}
          onClick={() => {
            trackEvent(AnalyticsEvents.PricingPlanClick, {
              plan_id: plan.id,
              plan_name: plan.name,
              cycle,
            });
            onSelect?.(plan);
          }}
        >
          {isCurrent ? "Current plan" : pending ? "Redirecting…" : plan.cta}
        </Button>
      </div>
    </article>
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
    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:gap-3">
      {SUBSCRIPTION_PLANS.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          cycle={cycle}
          currentPlanId={currentPlanId}
          onSelect={onSelect}
          pending={pendingPlanId === plan.id}
          currency={currency}
        />
      ))}
    </div>
  );
}

const ENTERPRISE_CONTROLS = [
  "Custom AI audit volume",
  "Custom users",
  "Custom stores",
  "Custom master shelf setups",
];

const ENTERPRISE_FEATURES = [
  "Advanced permissions",
  "SSO",
  "API integrations",
  "Custom KPI configuration",
  "Custom reporting",
  "Dedicated onboarding",
  "SLA and support",
  "Account management",
];

export function EnterpriseSection({
  onSelect,
  pending,
}: {
  onSelect?: (plan: PlanDefinition) => void;
  pending?: boolean;
}) {
  const enterprise = ENTERPRISE_PLAN;

  return (
    <div className="min-w-0 rounded-2xl border border-border/60 bg-white p-6 shadow-sm sm:p-8">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">Enterprise</p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Custom pricing for larger retail operations.
        </h3>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Need more audits, stores, users, integrations or custom workflows? Talk to our team about
          a plan built around your operation.
        </p>
      </div>

      <div className="mx-auto mt-6 grid min-w-0 max-w-4xl gap-px overflow-hidden rounded-xl border border-border/50 bg-border/40 sm:grid-cols-2 lg:grid-cols-4">
        {ENTERPRISE_CONTROLS.map((label) => (
          <div
            key={label}
            className="min-w-0 bg-muted/5 px-3 py-3 text-center text-[10px] font-medium uppercase leading-snug tracking-wide text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      <ul className="mx-auto mt-6 grid min-w-0 max-w-3xl gap-x-6 gap-y-2 sm:grid-cols-2">
        {ENTERPRISE_FEATURES.map((feature) => (
          <li key={feature} className="flex min-w-0 gap-2 text-xs leading-snug text-muted-foreground">
            <Check className="mt-0.5 size-3.5 shrink-0 text-accent-green" aria-hidden />
            <span className="min-w-0 break-words">{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col items-center gap-2">
        <Button
          variant="brand"
          className="h-11 rounded-xl px-6 text-sm font-medium"
          disabled={pending}
          onClick={() => onSelect?.(enterprise)}
        >
          Talk to Sales
          <ArrowRight className="size-4" aria-hidden />
        </Button>
        <p className="text-xs text-muted-foreground">Get Custom Pricing</p>
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
        className={cn(
          "h-9 w-[7.25rem] shrink-0 rounded-full border-border/60 bg-white text-xs",
          className,
        )}
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

export function PricingBottomActions({
  onCompare,
  onSales,
}: {
  onCompare: () => void;
  onSales: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6">
      <Button variant="subtle" className="rounded-xl text-sm" onClick={onCompare}>
        Compare Every Feature
        <ArrowRight className="size-4" aria-hidden />
      </Button>
      <Button variant="brand" className="rounded-xl text-sm" onClick={onSales}>
        Talk to Sales
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
