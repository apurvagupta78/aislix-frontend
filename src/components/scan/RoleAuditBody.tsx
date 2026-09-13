/**
 * Role-based shelf audit results — five customer-role tabs, five KPIs each, shared sections.
 * Replaces the legacy execution/merchandising/brand/executive persona tabs.
 */

import { InventoryTable } from "@/components/scan-results/ResultParts";
import {
  ActionCenterPanel,
  CompetitorIntelPanel,
  ExecutionAuditHeader,
  ExecutionKpiStripPanel,
  FinancialImpactPanel,
  RecommendedActionsPanel,
} from "@/components/scan-results/ExecutionPhase1";
import { DemoBrandProductAnalysis } from "@/components/scan-results/DemoBrandProductAnalysis";
import { KpiVisualChartsPanel } from "@/components/scan-results/KpiVisualCharts";
import { isDemoOralCareResult } from "@/lib/demo-oral-care-planogram";
import { PlanogramSideBySidePanel } from "@/components/scan-results/PlanogramSideBySidePanel";
import { RoleTabSwitcher } from "@/components/scan-results/RoleTabSwitcher";
import { FixRescanCtaPanel } from "@/components/scan-results/RetailIntelligencePanels";
import {
  ROLE_AUDIT_SECTIONS,
  ROLE_TAB_THEME,
  roleIntroduction,
  type AuditRoleTab,
  type RoleAuditSectionKey,
} from "@/lib/role-audit-ui";
import { planogramComparisonFromResult } from "@/lib/planogram-display";
import type { PlanogramComparison } from "@/lib/planogram-compliance";
import type { ScanResult } from "@/lib/scan-results";
import { cn } from "@/lib/utils";

export type RoleAuditBodyProps = {
  data: ScanResult;
  activeRole: AuditRoleTab;
  onRoleChange: (role: AuditRoleTab) => void;
  loading?: boolean;
  compact?: boolean;
  imageUrl?: string | null;
  planogramComparison?: PlanogramComparison | null;
  financialLocked?: boolean;
  planCode?: string;
  demoMode?: boolean;
  rawData?: ScanResult;
  /** Dashboard — assignment rescan workflow */
};

export function RoleAuditBody({
  data,
  activeRole,
  onRoleChange,
  loading = false,
  compact = false,
  imageUrl,
  planogramComparison,
  financialLocked = false,
  planCode = "growth",
  demoMode = false,
  rawData,
}: RoleAuditBodyProps) {
  const theme = ROLE_TAB_THEME[activeRole];
  const source = rawData ?? data;
  const comparison = planogramComparisonFromResult(data, planogramComparison ?? null);

  const intro = roleIntroduction(activeRole);

  return (
    <>
      <div
        className={cn(
          "shrink-0 border-b pb-3",
          theme.accentBorder,
          compact ? "mb-3 space-y-2" : "mb-4 space-y-3 pb-4",
        )}
      >
        <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
          {intro}
        </p>
        <RoleTabSwitcher value={activeRole} onChange={onRoleChange} />
      </div>

      <div className={cn("space-y-3", compact ? "" : "space-y-4")}>
        {ROLE_AUDIT_SECTIONS.map((key) => (
          <SectionBlock
            key={key}
            sectionKey={key}
            data={data}
            source={source}
            activeRole={activeRole}
            theme={theme}
            loading={loading}
            compact={compact}
            imageUrl={imageUrl}
            comparison={comparison}
            financialLocked={financialLocked}
            planCode={planCode}
            demoMode={demoMode}
            intro={intro}
          />
        ))}
      </div>
    </>
  );
}

function SectionBlock({
  sectionKey,
  data,
  source,
  activeRole,
  theme,
  loading,
  compact,
  imageUrl,
  comparison,
  financialLocked,
  planCode,
  demoMode,
  intro,
}: {
  sectionKey: RoleAuditSectionKey;
  data: ScanResult;
  source: ScanResult;
  activeRole: AuditRoleTab;
  theme: (typeof ROLE_TAB_THEME)[AuditRoleTab];
  loading?: boolean;
  compact?: boolean;
  imageUrl?: string | null;
  comparison: PlanogramComparison | null;
  financialLocked?: boolean;
  planCode?: string;
  demoMode?: boolean;
  intro: string;
}) {
  switch (sectionKey) {
    case "audit_header":
      return (
        <ExecutionAuditHeader
          data={data}
          loading={loading}
          activeRole={activeRole}
          demoMode={demoMode}
        />
      );

    case "role_intro":
      return (
        <div className={cn("rounded-xl border px-4 py-3 text-sm", theme.accentBorder, theme.accentSoft)}>
          <p className={cn("font-semibold", theme.accentText)}>
            {activeRole.charAt(0).toUpperCase() + activeRole.slice(1)} audit scope
          </p>
          <p className="mt-1 text-muted-foreground leading-relaxed">{intro}</p>
        </div>
      );

    case "kpi_cards":
      return (
        <ExecutionKpiStripPanel
          data={data}
          loading={loading}
          compact={compact}
          customerType={activeRole}
          showIntro
        />
      );

    case "kpi_charts":
      return <KpiVisualChartsPanel data={data} role={activeRole} loading={loading} />;

    case "competitor_analysis":
      return isDemoOralCareResult(data) || demoMode ? (
        <DemoBrandProductAnalysis data={data} loading={loading} />
      ) : (
        <CompetitorIntelPanel snapshot={data.competitor_intel} loading={loading} />
      );

    case "planogram_side_by_side":
      return (
        <PlanogramSideBySidePanel
          data={data}
          comparison={comparison}
          imageUrl={imageUrl}
          loading={loading}
        />
      );

    case "financial_impact":
      return (
        <FinancialImpactPanel
          data={data}
          loading={loading}
          locked={financialLocked}
          planCode={planCode}
        />
      );

    case "inventory":
      return (
        <InventoryTable
          items={data.inventory?.length ? data.inventory : (source.inventory ?? [])}
          scanId={data.scan_id}
          csvUrl={source.downloads?.csv_url ?? data.downloads?.csv_url}
          loading={loading}
          scanResult={data}
        />
      );

    case "recommended_actions":
      return <RecommendedActionsPanel key={sectionKey} data={data} loading={loading} />;

    case "fix_rescan":
      return demoMode ? null : (
        <FixRescanCtaPanel scanId={data.scan_id} data={data} />
      );

    case "action_center":
      return (
        <ActionCenterPanel
          data={data}
          loading={loading}
          demoMode={demoMode}
          comparison={comparison}
        />
      );

    default:
      return null;
  }
}

/** @deprecated Legacy export — use RoleAuditBody */
export const ScanResultsBody = RoleAuditBody;
