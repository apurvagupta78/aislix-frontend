import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  CalendarClock,
  CreditCard,
  Download,
  FileText,
  Gift,
  Package,
  Receipt,
  RotateCcw,
  ScanLine,
  Sparkles,
  Tag,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { CardSkeleton, EmptyState, ErrorState, TableSkeleton } from "@/components/States";
import { ProgressRing, StatCard } from "@/components/UsageStats";
import { ComparisonTable, CycleToggle, PricingGrid } from "@/components/pricing/PricingPlans";
import { addOns, getPlan, type BillingCycle, type Plan } from "@/lib/pricing";
import {
  applyPromoCode,
  cancelSubscription,
  createCheckoutSession,
  fetchBillingOverview,
  fetchInvoices,
  formatDate,
  formatMoney,
  formatNumber,
  formatPercent,
  normalizePercent,
  remainingScans,
  resumeSubscription,
  startPaymentMethodUpdate,
  statusLabels,
  updateSubscription,
  usagePercent,
  type Invoice,
} from "@/lib/billing";

export const Route = createFileRoute("/billing")({
  head: () => ({
    meta: [
      { title: "Subscription & Billing — Aislix" },
      {
        name: "description",
        content:
          "Manage your Aislix plan, monitor scan usage, switch billing cycles, update payment methods and download GST invoices.",
      },
      { property: "og:title", content: "Subscription & billing — Aislix" },
      {
        property: "og:description",
        content: "Plans, scan usage, invoices and payment methods for your Aislix workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Billing,
});

const statusTone: Record<string, string> = {
  active: "bg-accent-green/12 text-accent-green hover:bg-accent-green/12",
  trialing: "bg-brand-soft text-brand hover:bg-brand-soft",
  past_due: "bg-warning/12 text-warning hover:bg-warning/12",
  cancelled: "bg-destructive/10 text-destructive hover:bg-destructive/10",
  paused: "bg-muted text-muted-foreground hover:bg-muted",
};

const invoiceTone: Record<Invoice["status"], string> = {
  paid: "bg-accent-green/12 text-accent-green hover:bg-accent-green/12",
  due: "bg-warning/12 text-warning hover:bg-warning/12",
  failed: "bg-destructive/10 text-destructive hover:bg-destructive/10",
  refunded: "bg-muted text-muted-foreground hover:bg-muted",
};

function Section({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card-surface p-5 sm:p-6 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Billing() {
  const queryClient = useQueryClient();
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [promo, setPromo] = useState("");
  const [pendingPlanId, setPendingPlanId] = useState<Plan["id"] | null>(null);
  const [invoicePage, setInvoicePage] = useState(1);

  const overviewQuery = useQuery({
    queryKey: ["billing", "overview"],
    queryFn: ({ signal }) => fetchBillingOverview(signal),
    retry: false,
  });

  const invoicesQuery = useQuery({
    queryKey: ["billing", "invoices", invoicePage],
    queryFn: ({ signal }) => fetchInvoices({ page: invoicePage, page_size: 10 }, signal),
    retry: false,
  });

  const overview = overviewQuery.data;
  const currentPlan = useMemo(() => getPlan(overview?.plan_id), [overview?.plan_id]);
  const usage = overview?.usage;
  const usedPct = usage ? usagePercent(usage) : null;
  const remaining = usage ? remainingScans(usage) : null;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["billing"] });

  const checkout = useMutation({
    mutationFn: (plan: Plan) =>
      createCheckoutSession({
        plan_id: plan.id,
        billing_cycle: cycle,
        ...(overview?.promo?.code ? { promo_code: overview.promo.code } : {}),
      }),
    onMutate: (plan) => setPendingPlanId(plan.id),
    onSettled: () => setPendingPlanId(null),
    onSuccess: (session) => {
      if (session.checkout_url) window.location.assign(session.checkout_url);
      else toast.error("Checkout is not available yet. Payments go live with Cashfree shortly.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const autoRenew = useMutation({
    mutationFn: (value: boolean) => updateSubscription({ auto_renew: value }),
    onSuccess: () => {
      toast.success("Auto renewal updated.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelSub = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => {
      toast.success("Subscription will end at the close of this billing period.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resumeSub = useMutation({
    mutationFn: resumeSubscription,
    onSuccess: () => {
      toast.success("Subscription resumed.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const promoMutation = useMutation({
    mutationFn: () => applyPromoCode(promo.trim()),
    onSuccess: (res) => {
      toast.success(`Code ${res.code} applied.${res.discount_label ? ` ${res.discount_label}` : ""}`);
      setPromo("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const paymentMethod = useMutation({
    mutationFn: startPaymentMethodUpdate,
    onSuccess: (res) => {
      if (res.redirect_url) window.location.assign(res.redirect_url);
      else toast.error("Payment method management is not available yet.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelled = overview?.status === "cancelled" || overview?.cancel_at_period_end;

  return (
    <AppShell
      title="Subscription & billing"
      description="Track scan usage, manage your plan and download GST invoices."
      actions={
        <>
          <Button asChild variant="subtle" size="sm" className="rounded-xl">
            <Link to="/pricing">View public pricing</Link>
          </Button>
          <Button asChild variant="brand" size="sm" className="rounded-xl">
            <a href="mailto:sales@aislix.com">Talk to sales</a>
          </Button>
        </>
      }
    >
      {/* Current subscription + usage */}
      {overviewQuery.isPending ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : overviewQuery.isError ? (
        <ErrorState
          title="Couldn't load your subscription"
          description={(overviewQuery.error as Error).message}
          onRetry={() => {
            void overviewQuery.refetch();
          }}
        />
      ) : !overview ? (
        <EmptyState
          title="No subscription yet"
          description="Choose a plan below to start auditing shelves with Aislix."
          icon={<Sparkles className="size-5" />}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card-surface p-5 sm:p-6 lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={`rounded-full ${statusTone[overview.status] ?? statusTone['paused']}`}>
                    {statusLabels[overview.status]}
                  </Badge>
                  {cancelled && (
                    <Badge variant="secondary" className="rounded-full text-[0.7rem]">
                      Ends {formatDate(overview.next_billing_date)}
                    </Badge>
                  )}
                </div>
                <h2 className="mt-3 text-xl font-semibold tracking-tight">
                  {overview.plan_name ?? currentPlan?.name ?? "Current plan"}
                  {typeof overview.amount_due === "number" && (
                    <span className="text-muted-foreground">
                      {" · "}
                      {formatMoney(overview.amount_due, overview.currency)} /{" "}
                      {overview.billing_cycle === "annual" ? "year" : "month"}
                    </span>
                  )}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {currentPlan?.scanLimitLabel ?? "Plan details sync from your subscription."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {cancelled ? (
                  <Button
                    variant="brand"
                    size="sm"
                    className="rounded-xl"
                    disabled={resumeSub.isPending}
                    onClick={() => resumeSub.mutate()}
                  >
                    <RotateCcw className="size-4" /> Resume subscription
                  </Button>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="subtle" size="sm" className="rounded-xl">
                        <XCircle className="size-4" /> Cancel plan
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
                        <AlertDialogDescription>
                          You keep access until {formatDate(overview.next_billing_date)}. Scan history and
                          reports stay available on the Free plan.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">Keep plan</AlertDialogCancel>
                        <AlertDialogAction
                          className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => cancelSub.mutate()}
                        >
                          Cancel subscription
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>

            <Separator className="my-6" />

            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <ProgressRing
                value={usedPct}
                size={110}
                label={usedPct === null ? "∞" : `${usedPct}%`}
                sublabel={usedPct === null ? "unlimited" : "used"}
                tone={usedPct !== null && usedPct >= 90 ? "warning" : "brand"}
              />
              <div className="min-w-0 flex-1 space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">Scans used this month</span>
                    <span className="font-medium">
                      {formatNumber(usage?.scans_used)} /{" "}
                      {usage?.scans_included ? formatNumber(usage.scans_included) : "Unlimited"}
                    </span>
                  </div>
                  <Progress value={usedPct ?? 100} className="mt-2 h-1.5 rounded-full" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Remaining scans</p>
                    <p className="mt-1 text-sm font-medium">
                      {remaining === null ? "Unlimited" : formatNumber(remaining)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Next billing date</p>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium">
                      <CalendarClock className="size-3.5 text-brand" />
                      {formatDate(overview.next_billing_date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
                  <div>
                    <Label htmlFor="auto-renew" className="text-sm font-medium">
                      Auto renewal
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Renew automatically on the next billing date.
                    </p>
                  </div>
                  <Switch
                    id="auto-renew"
                    checked={overview.auto_renew}
                    disabled={autoRenew.isPending}
                    onCheckedChange={(v) => autoRenew.mutate(v)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="card-surface p-5 sm:p-6">
              <h2 className="text-sm font-semibold tracking-tight">Payment method</h2>
              {overview.payment_method ? (
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
                  <span className="grid size-9 place-items-center rounded-lg bg-brand-soft text-brand">
                    <CreditCard className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {overview.payment_method.brand ?? "Saved method"} {overview.payment_method.label ?? ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {overview.payment_method.expiry ? `Expires ${overview.payment_method.expiry}` : "Cashfree mandate"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center text-xs text-muted-foreground">
                  No payment method on file yet.
                </p>
              )}
              <Button
                variant="subtle"
                size="sm"
                className="mt-4 w-full rounded-xl"
                disabled={paymentMethod.isPending}
                onClick={() => paymentMethod.mutate()}
              >
                {overview.payment_method ? "Update payment method" : "Add payment method"}
              </Button>

              <div className="mt-6 space-y-1 border-t border-border pt-5 text-sm">
                <p className="text-xs text-muted-foreground">Billing contact</p>
                <p className="font-medium">{overview.billing_contact?.email ?? "—"}</p>
                <p className="text-xs text-muted-foreground">
                  {overview.billing_contact?.gstin
                    ? `GSTIN ${overview.billing_contact.gstin}`
                    : "Add a GSTIN in settings for GST tax invoices"}
                </p>
              </div>
            </div>

            <div className="card-surface p-5 sm:p-6">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
                <Tag className="size-4 text-brand" /> Promo code
              </h2>
              {overview.promo ? (
                <div className="mt-4 rounded-xl bg-accent-green/10 px-4 py-3">
                  <p className="text-sm font-medium text-accent-green">{overview.promo.code}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {overview.promo.discount_label ?? overview.promo.description ?? "Applied to your next invoice."}
                  </p>
                </div>
              ) : null}
              <form
                className="mt-4 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (promo.trim()) promoMutation.mutate();
                }}
              >
                <Input
                  value={promo}
                  onChange={(e) => setPromo(e.target.value.toUpperCase())}
                  placeholder="AISLIX20"
                  className="h-9 rounded-xl"
                  aria-label="Promo code"
                />
                <Button
                  type="submit"
                  variant="brand"
                  size="sm"
                  className="rounded-xl"
                  disabled={!promo.trim() || promoMutation.isPending}
                >
                  Apply
                </Button>
              </form>
              {typeof overview.credits?.referral === "number" && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Gift className="size-3.5 text-accent-green" /> Referral credits:{" "}
                  {formatMoney(overview.credits.referral, overview.currency)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Usage analytics */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewQuery.isPending ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="Total scans this month"
              value={formatNumber(usage?.scans_used)}
              icon={<ScanLine className="size-4" />}
            />
            <StatCard
              label="Remaining scans"
              value={remaining === null ? "Unlimited" : formatNumber(remaining)}
              icon={<Package className="size-4" />}
              accent="green"
            />
            <StatCard
              label="PDF reports generated"
              value={formatNumber(usage?.pdf_reports)}
              icon={<FileText className="size-4" />}
            />
            <StatCard
              label="CSV reports generated"
              value={formatNumber(usage?.csv_reports)}
              icon={<Receipt className="size-4" />}
            />
          </>
        )}
      </div>

      {/* Plans */}
      <Section
        title="Change plan"
        description="Upgrade or downgrade at any time. Downgrades apply at the end of the current period."
        actions={<CycleToggle cycle={cycle} onChange={setCycle} />}
        className="mt-4"
      >
        <PricingGrid
          cycle={cycle}
          currentPlanId={overview?.plan_id}
          pendingPlanId={pendingPlanId}
          onSelect={(plan) => {
            if (plan.contactSales) window.location.href = "mailto:sales@aislix.com";
            else checkout.mutate(plan);
          }}
        />
      </Section>

      {/* Add-ons */}
      <Section
        title="Add-ons"
        description="Scan packs, AI credits, storage and seats — attach any of these to your plan."
        className="mt-4"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {addOns.map((a) => (
            <div key={a.id} className="card-surface card-hover p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold">{a.name}</h3>
                <Badge variant="secondary" className="rounded-full text-[0.65rem]">
                  {a.available ? "Available" : "Coming soon"}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{a.description}</p>
              <p className="mt-4 text-sm font-medium">
                {a.price} <span className="text-xs text-muted-foreground">{a.unit}</span>
              </p>
              <Button
                variant="subtle"
                size="sm"
                className="mt-4 w-full rounded-xl"
                disabled={!a.available}
                onClick={() => toast.info("Add-on purchases go live with Cashfree checkout.")}
              >
                Add to plan
              </Button>
            </div>
          ))}
        </div>
      </Section>

      {/* Invoices */}
      <Section
        title="Billing history"
        description="GST-compliant tax invoices for every payment."
        className="mt-4"
      >
        {invoicesQuery.isPending ? (
          <TableSkeleton rows={5} cols={6} />
        ) : invoicesQuery.isError ? (
          <ErrorState
            title="Couldn't load invoices"
            description={(invoicesQuery.error as Error).message}
            onRetry={() => {
              void invoicesQuery.refetch();
            }}
          />
        ) : !invoicesQuery.data?.items.length ? (
          <EmptyState
            title="No invoices yet"
            description="Invoices appear here after your first payment."
            icon={<Receipt className="size-5" />}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                    <TableHead className="text-right">PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoicesQuery.data.items.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">
                        {i.number ?? i.id}
                        {i.gst_invoice && (
                          <BadgeCheck className="ml-1.5 inline size-3.5 text-accent-green" aria-label="GST invoice" />
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(i.issued_at)}</TableCell>
                      <TableCell className="text-muted-foreground">{i.plan ?? "—"}</TableCell>
                      <TableCell className="text-right">{formatMoney(i.amount)}</TableCell>
                      <TableCell className="text-right">
                        <Badge className={`rounded-full capitalize ${invoiceTone[i.status]}`}>{i.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          asChild={Boolean(i.pdf_url)}
                          variant="ghost"
                          size="icon"
                          className="rounded-lg"
                          disabled={!i.pdf_url}
                        >
                          {i.pdf_url ? (
                            <a href={i.pdf_url} target="_blank" rel="noreferrer" aria-label={`Download ${i.id}`}>
                              <Download className="size-4" />
                            </a>
                          ) : (
                            <Download className="size-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-3 sm:hidden">
              {invoicesQuery.data.items.map((i) => (
                <div key={i.id} className="rounded-2xl border border-border bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{i.number ?? i.id}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(i.issued_at)}</p>
                    </div>
                    <Badge className={`rounded-full capitalize ${invoiceTone[i.status]}`}>{i.status}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-sm font-medium">{formatMoney(i.amount)}</p>
                    {i.pdf_url && (
                      <Button asChild variant="subtle" size="sm" className="rounded-xl">
                        <a href={i.pdf_url} target="_blank" rel="noreferrer">
                          <Download className="size-4" /> PDF
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {invoicesQuery.data.total > invoicesQuery.data.page_size && (
              <div className="mt-5 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Page {invoicesQuery.data.page} ·{" "}
                  {Math.ceil(invoicesQuery.data.total / invoicesQuery.data.page_size)} total
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="subtle"
                    size="sm"
                    className="rounded-xl"
                    disabled={invoicePage <= 1}
                    onClick={() => setInvoicePage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="subtle"
                    size="sm"
                    className="rounded-xl"
                    disabled={
                      invoicePage >= Math.ceil(invoicesQuery.data.total / invoicesQuery.data.page_size)
                    }
                    onClick={() => setInvoicePage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Section>

      {/* Quality metrics from usage */}
      {usage && (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Products detected this period"
            value={formatNumber(usage.products_detected)}
            icon={<Package className="size-4" />}
          />
          <StatCard
            label="Average AI confidence"
            value={formatPercent(usage.average_confidence)}
            icon={<Sparkles className="size-4" />}
            accent="green"
          />
          <StatCard
            label="Average shelf health"
            value={
              normalizePercent(usage.average_shelf_health) === undefined
                ? "—"
                : `${Math.round(normalizePercent(usage.average_shelf_health)!)}`
            }
            icon={<BadgeCheck className="size-4" />}
            accent="green"
          />
        </div>
      )}

      <Section title="Full plan comparison" className="mt-4">
        <ComparisonTable />
      </Section>
    </AppShell>
  );
}
