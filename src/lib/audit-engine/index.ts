export * from "./operating-model-catalog";
export * from "./template-factory";
export * from "./completion";
export * from "./seed-templates";

export type AuditExecutionRoute = "universal" | "digital" | "ai_scan" | "expiry" | "custom";

export type AuditExecutionContext = {
  assignmentId: string;
  method: "digital" | "ai" | "ai_assisted";
  templateType?: string | null;
  operatingModel?: string | null;
  creationSource?: string | null;
};

/** Resolve which execution adapter handles this assignment. Legacy routes redirect here. */
export function resolveAuditExecutionRoute(ctx: AuditExecutionContext): AuditExecutionRoute {
  if (ctx.templateType === "expiry_audit" || ctx.creationSource === "expiry_control") {
    return "expiry";
  }
  if (ctx.method === "ai" || ctx.method === "ai_assisted") {
    return "ai_scan";
  }
  if (ctx.templateType && ctx.templateType !== "custom") {
    return "digital";
  }
  return "universal";
}

export function auditExecutionPath(
  assignmentId: string,
  route: AuditExecutionRoute,
): string {
  switch (route) {
    case "expiry":
      return `/expiry-control/inspect/${assignmentId}`;
    case "ai_scan":
      return `/scan?assignmentId=${assignmentId}`;
    case "digital":
      return `/digital-audit?assignmentId=${assignmentId}`;
    case "custom":
      return `/custom-audit?assignmentId=${assignmentId}`;
    default:
      return `/audit/${assignmentId}`;
  }
}
