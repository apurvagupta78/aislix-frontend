import type { AskAislixAccessScope, AskAislixMessage, AskAislixRequest } from "@/lib/ask-aislix/ask-aislix.types";
import { resolveAskAislixQueryFilters } from "@/lib/ask-aislix/ask-aislix-filters";
import { clampFiltersToScope } from "@/lib/ask-aislix/context";
import { resolveDashboardDateBounds } from "@/lib/dashboard-filters";

export type AuditScopeSummaries = {
  assignedCount: number;
  conductedCount: number;
  assignedSample: string[];
  conductedSample: string[];
};

export function buildFilterContextJson(scope: AskAislixAccessScope): string {
  const filters = clampFiltersToScope(resolveAskAislixQueryFilters(), scope);
  const bounds = resolveDashboardDateBounds(filters);
  return JSON.stringify({
    period: filters.datePreset,
    date_from: bounds.from,
    date_to: bounds.to,
    store_id: filters.storeId,
    city: filters.city,
    country: filters.country,
    category: filters.category,
    sub_category: filters.subCategory,
    audit_assignment: filters.auditAssignment,
    authorized_store_count: scope.allowedStoreIds.length,
    authorized_cities: scope.allowedCities.slice(0, 20),
  });
}

export function summarizeAuditScope(scope: AskAislixAccessScope): AuditScopeSummaries {
  return {
    assignedCount: scope.assignedToUserAssignmentIds.length,
    conductedCount: scope.conductedScanIds.length,
    assignedSample: scope.assignedToUserAssignmentIds.slice(0, 5),
    conductedSample: scope.conductedScanIds.slice(0, 5),
  };
}

export function formatRecentConversation(messages: AskAislixMessage[] | undefined, max = 6): string {
  if (!messages?.length) return "No prior messages in this conversation.";
  return messages
    .slice(-max)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 400)}`)
    .join("\n");
}

export function buildTrustedContextBlock(
  scope: AskAislixAccessScope,
  request: AskAislixRequest,
  summaries: AuditScopeSummaries,
  storeNames: string[],
): string {
  const queryScope = buildFilterContextJson(scope);

  return [
    "CURRENT AISLIX CONTEXT",
    "",
    `USER: ${scope.role} (org membership role)`,
    "",
    "OPERATING MODEL: infer from question and audit data when relevant",
    "",
    `AUTHORIZED ORGANIZATION: org_id=${scope.orgId}; is_org_admin=${scope.isOrgAdmin}; is_manager=${scope.isManager}`,
    "",
    `AUTHORIZED LOCATION SCOPE: cities=[${scope.allowedCities.slice(0, 15).join(", ")}]; countries=[${scope.allowedCountries.slice(0, 10).join(", ")}]`,
    "",
    `AUTHORIZED STORE / SITE SCOPE: ${scope.allowedStoreIds.length} stores${storeNames.length ? ` (e.g. ${storeNames.slice(0, 5).join(", ")})` : ""}`,
    "",
    `AUTHORIZED AUDIT SCOPE: ${scope.accessibleAssignmentIds.length} accessible assignments; ${scope.accessibleScanIds.length} accessible scans`,
    "",
    `AUDITS ASSIGNED TO USER: ${summaries.assignedCount} assignment(s)${summaries.assignedSample.length ? `; sample ids: ${summaries.assignedSample.join(", ")}` : ""}`,
    "",
    `AUDITS CONDUCTED BY USER: ${summaries.conductedCount} scan(s)${summaries.conductedSample.length ? `; sample ids: ${summaries.conductedSample.join(", ")}` : ""}`,
    "",
    `DEFAULT QUERY SCOPE (independent of Control Tower filters): ${queryScope}`,
    "",
    `CURRENT DATE: ${new Date().toISOString().slice(0, 10)}`,
    "",
    `CONVERSATION CONTEXT:\n${formatRecentConversation(request.messages)}`,
    "",
    "USER QUESTION: (provided in the user message — do not expect a duplicate here)",
  ].join("\n");
}
