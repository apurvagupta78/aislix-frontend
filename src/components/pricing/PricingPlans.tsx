import { Fragment } from "react";
import { ArrowRight, Check, Minus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  annualBilledLabel,
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

const SALES_CTA = "Talk to Sales";
const CARD_FEATURES = 6;

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
        "inline-flex items-center rounded-full border border-border/70 bg-white p-1 shadow-sm",
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
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            cycle === c
              ? "bg-brand text-brand-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {c === "monthly" ? "Monthly" : "Annual"}
          {c === "annual" && cycle === "annual" ? (
            <span className="ml-1.5 text-xs opacity-90">Save {ANNUAL_DISCOUNT_PERCENT}%</span>
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
  return count === 1 ? singular : plural;
}

function limitLines(plan: PlanDefinition): string[] {
  if (plan.allowanceBullets?.length) return plan.allowanceBullets;
  const { audits, users, stores, masterSetups } = plan.controls;
  const first = plan.payAsYouGo
    ? "Pay per completed audit"
    : `${formatControlValue(audits.value)} audits / month`;

  return [
    first,
    users.value === null ? "Unlimited users" : `${formatControlValue(users.value)} ${singularLabel(users.value, "user", "users")}`,
    stores.value === null ? "Unlimited stores and outlets" : `${formatControlValue(stores.value)} ${singularLabel(stores.value, "store", "stores")}`,
    masterSetups.value === null
      ? "Unlimited self-service master setups"
      : `${formatControlValue(masterSetups.value)} ${singularLabel(masterSetups.value, "master setup", "master setups")}`,
  ];
}

function FeatureRow({ text }: { text: string }) {
  return (
    <li className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-2.5">
      <Check className="mt-0.5 size-4 shrink-0 text-accent-green" aria-hidden />
      <span className="text-[13px] leading-5 text-muted-foreground [overflow-wrap:break-word] [word-break:normal] hyphens-none">
        {text}
      </span>
    </li>
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
  const period = plan.periodLabel.replace(/^\//, "").trim() || "per month";
  const billed = cycle === "annual" ? annualBilledLabel(plan, currency) : null;
  const saving = annualSavingInr(plan);

  return (
    <div className="min-h-[5.75rem]">
      <p className="text-[2rem] font-semibold leading-none tracking-tight text-foreground">{amount}</p>
      <p className="mt-2 text-[13px] leading-5 text-muted-foreground">{period}</p>
      {billed ? (
        <p className="mt-1 text-xs text-muted-foreground">{billed}</p>
      ) : cycle === "annual" && saving > 0 && !plan.payAsYouGo && !plan.contactSales ? (
        <p className="mt-1 text-xs text-accent-green">Save {formatPrice(saving, currency)} / year</p>
      ) : plan.supportingText ? (
        <p className="mt-1 text-xs text-muted-foreground">{plan.supportingText}</p>
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
  const isPayg = Boolean(plan.payAsYouGo);
  const blurb = plan.description;
  const features = plan.features.slice(0, CARD_FEATURES);
  const ctaLabel = plan.cta;

  return (
    <article
      className={cn(
        "relative flex h-full min-w-0 flex-col rounded-2xl border bg-white px-6 pb-6 pt-8",
        plan.popular
          ? "border-brand shadow-[0_12px_40px_-20px_rgba(15,23,42,0.35)]"
          : "border-border/70 shadow-sm",
      )}
    >
      <div className="mb-4 flex h-6 items-center">
        {plan.popular ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-medium text-brand-foreground">
            <Sparkles className="size-3" aria-hidden />
            Most Popular
          </span>
        ) : isCurrent ? (
          <span className="text-[11px] font-medium text-muted-foreground">Current plan</span>
        ) : null}
      </div>

      <h3 className="text-lg font-semibold tracking-tight text-foreground">{plan.name}</h3>
      <p className="mt-2 line-clamp-2 min-h-10 text-[13px] leading-5 text-muted-foreground">{blurb}</p>

      <div className="mt-6">
        <PlanPrice plan={plan} cycle={cycle} currency={currency} />
      </div>

      <ul className="mt-6 space-y-2.5" aria-label={`${plan.name} plan limits`}>
        {limitLines(plan).map((line) => (
          <FeatureRow key={line} text={line} />
        ))}
      </ul>

      <ul className="mt-5 min-h-[9.75rem] flex-1 space-y-2.5 border-t border-border/50 pt-5">
        {features.map((feature) => (
          <FeatureRow key={feature} text={feature} />
        ))}
      </ul>

      <div className="mt-auto pt-6">
        <Button
          variant={plan.popular || isPayg ? "brand" : "subtle"}
          className="h-11 w-full rounded-xl px-3 text-sm font-medium"
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
          {isCurrent ? "Current plan" : pending ? "Redirecting…" : ctaLabel}
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
    <div className="grid min-w-0 grid-cols-1 items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
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
  return (
    <section className="rounded-2xl border border-border/70 bg-white px-6 py-10 text-center shadow-sm sm:px-10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Enterprise</p>
      <h3 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        From ₹19,999/month
      </h3>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
        {ENTERPRISE_PLAN.description}
      </p>
      <ul className="mx-auto mt-8 grid max-w-3xl gap-x-10 gap-y-3 text-left sm:grid-cols-2">
        {ENTERPRISE_PLAN.allowanceBullets.concat(ENTERPRISE_PLAN.features.slice(0, 4)).map((line) => (
          <FeatureRow key={line} text={line} />
        ))}
      </ul>
      <Button
        variant="brand"
        className="mt-8 h-11 rounded-xl px-6 text-sm font-medium"
        disabled={pending}
        onClick={() => onSelect?.(ENTERPRISE_PLAN)}
      >
        {pending ? "Redirecting…" : SALES_CTA}
        <ArrowRight className="size-4" aria-hidden />
      </Button>
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
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-border/60 bg-muted/10">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Feature
              </th>
              {PLAN_DEFINITIONS.map((p) => (
                <th key={p.id} className="px-3 py-3 text-center text-sm font-semibold">
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
                    className="px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-brand"
                  >
                    {group.group}
                  </td>
                </tr>
                {group.rows.map((row) => (
                  <tr key={`${group.group}-${row.label}`} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2.5 text-sm text-foreground">{row.label}</td>
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
          "h-9 w-[7.5rem] rounded-full border-border/70 bg-white text-sm font-medium shadow-sm",
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
    <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
      <Button variant="subtle" className="h-11 rounded-xl px-5 text-sm font-medium" onClick={onCompare}>
        Compare every feature
        <ArrowRight className="size-4" aria-hidden />
      </Button>
      <Button variant="brand" className="h-11 rounded-xl px-5 text-sm font-medium" onClick={onSales}>
        {SALES_CTA}
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
