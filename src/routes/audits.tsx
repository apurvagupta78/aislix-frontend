import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarClock, ClipboardCheck, History, ListChecks, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspaceLinkCard } from "@/components/workspace/WorkspaceLinkCard";

type AuditTab = "my-work" | "all" | "reviews" | "history" | "schedules";

export const Route = createFileRoute("/audits")({
  validateSearch: (search: Record<string, unknown>): { tab: AuditTab } => ({
    tab: ["my-work", "all", "reviews", "history", "schedules"].includes(String(search.tab))
      ? (search.tab as AuditTab)
      : "my-work",
  }),
  head: () => ({ meta: [{ title: "Audits — Aislix" }] }),
  component: AuditsWorkspace,
});

function AuditsWorkspace() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <AppShell
      title="Audits"
      description="One workspace for assigned work, team audits, reviews, history and schedules."
    >
      <Tabs
        value={tab}
        onValueChange={(value) => void navigate({ search: { tab: value as AuditTab } })}
      >
        <TabsList className="mb-5 h-auto flex-wrap justify-start">
          <TabsTrigger value="my-work">My Work</TabsTrigger>
          <TabsTrigger value="all">All Audits</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tab === "my-work" ? (
          <>
            <WorkspaceLinkCard
              title="Assigned audits"
              description="Today, upcoming, overdue and returned assignments."
              to="/my-scans"
              icon={<ClipboardCheck className="size-4" />}
            />
            <WorkspaceLinkCard
              title="Expiry inspections"
              description="Mobile expiry checks and high-assurance evidence sessions."
              to="/expiry-control/my-inspections"
              icon={<ShieldCheck className="size-4" />}
            />
          </>
        ) : null}
        {tab === "all" ? (
          <>
            <WorkspaceLinkCard
              title="All audit records"
              description="Search Digital, AI-assisted and template audits."
              to="/history"
              icon={<ListChecks className="size-4" />}
            />
            <WorkspaceLinkCard
              title="Team assignments"
              description="Track assignments, owners and completion status."
              to="/assigned-scans"
              icon={<ClipboardCheck className="size-4" />}
            />
          </>
        ) : null}
        {tab === "reviews" ? (
          <>
            <WorkspaceLinkCard
              title="Review & approvals"
              description="Verify submitted audits and request rework."
              to="/assigned-scans"
              icon={<ShieldCheck className="size-4" />}
              badge="Manager"
            />
            <WorkspaceLinkCard
              title="Expiry review queue"
              description="Review packet evidence, video and quarantine status."
              to="/expiry-control/review"
              icon={<ShieldCheck className="size-4" />}
              badge="Manager"
            />
          </>
        ) : null}
        {tab === "history" ? (
          <WorkspaceLinkCard
            title="Audit history"
            description="Completed audits, comparisons, downloads and evidence."
            to="/history"
            icon={<History className="size-4" />}
          />
        ) : null}
        {tab === "schedules" ? (
          <WorkspaceLinkCard
            title="Recurring schedules"
            description="Plan repeating audits without creating another navigation page."
            to="/audit-schedules"
            icon={<CalendarClock className="size-4" />}
            badge="Manager"
          />
        ) : null}
      </div>
    </AppShell>
  );
}
