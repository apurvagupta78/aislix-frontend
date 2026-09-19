/**
 * Single-page manual planogram entry for AI audit — fields match planogram CSV columns only.
 */

import { forwardRef, useImperativeHandle, useMemo } from "react";
import { PlanogramBuilder } from "@/components/planogram/PlanogramBuilder";
import type { ShelfCategory } from "@/lib/categories.data";
import {
  PLANOGRAM_CSV_OPTIONAL_LABEL,
  PLANOGRAM_CSV_REQUIRED_LABEL,
  type DraftRow,
  type PlanogramRow,
} from "@/lib/planogram";
import type { ScanContextState } from "@/lib/scan-context";

export type CsvPlanogramManualPanelHandle = {
  flush: () => ScanContextState;
  validate: () => string | null;
};

type Props = {
  value: ScanContextState;
  onChange: (next: ScanContextState) => void;
  categories: ShelfCategory[];
};

function toDraftRows(rows: PlanogramRow[]): DraftRow[] {
  return rows.map((row, i) => ({
    ...row,
    key: `${row.sku || row.brand}-${row.product_name}-${i}`,
  }));
}

function fromDraftRows(rows: DraftRow[]): PlanogramRow[] {
  return rows.map(({ key: _key, ...row }) => row);
}

export const CsvPlanogramManualPanel = forwardRef<CsvPlanogramManualPanelHandle, Props>(
  function CsvPlanogramManualPanel({ value, onChange, categories }, ref) {
    const draftRows = useMemo(() => toDraftRows(value.planogramRows), [value.planogramRows]);

    const prefillRow = useMemo(
      () => ({
        category: value.planogramMeta?.category?.trim() ?? "",
        sub_category: value.planogramMeta?.sub_category?.trim() ?? "",
      }),
      [value.planogramMeta?.category, value.planogramMeta?.sub_category],
    );

    useImperativeHandle(ref, () => ({
      flush: () => value,
      validate: () =>
        value.planogramRows.length === 0 ? "Add at least one product to your planogram." : null,
    }));

    return (
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Enter the same fields as the planogram CSV. Required: {PLANOGRAM_CSV_REQUIRED_LABEL}.
          Optional: {PLANOGRAM_CSV_OPTIONAL_LABEL}.
        </p>
        <PlanogramBuilder
          rows={draftRows}
          onRowsChange={(rows) =>
            onChange({
              ...value,
              planogramRows: fromDraftRows(rows),
            })
          }
          categories={categories}
          manualEntryOnly
          csvExact
          prefillRow={prefillRow}
          tableTitle="Planogram products"
          tableDescription="Each row matches one line in the planogram CSV."
        />
      </div>
    );
  },
);
