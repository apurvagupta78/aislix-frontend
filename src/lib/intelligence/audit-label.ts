/** How Intelligence names an audit: the assigned audit name when there is one, else store · category · shelf. */

export function auditShortId(scanId: string): string {
  return `AUD-${scanId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function clean(value: unknown): string | null {
  const s = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return s || null;
}

export function assignedAuditName(scopeValues: unknown): string | null {
  if (!scopeValues || typeof scopeValues !== "object" || Array.isArray(scopeValues)) return null;
  return clean((scopeValues as Record<string, unknown>).audit_name);
}

export function auditName(input: {
  assignedName?: string | null;
  store: string;
  category?: string | null;
  shelf?: string | null;
}): string {
  return clean(input.assignedName) ?? [input.store, clean(input.category), clean(input.shelf)].filter(Boolean).join(" · ");
}

export function auditDescription(input: { instructions?: unknown; notes?: unknown }): string | null {
  return clean(input.instructions) ?? clean(input.notes);
}
