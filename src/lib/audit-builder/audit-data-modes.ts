import type { InputSchema } from "./field-roles";

/** How the manager defines rows and columns for a digital audit. */
export type AuditDataInputMode =
  | "template_only"
  | "upload_csv"
  | "manual"
  | "template_plus_csv"
  | "master_data";

export type DataInputModeOption = {
  value: AuditDataInputMode;
  label: string;
  description: string;
  requiresTemplate?: boolean;
  disabled?: boolean;
};

export const DATA_INPUT_MODE_OPTIONS: DataInputModeOption[] = [
  {
    value: "template_plus_csv",
    label: "Use template + upload reference CSV",
    description:
      "Template defines audit behavior; your CSV/XLSX supplies reference rows (SKU, expected qty, etc.).",
    requiresTemplate: true,
  },
  {
    value: "upload_csv",
    label: "Upload CSV / XLSX",
    description: "Build the full audit from your spreadsheet — map every column yourself.",
  },
  {
    value: "manual",
    label: "Add manually",
    description: "Define columns and rows in the app without uploading a file.",
  },
  {
    value: "template_only",
    label: "Use template fields only",
    description: "No reference file — auditors fill template fields during execution.",
    requiresTemplate: true,
  },
  {
    value: "master_data",
    label: "Use master data",
    description: "Pull reference rows from org master data (coming soon).",
    disabled: true,
  },
];

export function defaultDataInputMode(hasTemplate: boolean): AuditDataInputMode {
  return hasTemplate ? "template_plus_csv" : "upload_csv";
}

export function modesForContext(hasTemplate: boolean): DataInputModeOption[] {
  return DATA_INPUT_MODE_OPTIONS.filter((opt) => {
    if (opt.requiresTemplate && !hasTemplate) return false;
    if (opt.value === "template_plus_csv" && !hasTemplate) return false;
    return true;
  });
}

export function modeUsesDataset(mode: AuditDataInputMode): boolean {
  return mode === "upload_csv" || mode === "manual" || mode === "template_plus_csv";
}

export function validateDataDefinition(input: {
  mode: AuditDataInputMode;
  method: "digital" | "ai";
  datasetError: string | null;
  hasTemplate: boolean;
  inputSchema: InputSchema;
  rowCount: number;
}): string | null {
  if (input.method === "ai") return null;

  if (input.mode === "template_only") return null;
  if (input.mode === "master_data") return "Master data selection is not available yet.";

  if (input.mode === "template_plus_csv") {
    if (input.rowCount === 0) return null;
    if (input.datasetError) return input.datasetError;
    if (!input.inputSchema.columnMappings.length) {
      return "Configure at least one column before continuing.";
    }
    return null;
  }

  if (input.datasetError) return input.datasetError;
  if (!input.inputSchema.columnMappings.length) {
    return "Configure at least one column before continuing.";
  }
  if (!input.hasTemplate && input.rowCount === 0) {
    return "Add at least one data row.";
  }
  return null;
}
