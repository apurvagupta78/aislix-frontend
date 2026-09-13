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

const FEATURE_AREA_MIN_H = "min-h-[10.5rem]";

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
            "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all sm:px-4 sm:text-sm",
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
    <ul
      className="mt-4 min-w-0 space-y-1 border-t border-border/40 pt-4"
      aria-label={`${plan.name} plan limits`}
    >
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
      <p className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{amount}</p>
      {period ? <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{period}</p> : null}
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
  const features = plan.features.slice(0, isFree ? 8 : 10);

  return (
    <article
      className={cn(
        "relative flex h-full min-w-0 flex-col rounded-2xl border bg-white p-4 shadow-sm sm:p-5",
        plan.popular
          ? "z-10 border-2 border-brand shadow-lg ring-4 ring-brand/10 sm:scale-[1.02]"
          : isPayg
            ? "border-brand/30"
            : "border-border/60",
      )}
    >
      {plan.popular ? (
        <Badge className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand px-3 py-0.5 text-[10px] font-semibold text-brand-foreground hover:bg-brand">
          <Sparkles className="mr-1 inline size-3" aria-hidden />
          Most Popular
        </Badge>
      ) : null}

      <div className={cn("flex min-w-0 flex-col", plan.popular && "pt-1")}>
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h3 className="text-base font-bold tracking-tight text-foreground">{plan.name}</h3>
          {isCurrent ? (
            <Badge variant="secondary" className="shrink-0 rounded-full text-[10px]">
              Current
            </Badge>
          ) : null}
        </div>

        <p className="mt-1.5 min-h-[2.5rem] text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {plan.description}
        </p>

        <PlanPrice plan={plan} cycle={cycle} currency={currency} />

        {cycle === "annual" && saving > 0 && !isPayg && !plan.contactSales ? (
          <p className="mt-1 text-[11px] font-medium text-accent-green">
            Save {formatPrice(saving, currency)} a year
          </p>
        ) : null}

        {isPayg ? (
          <p className="mt-1 text-[11px] text-muted-foreground">Only completed AI audits are billed.</p>
        ) : (
          <div className="mt-1 min-h-[1rem]" aria-hidden />
        )}

        <PlanLimits plan={plan} />
      </div>

      <ul className={cn("mt-4 min-w-0 flex-1 space-y-1.5", FEATURE_AREA_MIN_H)}>
        {features.map((feature) => (
          <li key={feature} className="flex min-w-0 gap-2 text-xs leading-snug text-muted-foreground sm:text-sm">
            <Check className="mt-0.5 size-3.5 shrink-0 text-accent-green" aria-hidden />
            <span className="min-w-0 break-words [overflow-wrap:anywhere]">{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto min-w-0 pt-4">
        <Button
          variant={plan.popular || isPayg ? "brand" : isCurrent ? "soft" : "subtle"}
          className="h-10 w-full min-w-0 rounded-xl text-xs font-semibold sm:text-sm"
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
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-white/50 p-3 shadow-sm sm:p-4">
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
    <section className="min-w-0 rounded-2xl border border-border/60 bg-white p-6 shadow-sm sm:p-8">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">Enterprise</p>
        <h3 className="mt-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Custom pricing for larger retail operations.
        </h3>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Need more audits, stores, users, integrations or custom workflows? Talk to our team about a
          plan built around your operation.
        </p>
      </div>

      <ul className="mx-auto mt-6 grid min-w-0 max-w-3xl gap-x-8 gap-y-1.5 sm:grid-cols-2">
        {[
          "Custom AI audit volume",
          "Custom users, stores and master shelf setups",
          "Advanced permissions and SSO",
          "API integrations",
          "Custom KPI configuration and reporting",
          "Dedicated onboarding, SLA and account management",
        ].map((line) => (
          <li key={line} className="flex min-w-0 gap-2 text-sm text-muted-foreground">
            <Check className="mt-0.5 size-3.5 shrink-0 text-accent-green" aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col items-center gap-2">
        <Button
          variant="brand"
          className="h-11 rounded-xl px-6 text-sm font-semibold"
          disabled={pending}
          onClick={() => onSelect?.(enterprise)}
        >
          For Custom Pricing, Talk to Sales
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
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
          "h-9 w-[7.25rem] shrink-0 rounded-full border-border/60 bg-white text-xs font-semibold shadow-sm",
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
    <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
      <Button variant="subtle" className="rounded-xl text-sm font-semibold" onClick={onCompare}>
        Compare Every Feature
        <ArrowRight className="size-4" aria-hidden />
      </Button>
      <Button variant="brand" className="rounded-xl text-sm font-semibold" onClick={onSales}>
        For Custom Pricing, Talk to Sales
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
