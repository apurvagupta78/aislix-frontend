import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { DashboardFilterBar } from "@/components/dashboard/DashboardFilterBar";
import {
  BrandCompetitionSection,
  PerformanceOverTimeSection,
  RecentAuditsSection,
  RetailPerformanceSection,
  StorePerformanceSection,
  WhatNeedsAttentionSection,
  WorkspaceDashboardSkeleton,
} from "@/components/dashboard/WorkspaceDashboardView";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/States";
import { fetchDashboard } from "@/lib/dashboard";
import { DEMO_WORKSPACE_DASHBOARD, isDemoMode } from "@/lib/dashboard-demo";
import { DEFAULT_DASHBOARD_FILTERS, type DashboardFilterState } from "@/lib/dashboard-filters";
import { fetchWorkspaceDashboard } from "@/lib/dashboard-intelligence";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Workspace Dashboard — Aislix" },
      {
        name: "description",
        content:
          "Operational home for shelf audits — KPIs, issues, store performance, trends and recent visits across your retail workspace.",
      },
      { property: "og:title", content: "Aislix Workspace Dashboard" },
      {
        property: "og:description",
        content: "See what's happening across your retail operation — audits, issues, improvement and store performance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [filters, setFilters] = useState<DashboardFilterState>(DEFAULT_DASHBOARD_FILTERS);

  const session = useQuery({
    queryKey: ["auth-session"],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
    retry: false,
    staleTime: 30_000,
  });

  const demo = session.isSuccess && isDemoMode(session.data ?? null);
  const live = session.isSuccess && !demo;

  const dashboardQuery = useQuery({
    queryKey: ["workspace-dashboard", filters],
    queryFn: ({ signal }) => fetchWorkspaceDashboard(filters, signal),
    retry: false,
    enabled: live,
  });

  const data = demo ? DEMO_WORKSPACE_DASHBOARD : dashboardQuery.data;
  const isLoading = demo ? false : !session.isSuccess || dashboardQuery.isPending;
  const error = demo ? null : (dashboardQuery.error as Error | null);

  const greetingQuery = useQuery({
    queryKey: ["dashboard-greeting"],
    queryFn: ({ signal }) => fetchDashboard(signal),
    retry: false,
    enabled: live,
    staleTime: 60_000,
  });
  const name = demo ? undefined : greetingQuery.data?.greeting_name;

  return (
    <AppShell
      title={demo ? "Live demo dashboard" : name ? `Welcome back, ${name}` : "Dashboard"}
      description="See what's happening across your retail operation."
      actions={
        demo ? (
          <>
            <Button asChild variant="subtle" size="sm" className="rounded-xl">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild variant="brand" size="sm" className="rounded-xl">
              <Link to="/signup">Create free account</Link>
            </Button>
          </>
        ) : (
          <>
            <Button asChild variant="subtle" size="sm" className="rounded-xl">
              <Link to="/history">Scan history</Link>
            </Button>
            <Button asChild variant="brand" size="sm" className="rounded-xl">
              <Link to="/scan">
                Start new audit <span aria-hidden>→</span>
              </Link>
            </Button>
          </>
        )
      }
    >
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">
        Track performance, find issues and see where execution is improving.
      </p>

      {demo ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/25 bg-brand-soft px-4 py-3">
          <div className="flex items-start gap-2.5">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-brand" />
            <p className="text-sm text-brand">
              <span className="font-semibold">You're viewing a live demo</span> with sample retail
              data. Create a free account to scan your own shelves.
            </p>
          </div>
          <Button asChild variant="brand" size="sm" className="rounded-xl">
            <Link to="/signup">Get started free</Link>
          </Button>
        </div>
      ) : null}

      <DashboardFilterBar
        filters={filters}
        onChange={setFilters}
        summaryLabel={data?.filter_summary.label}
        options={
          data?.filter_options ?? {
            stores: [],
            countries: [],
            cities: [],
            categories: [],
            subcategories: [],
            team_members: [],
            only_self: true,
            current_user_id: null,
          }
        }
      />

      {isLoading ? (
        <WorkspaceDashboardSkeleton />
      ) : error ? (
        <ErrorState
          title="Couldn't load dashboard"
          description={error.message}
          onRetry={() => void dashboardQuery.refetch()}
        />
      ) : data && !data.has_completed_audits && !demo ? (
        <div className="mt-8">
          <EmptyState
            title="Your dashboard will come alive after your first audit."
            description="Complete an AI shelf audit to start tracking performance, issues and improvement."
            action={
              <Button asChild variant="brand" size="sm" className="rounded-xl">
                <Link to="/scan">
                  Start new audit <span aria-hidden>→</span>
                </Link>
              </Button>
            }
          />
        </div>
      ) : data ? (
        <>
          <div className="mt-4">
            <RetailPerformanceSection data={data.kpis} isLoading={false} />
          </div>

          <WhatNeedsAttentionSection data={data} />

          <PerformanceOverTimeSection data={data} role={filters.role} />

          <BrandCompetitionSection data={data} />

          <RecentAuditsSection data={data} />

          <StorePerformanceSection data={data} />
        </>
      ) : null}
    </AppShell>
  );
}
