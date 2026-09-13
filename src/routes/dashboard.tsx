import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { DashboardFilterBar } from "@/components/dashboard/DashboardFilterBar";
import { DashboardRoleSelector } from "@/components/dashboard/DashboardRoleSelector";
import { BrandAnalysisSection } from "@/components/dashboard/BrandAnalysisSection";
import { CommercialImpactSection } from "@/components/dashboard/CommercialImpactSection";
import { RecentAuditsSection } from "@/components/dashboard/RecentAuditsSection";
import { StoreTeamPerformanceSection } from "@/components/dashboard/StoreTeamPerformanceSection";
import { WorkspaceManagementSection } from "@/components/dashboard/WorkspaceManagementSection";
import { QuickActions } from "@/components/dashboard/DashboardParts";
import {
  PerformanceOverTimeSection,
  RetailPerformanceSection,
  WhatNeedsAttentionSection,
  WorkspaceDashboardSkeleton,
} from "@/components/dashboard/WorkspaceDashboardView";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/States";
import { fetchDashboard } from "@/lib/dashboard";
import { DEMO_WORKSPACE_DASHBOARD, DEMO_WORKSPACE_MANAGEMENT, isDemoMode } from "@/lib/dashboard-demo";
import { DEFAULT_DASHBOARD_FILTERS, type DashboardFilterState } from "@/lib/dashboard-filters";
import { fetchWorkspaceDashboard } from "@/lib/dashboard-intelligence";
import { fetchWorkspaceManagementData } from "@/lib/dashboard-workspace-management";
import {
  applyDashboardRoleChange,
  dashboardRoleContext,
  dashboardRoleToSlug,
  parseDashboardRoleSlug,
} from "@/lib/dashboard-role-context";
import type { AuditRoleTab } from "@/lib/role-audit-ui";
import { supabase } from "@/integrations/supabase/client";

type DashboardSearch = {
  role?: string;
};

export const Route = createFileRoute("/dashboard")({
  validateSearch: (search: Record<string, unknown>): DashboardSearch => {
    if (typeof search.role !== "string" || !search.role.trim()) return {};
    return { role: search.role.trim() };
  },
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
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const urlRole = parseDashboardRoleSlug(search.role);

  const [filters, setFilters] = useState<DashboardFilterState>(() => ({
    ...DEFAULT_DASHBOARD_FILTERS,
    role: urlRole ?? DEFAULT_DASHBOARD_FILTERS.role,
  }));

  useEffect(() => {
    if (urlRole && urlRole !== filters.role) {
      setFilters((current) => applyDashboardRoleChange(current, urlRole));
    }
  }, [urlRole, filters.role]);

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

  const workspaceManagementQuery = useQuery({
    queryKey: ["workspace-management"],
    queryFn: () => fetchWorkspaceManagementData(),
    retry: false,
    enabled: live,
    staleTime: 60_000,
  });
  const workspaceManagement = demo ? DEMO_WORKSPACE_MANAGEMENT : workspaceManagementQuery.data;

  const roleContext = useMemo(() => dashboardRoleContext(filters.role), [filters.role]);

  const handleRoleChange = (role: AuditRoleTab) => {
    setFilters((current) => applyDashboardRoleChange(current, role));
    void navigate({
      search: { role: dashboardRoleToSlug(role) },
      replace: true,
    });
  };

  return (
    <AppShell
      title={demo ? "Live demo dashboard" : name ? `Welcome back, ${name}` : "Dashboard"}
      description={roleContext.subtitle}
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
              <Link to="/history">Audit History</Link>
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
      <div className="-mt-2 mb-4 space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{roleContext.title}</h2>
        <p className="text-sm text-muted-foreground">{roleContext.subtitle}</p>
      </div>

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

      <DashboardRoleSelector value={filters.role} onChange={handleRoleChange} />

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
            kri_options: [],
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
        <>
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
          {workspaceManagement ? (
            <WorkspaceManagementSection data={workspaceManagement} />
          ) : null}
          <section className="mt-8">
            <p className="mb-4 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Quick actions
            </p>
            <QuickActions />
          </section>
        </>
      ) : data ? (
        <>
          <div className="mt-4">
            <RetailPerformanceSection
              data={data.kpis}
              role={filters.role}
              isLoading={false}
            />
          </div>

          <WhatNeedsAttentionSection data={data} role={filters.role} />

          <PerformanceOverTimeSection data={data} role={filters.role} kriFilter={filters.kri} />

          <RecentAuditsSection data={data} filters={filters} onFiltersChange={setFilters} />

          <StoreTeamPerformanceSection
            data={data}
            filters={filters}
            onFiltersChange={setFilters}
          />

          <BrandAnalysisSection data={data} filters={filters} onFiltersChange={setFilters} />

          <CommercialImpactSection data={data} filters={filters} onFiltersChange={setFilters} />

          {workspaceManagement ? (
            <WorkspaceManagementSection data={workspaceManagement} />
          ) : null}

          <section className="mt-8">
            <p className="mb-4 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Quick actions
            </p>
            <QuickActions />
          </section>
        </>
      ) : null}
    </AppShell>
  );
}
