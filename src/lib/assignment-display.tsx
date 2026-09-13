import { Badge } from "@/components/ui/badge";
import type { Assignment } from "@/lib/assignments";

export function statusBadge(status: Assignment["status"]) {
  const map: Record<Assignment["status"], { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-warning/10 text-warning" },
    in_progress: { label: "In progress", className: "bg-brand-soft text-brand" },
    needs_correction: { label: "Needs correction", className: "bg-warning/15 text-warning" },
    completed: { label: "Completed", className: "bg-success/10 text-success" },
    cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
  };
  const item = map[status] ?? map.pending;
  return (
    <Badge variant="secondary" className={`rounded-full border-0 ${item.className}`}>
      {item.label}
    </Badge>
  );
}

export function formatAssignmentDueDate(value: string | null) {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
