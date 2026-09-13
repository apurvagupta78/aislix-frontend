/**
 * Public read-only shelf audit report.
 *
 * Anyone holding a live share token can view this page — no session required.
 * All data is resolved server-side from the token, so nothing about the
 * workspace is exposed beyond this single scan.
 */

import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/Footer";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Boxes,
  Clock,
  Download,
  FileText,
  Gauge,
  Image as ImageIcon,
  PackageX,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Logo } from "@/components/Logo";
import { DemoScanResultsBody } from "@/components/scan/DemoScanResultsBody";
import { DEMO_PLANOGRAM_LABEL } from "@/lib/demo-oral-care-planogram";
import { landingToScanResult } from "@/lib/demo-execution";
import type { LandingScanResult } from "@/lib/landing-scan-api";
import { defaultAuditRoleTab } from "@/lib/role-audit-ui";
import { getPublicShare } from "@/lib/scan-share.functions";
import { formatSharedDate, type SharedScanPayload } from "@/lib/scan-share";

type ShareLoaderData = {
  report: SharedScanPayload | null;
  demoSession: LandingScanResult | null;
};

/** Resolve share payload on the server — never self-fetch /api (breaks SSR on Lovable). */
async function loadPublicShare(token: string): Promise<ShareLoaderData> {
  const trimmed = String(token ?? "").trim();
  if (!trimmed) return { report: null, demoSession: null };
  try {
    const { resolvePublicShare } = await import("@/lib/scan-share.server");
    return await resolvePublicShare(trimmed);
  } catch {
    const backendUrl =
      (typeof process !== "undefined" && process.env["AISLIX_AI_API_URL"]) ||
      (typeof process !== "undefined" && process.env["VITE_AISLIX_API_URL"]) ||
      "https://aislix-backend-production.up.railway.app";
    try {
      const res = await fetch(
        `${String(backendUrl).replace(/\/+$/, "")}/landing/session/${encodeURIComponent(trimmed)}`,
        { headers: { Accept: "application/json" } },
      );
      if (res.ok) {
        const demoSession = (await res.json()) as LandingScanResult;
        if (demoSession?.status === "completed") {
          return { report: null, demoSession };
        }
      }
    } catch {
      /* fall through */
    }
    return { report: null, demoSession: null };
  }
}

export const Route = createFileRoute("/share/$token")({
  loader: async ({ params }) => {
    try {
      return await loadPublicShare(params.token);
    } catch {
      return { report: null, demoSession: null };
    }
  },
  head: () => ({
    meta: [
      { title: "Shared shelf audit report — Aislix" },
      {
        name: "description",
        content:
          "Read-only AI shelf audit shared from Aislix: shelf execution score, planogram compliance, facings detected and stock alerts.",
      },
      { property: "og:title", content: "Shared shelf audit report — Aislix" },
      {
        property: "og:description",
        content: "View shelf execution, compliance and facings detected for this shelf audit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  errorComponent: () => <LinkProblem />,
  notFoundComponent: () => <LinkProblem />,
  component: SharedReport,
});

const percent = (value?: number | null) =>
  typeof value === "number" && Number.isFinite(value) ? `${Math.round(value)}%` : "—";

function LinkProblem() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </span>
      <h1 className="text-xl font-semibold">This share link is no longer available</h1>
      <p className="text-sm text-muted-foreground">
        The link may have expired, been revoked, or was copied incorrectly. Ask the sender for a
        fresh link.
      </p>
      <Button asChild variant="brand" className="rounded-xl">
        <Link to="/">Go to Aislix</Link>
      </Button>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card-surface rounded-2xl p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="flex size-8 items-center justify-center rounded-xl bg-muted">{icon}</span>
        <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function DemoSharedReport({ session }: { session: LandingScanResult }) {
  const data = landingToScanResult(session);
  const role = defaultAuditRoleTab("supermarket");
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            {session.has_planogram ? (
              <Badge variant="outline" className="text-[10px]">
                {DEMO_PLANOGRAM_LABEL}
              </Badge>
            ) : null}
            <Badge variant="outline" className="rounded-full">
              Public audit report
            </Badge>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <DemoScanResultsBody data={data} rawData={data} activeRole={role} demoMode compact />
      </main>
    </div>
  );
}

function SharedReport() {
  const { token } = Route.useParams();
  const loaderData = Route.useLoaderData() as ShareLoaderData;
  const fetchShare = useServerFn(getPublicShare);
  const [resolved, setResolved] = useState(loaderData);
  const [loading, setLoading] = useState(
    !loaderData.report && !loaderData.demoSession,
  );

  useEffect(() => {
    if (resolved.report || resolved.demoSession) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchShare({ data: { token } })
      .then((payload) => {
        if (cancelled) return;
        if (payload.kind === "demo") {
          setResolved({ report: null, demoSession: payload.demoSession });
        } else if (payload.kind === "report") {
          setResolved({ report: payload.report, demoSession: null });
        }
      })
      .catch(() => {
        /* keep LinkProblem state */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, resolved.report, resolved.demoSession, fetchShare]);

  const { report, demoSession } = resolved;
  if (loading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-muted-foreground">Loading shared audit report…</p>
      </div>
    );
  }
  if (demoSession) return <DemoSharedReport session={demoSession} />;
  if (!report) return <LinkProblem />;

  const context = [report.store_name, report.location, report.category, report.sub_category]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Logo />
          <Badge variant="outline" className="rounded-full">
            Read-only shared report
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <section>
          <h1 className="text-2xl font-semibold tracking-tight">Shelf audit report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {context || "AI shelf audit result"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Scanned {formatSharedDate(report.scanned_at)} · link expires{" "}
            {formatSharedDate(report.expires_at)}
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            icon={<Gauge className="size-4" />}
            label="Shelf execution"
            value={percent(report.shelf_execution_score ?? report.shelf_health_score)}
          />
          <Metric
            icon={<ShieldCheck className="size-4" />}
            label="Planogram compliance"
            value={percent(
              report.planogram_compliance?.compliance_percent ??
                report.planogram_compliance_percent,
            )}
          />
          <Metric
            icon={<Boxes className="size-4" />}
            label="Facings detected"
            value={String(report.facings_detected ?? report.products_detected)}
            hint={`${report.low_stock_count} low stock`}
          />
          <Metric
            icon={<PackageX className="size-4" />}
            label="Out of stock"
            value={String(report.out_of_stock_count)}
            hint={`On-shelf availability ${percent(report.osa_percent)}`}
          />
        </section>

        {report.executive_summary ? (
          <section className="card-surface rounded-2xl p-5">
            <h2 className="text-base font-semibold">Executive summary</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {report.executive_summary}
            </p>
          </section>
        ) : null}

        {report.downloads.pdf_url || report.downloads.annotated_image_url ? (
          <section className="card-surface rounded-2xl p-5">
            <h2 className="text-base font-semibold">Downloads</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              {report.downloads.pdf_url ? (
                <Button asChild variant="subtle" className="rounded-xl">
                  <a href={report.downloads.pdf_url} download>
                    <FileText className="size-4" /> PDF report
                  </a>
                </Button>
              ) : null}
              {report.downloads.annotated_image_url ? (
                <Button asChild variant="subtle" className="rounded-xl">
                  <a href={report.downloads.annotated_image_url} download>
                    <Download className="size-4" /> Annotated shelf image
                  </a>
                </Button>
              ) : null}
            </div>
          </section>
        ) : null}

        {report.downloads.annotated_image_url ? (
          <section className="card-surface rounded-2xl p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <ImageIcon className="size-4" /> Annotated shelf image
            </h2>
            <img
              src={report.downloads.annotated_image_url}
              alt={`Annotated shelf photo for ${report.store_name ?? "this store"}`}
              loading="lazy"
              className="mt-3 max-h-[520px] w-full rounded-xl border border-border object-contain"
            />
          </section>
        ) : null}

        <section className="card-surface rounded-2xl p-5">
          <h2 className="text-base font-semibold">Detected products</h2>
          {report.inventory.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No products were detected.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Brand</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Facings</TableHead>
                    <TableHead>Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.inventory.map((row, index) => (
                    <TableRow key={`${row.brand}-${row.product}-${index}`}>
                      <TableCell className="font-medium">{row.brand}</TableCell>
                      <TableCell>{row.product}</TableCell>
                      <TableCell className="text-muted-foreground">{row.category || "—"}</TableCell>
                      <TableCell className="text-right">{row.quantity}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full capitalize">
                          {(row.stock_status ?? "in_stock").replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        {report.planogram_compliance?.lines.length ? (
          <section className="card-surface rounded-2xl p-5">
            <h2 className="text-base font-semibold">Planogram compliance</h2>
            <div className="mt-3 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Issue</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Actual</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Severity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.planogram_compliance.lines.map((line, index) => (
                    <TableRow key={`${line.issue_type}-${index}`}>
                      <TableCell className="capitalize">
                        {line.issue_type.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell>
                        {[line.expected_brand, line.expected_product].filter(Boolean).join(" · ") ||
                          "—"}
                      </TableCell>
                      <TableCell className="text-right">{line.expected_qty ?? "—"}</TableCell>
                      <TableCell>
                        {[line.actual_brand, line.actual_product].filter(Boolean).join(" · ") || "—"}
                      </TableCell>
                      <TableCell className="text-right">{line.actual_qty ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full capitalize">
                          {line.severity}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        ) : null}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5" /> Link expires {formatSharedDate(report.expires_at)}
          </span>
          <Link to="/" className="font-medium text-foreground hover:underline">
            Powered by Aislix — AI retail shelf intelligence
          </Link>
        </footer>
      </main>
      <SiteFooter />
    </div>
  );
}
