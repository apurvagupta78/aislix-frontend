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
  /** True when assignment uses Universal Audit Engine field definitions */
  hasFieldDefinitions?: boolean;
};

const LEGACY_PLANOGRAM_TYPES = new Set(["planogram", "general", "fnv"]);

/** Resolve which execution adapter handles this assignment. Legacy routes redirect here. */
export function resolveAuditExecutionRoute(ctx: AuditExecutionContext): AuditExecutionRoute {
  if (ctx.templateType === "expiry_audit" || ctx.creationSource === "expiry_control") {
    return "expiry";
  }
  if (ctx.method === "ai" || ctx.method === "ai_assisted") {
    return "ai_scan";
  }
  if (ctx.hasFieldDefinitions || ctx.templateType === "custom") {
    return "universal";
  }
  if (ctx.templateType && LEGACY_PLANOGRAM_TYPES.has(ctx.templateType)) {
    return "digital";
  }
  if (ctx.templateType) {
    return "universal";
  }
  return "digital";
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
