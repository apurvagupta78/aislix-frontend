import { Link } from "@tanstack/react-router";
import { Download } from "lucide-react";

import { PageHeader } from "@/components/design-system/PageHeader";
import { MpBadge } from "@/components/design-system/MpBadge";
import { Button } from "@/components/ui/button";
import { NEW_AUDIT_BUTTON_CLASS } from "@/lib/aislix-theme";
import type { ControlTowerDemoPayload } from "@/lib/control-tower";
import { DASHBOARD_DATE_PRESETS, type DashboardFilterState } from "@/lib/dashboard-filters";
import { DemoDataBadge } from "@/components/control-tower/DemoDataBadge";

export function ControlTowerDashboardHeader({
  data,
  filters,
  onExport,
}: {
  data?: ControlTowerDemoPayload;
  filters: DashboardFilterState;
  onExport: () => void;
}) {
  const inProgress =
    data?.auditExecutionFull.filter((a) => a.stage === "In progress").length ?? 0;
  const breaches = data?.correctiveActionHealth.overdue ?? data?.sla.breached ?? 0;
  const dateLabel =
    DASHBOARD_DATE_PRESETS.find((p) => p.value === filters.datePreset)?.label ?? "Last 7 days";
  const regionLabel =
    filters.country && filters.country !== "all" ? filters.country : "All regions";

  return (
    <PageHeader
      eyebrow="Overview"
      title="Control Tower"
      description="See what needs attention, drill in, and assign fixes — at a glance."
      meta={
        <>
          {data?.labeledDemo ? <DemoDataBadge showCta /> : null}
          {inProgress > 0 ? (
            <MpBadge tone="active" dot>
              {inProgress} audits in progress
            </MpBadge>
          ) : null}
          {breaches > 0 ? (
            <MpBadge tone="attention" dot>
              {breaches} SLA breaches
            </MpBadge>
          ) : null}
          <span className="text-[12px] text-mp-muted">
            {dateLabel} · {regionLabel}
          </span>
        </>
      }
      actions={
        <>
          <Button variant="outline" size="sm" className="rounded-lg border-line" onClick={onExport}>
            <Download className="size-4" /> Export
          </Button>
          <Button variant="default" size="sm" className="rounded-lg" asChild>
            <Link to="/findings">Review exceptions</Link>
          </Button>
          <Button variant="outline" size="sm" className={NEW_AUDIT_BUTTON_CLASS} asChild>
            <Link to="/new-audit">New Audit</Link>
          </Button>
        </>
      }
    />
  );
}
