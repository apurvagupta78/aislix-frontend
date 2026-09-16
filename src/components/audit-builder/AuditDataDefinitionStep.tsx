import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Columns3,
  Download,
  FileSpreadsheet,
  Rows3,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColumnConfigurationPanel } from "@/components/audit-builder/ColumnConfigurationPanel";
import {
  type AuditDataInputMode,
  modesForContext,
  modeUsesDataset,
} from "@/lib/audit-builder/audit-data-modes";
import type { InputSchema } from "@/lib/audit-builder/field-roles";
import { inferRoleFromField } from "@/lib/audit-builder/field-roles";
import { saveCustomCsvAsTemplate } from "@/lib/audit-builder/save-custom-template";
import { downloadCsvTemplateBlob } from "@/lib/audit-builder/template-csv-merge";
import type { OperatingModel, TemplateDefinition } from "@/lib/audit-builder/types";
import {
  AUDIT_DATA_TYPES,
  createAuditColumn,
  createAuditRow,
  createManualAuditDataset,
  type AuditDataType,
  type AuditInputDataset,
} from "@/lib/audit-input-dataset";
import { toUserMessage } from "@/lib/api/errors";
import type { AuditSubjectType } from "@/lib/audit-builder/types";

type Props = {
  dataInputMode: AuditDataInputMode;
  onDataInputModeChange: (mode: AuditDataInputMode) => void;
  hasTemplate: boolean;
  templateName?: string;
  templateDefinition?: TemplateDefinition | null;
  dataset: AuditInputDataset;
  inputSchema: InputSchema;
  operatingModel: OperatingModel;
  error: string | null;
  onDatasetChange: (dataset: AuditInputDataset) => void;
  onInputSchemaChange: (schema: InputSchema) => void;
  onUpload: (file: File) => Promise<void>;
};

const ROLE_BADGE: Record<string, string> = {
  reference: "REFERENCE",
  auditor_input: "AUDITOR INPUT",
  calculated: "CALCULATED",
  system: "SYSTEM",
  evidence: "EVIDENCE",
  ai_suggested: "AI SUGGESTED",
  human_confirmed: "HUMAN CONFIRMED",
};

export function AuditDataDefinitionStep({
  dataInputMode,
  onDataInputModeChange,
  hasTemplate,
  templateName,
  templateDefinition,
  dataset,
  inputSchema,
  operatingModel,
  error,
  onDatasetChange,
  onInputSchemaChange,
  onUpload,
}: Props) {
  const showDataset = modeUsesDataset(dataInputMode);
  const modeOptions = modesForContext(hasTemplate);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold">Define the audit data</h2>
        <p className="text-sm text-muted-foreground">
          How do you want to define reference rows and auditor input fields? Template behavior is
          preserved — CSV supplies data, not a replacement template.
        </p>
      </div>

      <div className="space-y-3">
        <Label>Reference / input data</Label>
        <RadioGroup
          value={dataInputMode}
          onValueChange={(v) => onDataInputModeChange(v as AuditDataInputMode)}
          className="grid gap-2 md:grid-cols-2"
        >
          {modeOptions.map((opt) => (
            <Label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${
                opt.disabled ? "cursor-not-allowed opacity-60" : ""
              } ${dataInputMode === opt.value ? "border-brand bg-brand-soft/30" : ""}`}
            >
              <RadioGroupItem value={opt.value} disabled={opt.disabled} />
              <span>
                <span className="block text-sm font-semibold">{opt.label}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {opt.description}
                </span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </div>

      {hasTemplate && templateDefinition ? (
        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium">Template fields — {templateName}</p>
              <p className="text-xs text-muted-foreground">
                These audit fields come from the template. Upload CSV to prefill reference columns.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadCsvTemplateBlob(templateDefinition, templateName ?? "audit")}
            >
              <Download className="size-4" /> Download CSV template
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {templateDefinition.fields
              .filter((f) => !f.system)
              .map((field) => {
                const role = field.fieldRole ?? inferRoleFromField(field);
                return (
                  <Badge key={field.id} variant="outline" className="text-[10px]">
                    {field.label}{" "}
                    <span className="ml-1 text-muted-foreground">
                      {ROLE_BADGE[role] ?? role.toUpperCase()}
                    </span>
                  </Badge>
                );
              })}
          </div>
        </div>
      ) : null}

      {dataInputMode === "template_only" ? (
        <Alert>
          <FileSpreadsheet className="size-4" />
          <AlertDescription>
            Auditors will fill template fields during execution. You can still assign and schedule
            without uploading reference data.
          </AlertDescription>
        </Alert>
      ) : null}

      {showDataset ? (
        <DatasetEditor
          dataset={dataset}
          inputSchema={inputSchema}
          operatingModel={operatingModel}
          error={error}
          templateName={templateName}
          templateDefinition={templateDefinition}
          onChange={onDatasetChange}
          onInputSchemaChange={onInputSchemaChange}
          onUpload={onUpload}
        />
      ) : null}
    </div>
  );
}

function DatasetEditor({
  dataset,
  inputSchema,
  operatingModel,
  error,
  templateName,
  templateDefinition,
  onChange,
  onInputSchemaChange,
  onUpload,
}: {
  dataset: AuditInputDataset;
  inputSchema: InputSchema;
  operatingModel: OperatingModel;
  error: string | null;
  templateName?: string;
  templateDefinition?: TemplateDefinition | null;
  onChange: (dataset: AuditInputDataset) => void;
  onInputSchemaChange: (schema: InputSchema) => void;
  onUpload: (file: File) => Promise<void>;
}) {
  const [templateSaveName, setTemplateSaveName] = useState(
    templateName ? `${templateName} — Custom` : "",
  );
  const saveTemplateMutation = useMutation({
    mutationFn: () =>
      saveCustomCsvAsTemplate({
        name:
          templateSaveName.trim() ||
          `Custom CSV Audit ${new Date().toLocaleDateString()}`,
        inputSchema,
        dataset,
        operatingModel,
        publish: false,
      }),
    onSuccess: (tpl) => toast.success(`Saved template "${tpl.name}" to your library.`),
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const updateColumn = (
    columnId: string,
    patch: Partial<{ name: string; type: AuditDataType }>,
  ) => {
    onChange({
      ...dataset,
      columns: dataset.columns.map((column) =>
        column.id === columnId ? { ...column, ...patch } : column,
      ),
    });
  };

  const removeColumn = (columnId: string) => {
    if (dataset.columns.length === 1) return;
    onChange({
      ...dataset,
      columns: dataset.columns.filter((column) => column.id !== columnId),
      rows: dataset.rows.map((row) => {
        const values = { ...row.values };
        delete values[columnId];
        return { ...row, values };
      }),
    });
  };

  const addColumn = () => {
    if (dataset.source !== "manual" || dataset.columns.length >= 10) return;
    const column = createAuditColumn(dataset.columns.length + 1);
    onChange({
      ...dataset,
      columns: [...dataset.columns, column],
      rows: dataset.rows.map((row) => ({
        ...row,
        values: { ...row.values, [column.id]: "" },
      })),
    });
  };

  const updateCell = (rowId: string, columnId: string, value: string) => {
    onChange({
      ...dataset,
      rows: dataset.rows.map((row) =>
        row.id === rowId ? { ...row, values: { ...row.values, [columnId]: value } } : row,
      ),
    });
  };

  return (
    <div className="rounded-xl border border-dashed p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">Upload CSV / XLSX</p>
          <p className="text-sm text-muted-foreground">
            Map columns to reference vs auditor input. Unmapped columns are kept as custom fields.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="secondary">{dataset.columns.length} columns</Badge>
            <Badge variant="secondary">{dataset.rows.length} rows</Badge>
            <Badge variant="outline">
              {dataset.source === "csv" ? "File upload" : "Manual entry"}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {templateDefinition ? (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                downloadCsvTemplateBlob(templateDefinition, templateName ?? "audit")
              }
            >
              <Download className="size-4" /> CSV template
            </Button>
          ) : null}
          {dataset.source === "csv" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onChange(createManualAuditDataset())}
            >
              Clear & enter manually
            </Button>
          ) : null}
          <Button variant="outline" asChild>
            <label>
              <Upload className="size-4" />{" "}
              {dataset.source === "csv" ? "Replace file" : "Upload CSV / XLSX"}
              <input
                className="hidden"
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void onUpload(file);
                  event.target.value = "";
                }}
              />
            </label>
          </Button>
        </div>
      </div>

      {dataset.filename ? (
        <p className="mt-3 text-sm">
          <strong>{dataset.filename}</strong> · {dataset.columns.length} columns ·{" "}
          {dataset.rows.length} rows
        </p>
      ) : null}
      {error ? (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-4 max-h-[420px] overflow-auto rounded-xl border">
        <table
          className="text-left text-xs"
          style={{ minWidth: Math.max(640, dataset.columns.length * 220 + 64) }}
        >
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              <th className="w-14 border-r p-2 text-center">#</th>
              {dataset.columns.map((column, index) => (
                <th key={column.id} className="min-w-[220px] border-r p-2 align-top">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Input
                        value={column.name}
                        onChange={(event) => updateColumn(column.id, { name: event.target.value })}
                        placeholder={`Column ${index + 1} name`}
                        aria-label={`Column ${index + 1} name`}
                        className="h-8 bg-background"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8 shrink-0"
                        disabled={dataset.columns.length === 1}
                        aria-label={`Remove ${column.name || `column ${index + 1}`}`}
                        onClick={() => removeColumn(column.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    <Select
                      value={column.type}
                      onValueChange={(value) =>
                        updateColumn(column.id, { type: value as AuditDataType })
                      }
                    >
                      <SelectTrigger className="h-8 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AUDIT_DATA_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataset.rows.map((row, rowIndex) => (
              <tr key={row.id} className="border-t">
                <td className="border-r p-2 text-center align-middle">
                  <div className="flex flex-col items-center gap-1">
                    <span>{rowIndex + 1}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      disabled={dataset.rows.length === 1}
                      aria-label={`Remove row ${rowIndex + 1}`}
                      onClick={() =>
                        onChange({
                          ...dataset,
                          rows: dataset.rows.filter((item) => item.id !== row.id),
                        })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </td>
                {dataset.columns.map((column) => (
                  <td key={column.id} className="border-r p-2">
                    <DatasetCell
                      columnType={column.type}
                      value={row.values[column.id] ?? ""}
                      label={`${column.name || "Column"} row ${rowIndex + 1}`}
                      onChange={(value) => updateCell(row.id, column.id, value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {dataset.source === "manual" ? (
          <Button
            type="button"
            variant="outline"
            disabled={dataset.columns.length >= 10}
            onClick={addColumn}
          >
            <Columns3 className="size-4" /> Add column ({dataset.columns.length}/10)
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange({ ...dataset, rows: [...dataset.rows, createAuditRow(dataset.columns)] })
          }
        >
          <Rows3 className="size-4" /> Add row
        </Button>
      </div>

      {dataset.columns.length > 0 ? (
        <div className="mt-6">
          <ColumnConfigurationPanel
            columnMappings={inputSchema.columnMappings}
            subjectType={inputSchema.subjectType}
            dataset={dataset}
            onChange={(mappings) =>
              onInputSchemaChange({ ...inputSchema, columnMappings: mappings })
            }
            onSubjectTypeChange={(subjectType: AuditSubjectType) =>
              onInputSchemaChange({ ...inputSchema, subjectType })
            }
          />
          <div className="mt-4 flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-3">
            <div className="min-w-[200px] flex-1">
              <Label className="text-xs">Save as reusable template</Label>
              <Input
                value={templateSaveName}
                onChange={(e) => setTemplateSaveName(e.target.value)}
                placeholder="e.g. ABC Foods — FNV QC Audit"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={!inputSchema.columnMappings.length || saveTemplateMutation.isPending}
              onClick={() => saveTemplateMutation.mutate()}
            >
              Save as Template
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DatasetCell({
  columnType,
  value,
  label,
  onChange,
}: {
  columnType: AuditDataType;
  value: string;
  label: string;
  onChange: (value: string) => void;
}) {
  if (columnType === "boolean") {
    return (
      <Select
        value={value || "__empty"}
        onValueChange={(next) => onChange(next === "__empty" ? "" : next)}
      >
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__empty">Not set</SelectItem>
          <SelectItem value="true">True</SelectItem>
          <SelectItem value="false">False</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  const inputType =
    columnType === "date"
      ? "date"
      : columnType === "datetime"
        ? "datetime-local"
        : columnType === "integer" || columnType === "number"
          ? "number"
          : "text";

  return (
    <Input
      type={inputType}
      step={columnType === "integer" ? 1 : columnType === "number" ? "any" : undefined}
      value={value}
      aria-label={label}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
