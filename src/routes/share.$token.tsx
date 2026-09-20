/**
 * Public read-only shelf audit report.
 *
 * Anyone holding a live share token can view this page — no session required.
 * Full analytical results mirror /results via AiAuditResultsPage when the
 * scan carries structured Aislix/Astra analysis.
 */

import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/Footer";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Download,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import { AiAuditResultsPage } from "@/components/ai-audit/AiAuditResultsPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

/** Resolve share (payload as any) on the server — never self-fetch /api (breaks SSR on Lovable). */
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
          "Read-only AI shelf audit shared from Aislix: shelf execution score, planogram compliance, total facings detected and stock alerts.",
      },
      { property: "og:title", content: "Shared shelf audit report — Aislix" },
      {
        property: "og:description",
        content: "View shelf execution, compliance and total facings detected for this shelf audit.",
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
        <DemoScanResultsBody data={data} rawData={data} activeRole={role} demoMode compact onRoleChange={() => {}} />
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
      .then((payload: any) => {
        if (cancelled) return;
        if ((payload as any).kind === "demo") {
          setResolved({ report: null, demoSession: (payload as any).demoSession });
        } else if ((payload as any).kind === "report") {
          setResolved({ report: (payload as any).report, demoSession: null });
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
  const audit = report.audit_result ?? null;
  const imageUrl =
    audit?.annotated_image_url ??
    report.downloads.annotated_image_url ??
    null;

  return (
    <div className="min-h-screen bg-[#F4F7F9]">
      <header className="border-b border-[#D9E2E8] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Logo />
          <Badge variant="outline" className="rounded-full">
            Read-only shared report
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <section>
          <h1 className="text-2xl font-semibold tracking-tight text-[#102A43]">Shelf audit report</h1>
          <p className="mt-1 text-sm text-[#667085]">{context || "AI shelf audit result"}</p>
          <p className="mt-1 text-xs text-[#667085]">
            Audited {formatSharedDate(report.scanned_at)} · link expires{" "}
            {formatSharedDate(report.expires_at)}
          </p>
        </section>

        {report.downloads.pdf_url || report.downloads.annotated_image_url ? (
          <section className="rounded-2xl border border-[#D9E2E8] bg-white p-5">
            <h2 className="text-base font-semibold text-[#102A43]">Downloads</h2>
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
          <section className="rounded-2xl border border-[#D9E2E8] bg-white p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-[#102A43]">
              <ImageIcon className="size-4" /> Annotated shelf image
            </h2>
            <img
              src={report.downloads.annotated_image_url}
              alt={`Annotated shelf photo for ${report.store_name ?? "this store"}`}
              loading="lazy"
              className="mt-3 max-h-[520px] w-full rounded-xl border border-[#D9E2E8] object-contain"
            />
          </section>
        ) : null}

        {audit ? (
          <AiAuditResultsPage data={audit} imageUrl={imageUrl} />
        ) : (
          <section className="rounded-2xl border border-[#D9E2E8] bg-white p-5">
            <p className="text-sm text-[#667085]">
              Structured audit analysis is not available for this share link.
            </p>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
