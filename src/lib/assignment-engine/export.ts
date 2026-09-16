import type { Assignment } from "@/lib/assignments";

function csvEscape(value: string | number | undefined | null): string {
  let s = value === undefined || value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(values: (string | number | undefined | null)[]): string {
  return values.map(csvEscape).join(",");
}

export function exportAssignmentGridCsv(
  rows: Array<{
    id: string;
    store_name: string;
    assignee_name: string;
    due_at: string | null;
    status: string;
    assignment_state: string;
  }>,
  filename = "aislix-assignment-grid.csv",
  filterLabel = "all",
): void {
  const header = row([
    "Assignment ID",
    "Location",
    "Employee",
    "Due Date",
    "Status",
    "Assignment State",
  ]);
  const lines = [
    "# Aislix Assignment Grid Export",
    row(["Exported At", new Date().toISOString()]),
    row(["Status Filter", filterLabel]),
    row(["Total Records", rows.length]),
    "",
    header,
    ...rows.map((r) =>
      row([r.id, r.store_name, r.assignee_name, r.due_at, r.status, r.assignment_state]),
    ),
  ];
  const bom = "\uFEFF";
  const blob = new Blob([bom + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportAssignmentsCsv(
  assignments: Assignment[],
  filename = "aislix-assignments.csv",
): void {
  const header = row([
    "Assignment ID",
    "Store",
    "Location",
    "Assigned To",
    "Assigned By",
    "Due At",
    "Status",
    "Approval Status",
    "Compliance %",
    "Template ID",
  ]);
  const lines = [
    "# Aislix Assignment Export",
    row(["Exported At", new Date().toISOString()]),
    row(["Total Records", assignments.length]),
    "",
    header,
    ...assignments.map((a) =>
      row([
        a.id,
        a.store_name,
        a.location,
        a.assignee_name,
        a.assigner_name,
        a.due_at,
        a.status,
        a.approval_status,
        a.compliance_percent,
        a.template_id,
      ]),
    ),
  ];
  const bom = "\uFEFF";
  const blob = new Blob([bom + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
