import { GripVertical, Plus, Settings2, Trash2 } from "lucide-react";

import { FieldChip, RoleBadge } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FieldRole, InputSchema } from "@/lib/audit-builder/field-roles";
import { buildDefaultColumnMappings, buildInputSchema } from "@/lib/audit-builder/input-schema";
import {
  createAuditColumn,
  createAuditRow,
  createManualAuditDataset,
  type AuditInputDataset,
} from "@/lib/audit-input-dataset";

const FIELD_LIBRARY: { label: string; role: FieldRole }[] = [
  { label: "Quantity", role: "auditor_input" },
  { label: "Expiry", role: "auditor_input" },
  { label: "Price", role: "auditor_input" },
  { label: "QC Status", role: "auditor_input" },
  { label: "Photos", role: "evidence" },
  { label: "Barcode", role: "reference" },
  { label: "SKU", role: "reference" },
  { label: "Remarks", role: "auditor_input" },
  { label: "Temperature", role: "auditor_input" },
  { label: "Score", role: "auditor_input" },
];

type Props = {
  dataset: AuditInputDataset;
  inputSchema: InputSchema;
  onDatasetChange: (dataset: AuditInputDataset) => void;
  onInputSchemaChange: (schema: InputSchema) => void;
};

export function SimpleScratchBuilder({
  dataset,
  inputSchema,
  onDatasetChange,
  onInputSchemaChange,
}: Props) {
  const addField = (label: string, role: FieldRole) => {
    const column = { ...createAuditColumn(dataset.columns.length + 1), name: label };
    const nextDataset = {
      ...dataset,
      source: "manual" as const,
      columns: [...dataset.columns, column],
      rows:
        dataset.rows.length > 0
          ? dataset.rows.map((row) => ({
              ...row,
              values: { ...row.values, [column.id]: "" },
            }))
          : [createAuditRow([column])],
    };
    const mapping = buildDefaultColumnMappings({ ...nextDataset, columns: [column] })[0]!;
    mapping.fieldRole = role;
    mapping.columnName = label;
    const nextSchema = buildInputSchema(nextDataset, inputSchema.subjectType, [
      ...inputSchema.columnMappings,
      mapping,
    ]);
    onDatasetChange(nextDataset);
    onInputSchemaChange(nextSchema);
  };

  const removeField = (columnId: string) => {
    const nextDataset = {
      ...dataset,
      columns: dataset.columns.filter((c) => c.id !== columnId),
      rows: dataset.rows.map((row) => {
        const values = { ...row.values };
        delete values[columnId];
        return { ...row, values };
      }),
    };
    onInputSchemaChange({
      ...inputSchema,
      columnMappings: inputSchema.columnMappings.filter((m) => m.columnId !== columnId),
    });
    onDatasetChange(nextDataset.columns.length ? nextDataset : createManualAuditDataset());
  };

  const updateRole = (columnId: string, role: FieldRole) => {
    onInputSchemaChange({
      ...inputSchema,
      columnMappings: inputSchema.columnMappings.map((m) =>
        m.columnId === columnId ? { ...m, fieldRole: role } : m,
      ),
    });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50/40 p-5">
      <div>
        <h3 className="font-semibold">Create your audit</h3>
        <p className="text-sm text-muted-foreground">Tap fields to add them to your audit.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FIELD_LIBRARY.map((field) => (
          <FieldChip
            key={field.label}
            label={field.label}
            role={field.role}
            onClick={() => addField(field.label, field.role)}
          />
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-violet-300 bg-background p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Your audit
        </p>
        {!inputSchema.columnMappings.length ? (
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-8 text-sm text-muted-foreground hover:border-violet-400 hover:text-foreground"
            onClick={() => addField("Actual Quantity", "auditor_input")}
          >
            <Plus className="size-4" /> Add field
          </button>
        ) : (
          <div className="space-y-2">
            {inputSchema.columnMappings.map((mapping) => (
              <div
                key={mapping.columnId}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3"
              >
                <GripVertical className="size-4 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{mapping.columnName}</p>
                  <p className="text-xs text-muted-foreground">Auditor fills this</p>
                </div>
                <RoleBadge role={mapping.fieldRole} />
                <Select
                  value={mapping.fieldRole}
                  onValueChange={(v) => updateRole(mapping.columnId, v as FieldRole)}
                >
                  <SelectTrigger className="h-8 w-36 rounded-lg">
                    <Settings2 className="mr-1 size-3" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reference">Reference</SelectItem>
                    <SelectItem value="auditor_input">Auditor Input</SelectItem>
                    <SelectItem value="evidence">Evidence</SelectItem>
                    <SelectItem value="calculated">Calculated</SelectItem>
                    <SelectItem value="ai_suggested">AI Suggested</SelectItem>
                    <SelectItem value="human_confirmed">Human Confirmed</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => removeField(mapping.columnId)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
