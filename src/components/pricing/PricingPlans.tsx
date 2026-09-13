import { Fragment } from "react";
import { Check, Minus } from "lucide-react";
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

const FEATURE_LINES = 10;

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
    <div className={cn("inline-flex min-w-0 items-center gap-4", className)} role="group" aria-label="Billing cycle">
      {(["monthly", "annual"] as const).map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={cycle === c}
          onClick={() => onChange(c)}
          className={cn(
            "text-sm font-semibold transition-colors",
            cycle === c ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {c === "monthly" ? "Monthly" : "Annual"}
          {c === "annual" && cycle === "annual" ? (
            <span className="ml-1.5 font-medium text-accent-green">· Save {ANNUAL_DISCOUNT_PERCENT}%</span>
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

type LimitLine = { bold: string; label: string };

function buildLimitLines(plan: PlanDefinition): LimitLine[] {
  const { audits, users, stores, masterSetups } = plan.controls;

  if (plan.payAsYouGo) {
    return [
      { bold: "Pay per", label: "completed audit" },
      {
        bold: formatControlValue(users.value),
        label: singularLabel(users.value, "user", "users"),
      },
      {
        bold: formatControlValue(stores.value),
        label: singularLabel(stores.value, "store", "stores"),
      },
      {
        bold: formatControlValue(masterSetups.value),
        label: singularLabel(masterSetups.value, "master setup", "master setups"),
      },
    ];
  }

  return [
    {
      bold: formatControlValue(audits.value),
      label:
        plan.quotaPeriod === "rolling_24h" ? "AI audits / 24 hours" : "AI audits / month",
    },
    {
      bold: formatControlValue(users.value),
      label: singularLabel(users.value, "user", "users"),
    },
    {
      bold: formatControlValue(stores.value),
      label: singularLabel(stores.value, "store", "stores"),
    },
    {
      bold: formatControlValue(masterSetups.value),
      label: singularLabel(masterSetups.value, "master setup", "master setups"),
    },
  ];
}

function PlanLimits({ plan }: { plan: PlanDefinition }) {
  const lines = buildLimitLines(plan);
  return (
    <ul className="mt-5 min-w-0 space-y-1.5" aria-label={`${plan.name} plan limits`}>
      {lines.map((line) => (
        <li key={`${line.bold}-${line.label}`} className="min-w-0 text-sm leading-snug">
          <span className="font-bold tabular-nums text-foreground">{line.bold}</span>{" "}
          <span className="text-muted-foreground">{line.label}</span>
        </li>
      ))}
    </ul>
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
  const period = plan.payAsYouGo ? "per completed AI audit" : plan.periodLabel.replace(/^\//, "").trim();

  return (
    <div className="mt-4 min-w-0">
      <p className="text-3xl font-bold tracking-tight text-foreground">{amount}</p>
      {period ? <p className="mt-0.5 text-sm text-muted-foreground">{period}</p> : null}
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
  const features = plan.features.slice(0, isFree ? 8 : FEATURE_LINES);

  return (
    <article
      className={cn(
        "relative flex h-full min-w-0 flex-col py-2 xl:border-l xl:border-border/30 xl:pl-5 xl:first:border-l-0 xl:first:pl-0",
        plan.popular && "xl:-mx-1 xl:px-1",
      )}
    >
      {plan.popular ? (
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-brand">Most Popular</p>
      ) : (
        <div className="mb-2 h-[1.125rem]" aria-hidden />
      )}

      <h3 className="text-base font-bold tracking-tight text-foreground">{plan.name}</h3>
      {isCurrent ? (
        <p className="mt-0.5 text-xs font-medium text-muted-foreground">Current plan</p>
      ) : null}
      <p className="mt-1 min-h-[2.5rem] text-sm leading-snug text-muted-foreground">{plan.description}</p>

      <PlanPrice plan={plan} cycle={cycle} currency={currency} />

      {cycle === "annual" && saving > 0 && !isPayg && !plan.contactSales ? (
        <p className="mt-1 text-xs font-medium text-accent-green">
          Save {formatPrice(saving, currency)} a year
        </p>
      ) : null}

      {isPayg ? (
        <p className="mt-1 text-xs text-muted-foreground">Only completed AI audits are billed.</p>
      ) : null}

      <PlanLimits plan={plan} />

      <ul className="mt-5 min-h-[11rem] flex-1 space-y-1.5">
        {features.map((feature) => (
          <li key={feature} className="min-w-0 text-sm leading-snug text-muted-foreground">
            {feature}
          </li>
        ))}
      </ul>

      <div className="mt-auto min-w-0 pt-6">
        <button
          type="button"
          disabled={isCurrent || pending}
          onClick={() => {
            trackEvent(AnalyticsEvents.PricingPlanClick, {
              plan_id: plan.id,
              plan_name: plan.name,
              cycle,
            });
            onSelect?.(plan);
          }}
          className={cn(
            "w-full text-left text-sm font-bold transition-opacity disabled:opacity-50",
            plan.popular || isPayg ? "text-brand" : "text-foreground hover:text-brand",
          )}
        >
          {isCurrent ? "Current plan" : pending ? "Redirecting…" : `${plan.cta} →`}
        </button>
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
    <div className="grid min-w-0 grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:gap-6">
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

export function EnterpriseSection({
  onSelect,
  pending,
}: {
  onSelect?: (plan: PlanDefinition) => void;
  pending?: boolean;
}) {
  const enterprise = ENTERPRISE_PLAN;

  return (
    <section className="min-w-0 border-t border-border/40 pt-12 text-center">
      <h3 className="text-xl font-bold tracking-tight text-foreground">Enterprise</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm font-medium text-muted-foreground">
        Custom pricing for larger retail operations.
      </p>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Need more audits, stores, users, integrations or custom workflows? Talk to our team about a
        plan built around your operation.
      </p>

      <ul className="mx-auto mt-6 max-w-lg space-y-1.5 text-sm text-muted-foreground">
        {[
          "Custom AI audit volume",
          "Custom users, stores and master shelf setups",
          "Advanced permissions · SSO · API integrations",
          "Custom KPI configuration and reporting",
          "Dedicated onboarding · SLA · Account management",
        ].map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <button
        type="button"
        disabled={pending}
        onClick={() => onSelect?.(enterprise)}
        className="mt-8 text-sm font-bold text-brand hover:underline disabled:opacity-50"
      >
        {pending ? "Redirecting…" : "Talk to Sales for Custom Pricing →"}
      </button>
    </section>
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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-border/40">
            <th className="pb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Feature
            </th>
            {PLAN_DEFINITIONS.map((p) => (
              <th key={p.id} className="px-2 pb-3 text-center text-xs font-bold">
                <span className={p.popular ? "text-brand" : undefined}>{p.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON_GROUPS.map((group) => (
            <Fragment key={group.group}>
              <tr>
                <td
                  colSpan={ids.length + 1}
                  className="pt-5 pb-2 text-xs font-bold uppercase tracking-wide text-brand"
                >
                  {group.group}
                </td>
              </tr>
              {group.rows.map((row) => (
                <tr key={`${group.group}-${row.label}`} className="border-b border-border/20">
                  <td className="py-2 text-sm text-foreground">{row.label}</td>
                  {ids.map((id) => (
                    <td key={id} className="px-2 py-2 text-center">
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
        className={cn("h-8 w-auto min-w-[5.5rem] border-0 bg-transparent px-0 text-sm font-semibold shadow-none", className)}
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
    <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-10">
      <button
        type="button"
        onClick={onCompare}
        className="text-sm font-bold text-foreground hover:text-brand"
      >
        Compare Every Feature →
      </button>
      <button type="button" onClick={onSales} className="text-sm font-bold text-brand hover:underline">
        Talk to Sales →
      </button>
    </div>
  );
}
