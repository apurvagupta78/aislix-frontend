import { useMemo, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";

import { PlanogramSetupSection } from "@/components/planogram/PlanogramSetupSection";
import type { CsvPlanogramManualPanelHandle } from "@/components/planogram/CsvPlanogramManualPanel";
import type { NewPlanogramWizardHandle } from "@/components/planogram/NewPlanogramWizard";
import type { PlanogramModeChoice } from "@/components/planogram/PlanogramModeOption";
import { useDemoCategory } from "@/components/scan/use-demo-category";
import { Button } from "@/components/ui/button";
import type { NewAuditPlanogramChoice } from "@/lib/new-audit/planogram-setup";
import { EMPTY_PLANOGRAM_META } from "@/lib/planogram-meta";
import { EMPTY_SCAN_CONTEXT, type ScanContextState } from "@/lib/scan-context";

function lockedPlanogramMode(choice: NewAuditPlanogramChoice): PlanogramModeChoice {
  return choice === "with_demo" ? "custom" : "none";
}

type Props = {
  planogramChoice: NewAuditPlanogramChoice;
  scanContext: ScanContextState;
  onScanContextChange: (ctx: ScanContextState) => void;
  onBack: () => void;
};

export function NewAuditDemoSetupPanel({
  planogramChoice,
  scanContext,
  onScanContextChange,
  onBack,
}: Props) {
  const demoCategory = useDemoCategory({ enabled: true });
  const wizardRef = useRef<NewPlanogramWizardHandle | CsvPlanogramManualPanelHandle>(null);
  const lockedMode = lockedPlanogramMode(planogramChoice);
  const [planogramMode, setPlanogramMode] = useState<PlanogramModeChoice>(lockedMode);

  const subCategoryLabel = useMemo(() => {
    const category = demoCategory.categories.find(
      (item) => item.name === demoCategory.state.categoryName,
    );
    if (demoCategory.state.subId === "others") return demoCategory.state.customSub.trim();
    return category?.subcategories?.find((item) => item.id === demoCategory.state.subId)?.label;
  }, [demoCategory.categories, demoCategory.state]);

  function mergeCategoryIntoContext(
    ctx: ScanContextState,
    categoryState: typeof demoCategory.state,
  ): ScanContextState {
    if (!categoryState.categoryName) return ctx;
    const category = demoCategory.categories.find(
      (item) => item.name === categoryState.categoryName,
    );
    const sub =
      categoryState.subId === "others"
        ? categoryState.customSub.trim()
        : (category?.subcategories?.find((item) => item.id === categoryState.subId)?.label ?? "");
    return {
      ...ctx,
      planogramMeta: {
        ...(ctx.planogramMeta ?? EMPTY_PLANOGRAM_META),
        category: categoryState.categoryName,
        sub_category: sub,
      },
    };
  }

  function handleCategoryChange(next: typeof demoCategory.state) {
    demoCategory.setState(next);
    onScanContextChange(mergeCategoryIntoContext(scanContext, next));
  }

  function handleScanContextChange(next: ScanContextState) {
    onScanContextChange(mergeCategoryIntoContext(next, demoCategory.state));
  }

  return (
    <div className="space-y-4">
      <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
        <ChevronLeft className="size-4" />
        Change planogram option
      </Button>

      <PlanogramSetupSection
        variant="dashboard"
        flowMode="upload"
        planogramMode={planogramMode}
        lockedPlanogramMode={lockedMode}
        onPlanogramModeChange={setPlanogramMode}
        scanContext={scanContext}
        onScanContextChange={handleScanContextChange}
        categories={demoCategory.categories}
        categoryName={demoCategory.state.categoryName}
        subCategoryLabel={subCategoryLabel}
        shelfCategory={{
          state: demoCategory.state,
          onChange: handleCategoryChange,
          categories: demoCategory.categories,
          helperText: "These fields are included in your shelf analysis.",
        }}
        onSyncCategoryFromContext={(ctx) => {
          const cat = ctx.planogramMeta?.category?.trim();
          const subLabel = ctx.planogramMeta?.sub_category?.trim();
          if (!cat) return;
          const category = demoCategory.categories.find((item) => item.name === cat);
          const subMatch = category?.subcategories?.find(
            (item) => item.label === subLabel || item.id === subLabel,
          );
          const next = {
            categoryName: cat,
            subId: subMatch?.id ?? (subLabel ? "others" : ""),
            customSub: subMatch ? "" : (subLabel ?? ""),
          };
          demoCategory.setState(next);
          onScanContextChange(mergeCategoryIntoContext(ctx, next));
        }}
        wizardRef={wizardRef}
        defaultCategory={demoCategory.state.categoryName}
        defaultSubCategory={subCategoryLabel}
        showInlineStart={false}
      />
    </div>
  );
}
