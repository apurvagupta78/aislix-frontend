import { Bell } from "lucide-react";

import {
  AccountSummaryPanel,
  KpiCards,
  NotificationsPanel,
  Panel,
  SectionHeader,
} from "@/components/dashboard/DashboardParts";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { RecentScansTable } from "@/components/dashboard/RecentScansTable";
import {
  DEMO_ANALYTICS,
  DEMO_DASHBOARD,
  DEMO_NOTIFICATIONS,
  DEMO_RECENT_SCANS,
} from "@/lib/dashboard-demo";

/**
 * Homepage showcase that renders the real Aislix dashboard widgets with the
 * shared demo dataset — no screenshot, no login, no network requests.
 */
export function HomeDashboardShowcase() {
  return (
    <section id="live-dashboard" className="scroll-mt-20 border-t border-border bg-surface py-12">
      <div className="mx-auto max-w-6xl px-5 text-center sm:px-8">
        <p className="text-xs font-medium uppercase tracking-widest text-brand">Live demo</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          The Aislix dashboard, with sample retail data.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Shelf health, scan volume, stock alerts, recent audits, notifications and plan usage —
          exactly what your team sees after signing in.
        </p>

        <div className="mt-6 overflow-hidden rounded-3xl border border-border bg-card text-left shadow-lift">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="size-2.5 rounded-full bg-muted" />
            <span className="size-2.5 rounded-full bg-muted" />
            <span className="size-2.5 rounded-full bg-muted" />
            <span className="ml-3 text-xs text-muted-foreground">aislix.com/dashboard</span>
          </div>

          <div className="max-h-[760px] overflow-auto bg-background p-3 sm:p-4">
            <KpiCards kpis={DEMO_DASHBOARD.kpis} isLoading={false} error={null} />

            <section className="mt-6">
              <SectionHeader
                title="Analytics"
                description="Shelf health, scan volume, brand mix and stock risk over the last 30 days."
              />
              <div className="mt-4">
                <DashboardCharts analytics={DEMO_ANALYTICS} isLoading={false} error={null} />
              </div>
            </section>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <RecentScansTable demoData={DEMO_RECENT_SCANS} />
              </div>
              <div className="space-y-4">
                <Panel title="Account summary">
                  <AccountSummaryPanel
                    account={DEMO_DASHBOARD.account}
                    isLoading={false}
                    error={null}
                  />
                </Panel>
                <Panel
                  title="Notifications"
                  action={
                    DEMO_NOTIFICATIONS.unread ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
                        <Bell className="size-3" /> {DEMO_NOTIFICATIONS.unread} new
                      </span>
                    ) : undefined
                  }
                >
                  <NotificationsPanel
                    items={DEMO_NOTIFICATIONS.items}
                    isLoading={false}
                    error={null}
                  />
                </Panel>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
