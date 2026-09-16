import type { Assignment } from "@/lib/assignments";
import { StatusBadge } from "@/components/design-system/StatusBadge";

export function statusBadge(status: Assignment["status"]) {
  return <StatusBadge kind="assignment" status={status} />;
}

export function formatAssignmentDueDate(value: string | null) {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
