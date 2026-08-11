import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  AccountSummaryPanel,
  ActivityTimeline,
  KpiCards,
  NotificationsPanel,
  Panel,
  QuickActions,
  SectionHeader,
} from "@/components/dashboard/DashboardParts";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { RecentScansTable } from "@/components/dashboard/RecentScansTable";
import { TeamAssignmentsPanel } from "@/components/dashboard/TeamAssignmentsPanel";

import { Button } from "@/components/ui/button";
import { fetchAnalytics, fetchDashboard, fetchNotifications } from "@/lib/dashboard";
import {
  DEMO_ANALYTICS,
  DEMO_DASHBOARD,
  DEMO_NOTIFICATIONS,
  DEMO_RECENT_SCANS,
  isDemoMode,
} from "@/lib/dashboard-demo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Aislix Shelf Intelligence" },
      {
        name: "description",
        content:
          "Shelf health, scan volume, stock alerts, notifications and plan usage for your retail shelf audits — all in one Aislix dashboard.",
      },
      { property: "og:title", content: "Aislix Admin Dashboard" },
      {
        property: "og:description",
        content: "Monitor shelf health, scans, alerts and plan usage across every store.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const session = useQuery({
    queryKey: ["auth-session"],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
    retry: false,
    staleTime: 30_000,
  });
  const demo = session.isSuccess && isDemoMode(session.data ?? null);
  const live = session.isSuccess && !demo;

  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: ({ signal }) => fetchDashboard(signal),
    retry: false,
    enabled: live,
  });

  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: ({ signal }) => fetchNotifications(signal),
    retry: false,
    enabled: live,
  });

  const analyticsQuery = useQuery({
    queryKey: ["analytics", "30d"],
    queryFn: ({ signal }) => fetchAnalytics("30d", signal),
    retry: false,
    enabled: live,
  });

  const dashboard = demo
    ? { data: DEMO_DASHBOARD, isPending: false, error: null, refetch: () => {} }
    : {
        data: dashboardQuery.data,
        isPending: !session.isSuccess || dashboardQuery.isPending,
        error: dashboardQuery.error,
        refetch: dashboardQuery.refetch,
      };
  const notifications = demo
    ? { data: DEMO_NOTIFICATIONS, isPending: false, error: null, refetch: () => {} }
    : {
        data: notificationsQuery.data,
        isPending: !session.isSuccess || notificationsQuery.isPending,
        error: notificationsQuery.error,
        refetch: notificationsQuery.refetch,
      };
  const analytics = demo
    ? { data: DEMO_ANALYTICS, isPending: false, error: null, refetch: () => {} }
    : {
        data: analyticsQuery.data,
        isPending: !session.isSuccess || analyticsQuery.isPending,
        error: analyticsQuery.error,
        refetch: analyticsQuery.refetch,
      };

  const name = demo ? undefined : dashboard.data?.greeting_name;

  return (
    <AppShell
      title={demo ? "Live demo dashboard" : name ? `Welcome back, ${name}` : "Dashboard"}
      description="Shelf performance, scan activity and account health across your stores."
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
              <Link to="/scan">Start new scan</Link>
            </Button>
          </>
        )
      }
    >
      {demo ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/25 bg-brand-soft px-4 py-3">
          <div className="flex items-start gap-2.5">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-brand" />
            <p className="text-sm text-brand">
              <span className="font-semibold">You're viewing a live demo</span> with sample retail
              data. Create a free account to scan your own shelves — 3 free scans every day.
            </p>
          </div>
          <Button asChild variant="brand" size="sm" className="rounded-xl">
            <Link to="/signup">Get started free</Link>
          </Button>
        </div>
      ) : null}
      <KpiCards
        kpis={dashboard.data?.kpis}
        isLoading={dashboard.isPending}
        error={dashboard.error as Error | null}
        onRetry={() => void dashboard.refetch()}
      />

      <section className="mt-8">
        <SectionHeader
          title="Quick actions"
          description="Jump straight into the workflows your team uses most."
        />
        <div className="mt-4">
          <QuickActions />
        </div>
      </section>

      <section className="mt-8">
        <SectionHeader
          title="Analytics"
          description="Backend-ready widgets for shelf health, scan volume, brand mix and stock risk."
        />
        <div className="mt-4">
          <DashboardCharts
            analytics={analytics.data}
            isLoading={analytics.isPending}
            error={analytics.error as Error | null}
            onRetry={() => void analytics.refetch()}
          />
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentScansTable {...(demo ? { demoData: DEMO_RECENT_SCANS } : {})} />
        </div>
        <div className="space-y-4" id="notifications">
          <Panel title="Account summary">
            <AccountSummaryPanel
              account={dashboard.data?.account}
              isLoading={dashboard.isPending}
              error={dashboard.error as Error | null}
              onRetry={() => void dashboard.refetch()}
            />
          </Panel>
          <Panel
            title="Notifications"
            action={
              notifications.data?.unread ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
                  <Bell className="size-3" /> {notifications.data.unread} new
                </span>
              ) : undefined
            }
          >
            <NotificationsPanel
              items={notifications.data?.items}
              isLoading={notifications.isPending}
              error={notifications.error as Error | null}
              onRetry={() => void notifications.refetch()}
            />
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Recent activity" className="lg:col-span-2">
          <ActivityTimeline
            items={dashboard.data?.activity}
            isLoading={dashboard.isPending}
            error={dashboard.error as Error | null}
            onRetry={() => void dashboard.refetch()}
          />
        </Panel>
      </div>
    </AppShell>
  );
}
