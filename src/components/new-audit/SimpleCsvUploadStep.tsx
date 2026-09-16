import { useCallback, useState } from "react";
import { CheckCircle2, Download, Upload } from "lucide-react";

import { RoleBadge } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { InputSchema } from "@/lib/audit-builder/field-roles";
import { FIELD_ROLE_BADGE_LABELS } from "@/lib/audit-builder/ensure-field-roles";
import type { TemplateDefinition } from "@/lib/audit-builder/types";
import { downloadCsvTemplateBlob } from "@/lib/audit-builder/template-csv-merge";
import type { AuditInputDataset } from "@/lib/audit-input-dataset";
import { cn } from "@/lib/utils";

type Props = {
  dataset: AuditInputDataset;
  inputSchema: InputSchema;
  templateName?: string;
  templateDefinition?: TemplateDefinition | null;
  error: string | null;
  onUpload: (file: File) => Promise<void>;
};

export function SimpleCsvUploadStep({
  dataset,
  inputSchema,
  templateName,
  templateDefinition,
  error,
  onUpload,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        await onUpload(file);
      } finally {
        setUploading(false);
      }
    },
    [onUpload],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const uploaded = dataset.source === "csv" && dataset.columns.length > 0;

  return (
    <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
      <div>
        <h3 className="font-semibold">Upload your audit data</h3>
        <p className="text-sm text-muted-foreground">Bring the spreadsheet you already use.</p>
      </div>

      {!uploaded ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-background px-6 py-10 text-center",
            dragging ? "border-emerald-500 bg-emerald-50" : "border-border",
          )}
        >
          <Upload className="mb-3 size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Drag & drop CSV or Excel</p>
          <p className="mt-1 text-xs text-muted-foreground">.csv, .xlsx supported</p>
          <Button variant="outline" size="sm" className="mt-4 rounded-xl" asChild disabled={uploading}>
            <label className="cursor-pointer">
              Choose file
              <input
                type="file"
                className="hidden"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
          {templateDefinition ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => downloadCsvTemplateBlob(templateDefinition, templateName ?? "audit")}
            >
              <Download className="mr-1 size-3.5" /> Download sample
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-300 bg-background p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="size-4" /> File uploaded
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {dataset.filename ?? "Spreadsheet"} · {dataset.rows.length} rows · {dataset.columns.length}{" "}
            columns
          </p>
          <Button variant="outline" size="sm" className="mt-3 rounded-xl" asChild>
            <label className="cursor-pointer">
              Replace file
              <input
                type="file"
                className="hidden"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
        </div>
      )}

      {uploaded ? (
        <div>
          <h4 className="mb-2 text-sm font-semibold">Review your columns</h4>
          <div className="overflow-x-auto rounded-xl border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Column</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Aislix understands it as</th>
                </tr>
              </thead>
              <tbody>
                {inputSchema.columnMappings.map((mapping) => (
                  <tr key={mapping.columnId} className="border-b border-border/60">
                    <td className="px-3 py-2 font-medium">{mapping.columnName}</td>
                    <td className="px-3 py-2">
                      <RoleBadge role={mapping.fieldRole} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {mapping.standardFieldId ?? mapping.columnName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {inputSchema.columnMappings.slice(0, 6).map((m) => (
              <Badge key={m.columnId} variant="outline" className="text-[10px]">
                {FIELD_ROLE_BADGE_LABELS[m.fieldRole]}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
          <Button variant="outline" size="sm" className="mt-2 rounded-xl" asChild>
            <label className="cursor-pointer">
              Try again
              <input
                type="file"
                className="hidden"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />
            </label>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
