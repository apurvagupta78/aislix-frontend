import type { AskAislixActionSchema } from "@/lib/ask-aislix/ask-aislix.types";
import type { z } from "zod";

type Action = z.infer<typeof AskAislixActionSchema>;

const ALLOWED_ROUTES = new Set([
  "/dashboard",
  "/findings",
  "/history",
  "/my-scans",
  "/corrective-actions",
  "/expiry-control",
  "/stores",
  "/team",
  "/assignments",
]);

export function buildViewStoreAction(storeId: string, storeName: string): Action {
  return {
    label: `View ${storeName}`,
    route: "/dashboard",
    params: { storeId },
  };
}

export function buildViewAuditAction(assignmentId: string): Action {
  return {
    label: "View Audit",
    route: "/my-scans",
    params: { assignmentId },
  };
}

export function buildViewFindingsAction(storeId?: string): Action {
  return {
    label: "View Findings",
    route: "/findings",
    params: storeId ? { storeId } : {},
  };
}

export function buildViewCorrectiveActionsAction(): Action {
  return { label: "View Corrective Actions", route: "/corrective-actions", params: {} };
}

export function sanitizeActions(actions: Action[]): Action[] {
  return actions.filter((a) => ALLOWED_ROUTES.has(a.route)).slice(0, 6);
}
