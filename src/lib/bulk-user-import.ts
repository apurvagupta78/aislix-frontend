/**
 * PUBLIC-SAAS bulk user onboarding — CSV / XLSX → validate → invite / update.
 *
 * Columns: Name, Email, Role, Reports To (email or name), Stores (comma-separated names or IDs)
 */

import {
  inviteUser,
  updateUser,
  userRoles,
  type AssignedStore,
  type OrgUser,
  type UserInput,
  type UserRole,
} from "@/lib/team";

export type BulkUserRow = {
  /** 1-based spreadsheet row (header = 1). */
  rowNumber: number;
  name: string;
  email: string;
  role: string;
  reportsTo: string;
  storesRaw: string;
};

export type BulkUserPreviewRow = BulkUserRow & {
  valid: boolean;
  roleNormalized: UserRole | null;
  store_ids: string[];
  reports_to_user_id: string | null;
  error?: string;
  isDuplicate?: boolean;
  existingMemberId?: string;
};

export type BulkUserValidateContext = {
  existingEmails: Set<string> | string[];
  stores: AssignedStore[];
  members: Pick<OrgUser, "id" | "user_id" | "name" | "email">[];
};

export type BulkUserValidationResult = {
  total: number;
  valid: number;
  duplicates: number;
  errors: string[];
  previewRows: BulkUserPreviewRow[];
};

export type BulkUserImportResult = {
  invited: number;
  updated: number;
  failed: number;
  errors: string[];
};

const HEADER_ALIASES: Record<string, keyof Omit<BulkUserRow, "rowNumber">> = {
  name: "name",
  "full name": "name",
  email: "email",
  "email address": "email",
  role: "role",
  "reports to": "reportsTo",
  "reports_to": "reportsTo",
  manager: "reportsTo",
  stores: "storesRaw",
  store: "storesRaw",
  "store ids": "storesRaw",
  "assigned stores": "storesRaw",
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function cell(raw: unknown): string {
  if (raw == null) return "";
  return String(raw).trim();
}

function parseCsvMatrix(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cellValue = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cellValue += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cellValue += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cellValue.trim());
      cellValue = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(cellValue.trim());
      cellValue = "";
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      continue;
    }
    cellValue += ch;
  }
  row.push(cellValue.trim());
  if (row.some((c) => c.length > 0)) rows.push(row);
  return rows;
}

function matrixToBulkRows(matrix: string[][]): BulkUserRow[] {
  if (matrix.length < 2) return [];
  const headers = (matrix[0] ?? []).map(normalizeHeader);
  const fieldIndex = new Map<keyof Omit<BulkUserRow, "rowNumber">, number>();
  headers.forEach((header, index) => {
    const field = HEADER_ALIASES[header];
    if (field && !fieldIndex.has(field)) fieldIndex.set(field, index);
  });

  if (!fieldIndex.has("email") && !fieldIndex.has("name")) {
    throw new Error(
      'Spreadsheet needs columns: Name, Email, Role, Reports To, Stores.',
    );
  }

  const out: BulkUserRow[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const cells = matrix[i] ?? [];
    const get = (field: keyof Omit<BulkUserRow, "rowNumber">) => {
      const idx = fieldIndex.get(field);
      return idx == null ? "" : cell(cells[idx]);
    };
    const name = get("name");
    const email = get("email");
    const role = get("role");
    const reportsTo = get("reportsTo");
    const storesRaw = get("storesRaw");
    if (!name && !email && !role && !reportsTo && !storesRaw) continue;
    out.push({
      rowNumber: i + 1,
      name,
      email,
      role,
      reportsTo,
      storesRaw,
    });
  }
  return out;
}

/** Parse a CSV or XLSX bulk-user file into raw rows. */
export async function parseBulkUsersFile(file: File): Promise<BulkUserRow[]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".csv") || file.type === "text/csv") {
    return matrixToBulkRows(parseCsvMatrix(await file.text()));
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]!];
    if (!sheet) throw new Error("Workbook has no sheets.");
    const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    const normalized = matrix.map((row) =>
      (row ?? []).map((c) => (c == null ? "" : String(c).trim())),
    );
    return matrixToBulkRows(normalized);
  }
  throw new Error("Upload a CSV or XLSX file.");
}

function normalizeRole(raw: string): UserRole | null {
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!key) return "member";
  const aliases: Record<string, UserRole> = {
    owner: "owner",
    admin: "admin",
    manager: "manager",
    member: "member",
    store_manager: "store_manager",
    storemanager: "store_manager",
    viewer: "viewer",
  };
  const mapped = aliases[key];
  if (mapped && userRoles.includes(mapped)) return mapped;
  return null;
}

function parseStoreTokens(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw
    .split(/[,;|]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function resolveStoreIds(
  tokens: string[],
  stores: AssignedStore[],
): { ids: string[]; missing: string[] } {
  const byId = new Map(stores.map((s) => [s.id.toLowerCase(), s.id]));
  const byName = new Map(stores.map((s) => [s.name.trim().toLowerCase(), s.id]));
  const ids: string[] = [];
  const missing: string[] = [];
  for (const token of tokens) {
    const key = token.toLowerCase();
    const id = byId.get(key) ?? byName.get(key);
    if (id) {
      if (!ids.includes(id)) ids.push(id);
    } else {
      missing.push(token);
    }
  }
  return { ids, missing };
}

function resolveReportsTo(
  raw: string,
  members: BulkUserValidateContext["members"],
  fileEmails: Map<string, string>,
): { userId: string | null; error?: string } {
  const term = raw.trim();
  if (!term) return { userId: null };

  const lower = term.toLowerCase();
  const byEmail = members.find((m) => m.email.toLowerCase() === lower);
  if (byEmail?.user_id) return { userId: byEmail.user_id };

  const byName = members.filter((m) => (m.name ?? "").trim().toLowerCase() === lower);
  if (byName.length === 1 && byName[0]!.user_id) return { userId: byName[0]!.user_id };
  if (byName.length > 1) {
    return { userId: null, error: `Reports To “${term}” matches multiple members.` };
  }

  // Manager may appear later in the same file (email only — they won't have user_id yet).
  if (fileEmails.has(lower)) {
    return {
      userId: null,
      error: `Reports To “${term}” is in this file but not yet invited — invite managers first or use an existing member.`,
    };
  }

  return { userId: null, error: `Reports To “${term}” was not found.` };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** Validate parsed rows against org stores / members; returns preview + counts. */
export function validateBulkUsers(
  rows: BulkUserRow[],
  ctx: BulkUserValidateContext,
): BulkUserValidationResult {
  const existingEmails = new Set(
    (Array.isArray(ctx.existingEmails) ? ctx.existingEmails : [...ctx.existingEmails]).map((e) =>
      e.trim().toLowerCase(),
    ),
  );
  const memberByEmail = new Map(
    ctx.members.map((m) => [m.email.trim().toLowerCase(), m] as const),
  );
  const fileEmails = new Map(
    rows
      .filter((r) => r.email.trim())
      .map((r) => [r.email.trim().toLowerCase(), r.name] as const),
  );

  const seenInFile = new Set<string>();
  const errors: string[] = [];
  const previewRows: BulkUserPreviewRow[] = [];
  let valid = 0;
  let duplicates = 0;

  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    const name = row.name.trim();
    const roleNormalized = normalizeRole(row.role);
    const issues: string[] = [];

    if (!name) issues.push("Name is required.");
    if (!email) issues.push("Email is required.");
    else if (!isValidEmail(email)) issues.push("Email is invalid.");

    if (!roleNormalized) issues.push(`Unknown role “${row.role}”.`);

    const tokens = parseStoreTokens(row.storesRaw);
    const { ids: store_ids, missing } = resolveStoreIds(tokens, ctx.stores);
    if (missing.length) issues.push(`Unknown store(s): ${missing.join(", ")}.`);
    if (
      roleNormalized &&
      roleNormalized !== "owner" &&
      roleNormalized !== "admin" &&
      store_ids.length === 0
    ) {
      issues.push("Assign at least one store.");
    }

    const reports = resolveReportsTo(row.reportsTo, ctx.members, fileEmails);
    if (reports.error) issues.push(reports.error);

    let isDuplicate = false;
    let existingMemberId: string | undefined;
    if (email) {
      if (seenInFile.has(email)) {
        isDuplicate = true;
        issues.push("Duplicate email in this file.");
      } else {
        seenInFile.add(email);
      }
      if (existingEmails.has(email)) {
        isDuplicate = true;
        existingMemberId = memberByEmail.get(email)?.id;
        // Duplicates are updatable — not a hard error unless other issues.
      }
    }

    const rowErrors = issues;
    const ok = rowErrors.length === 0;
    if (ok) valid += 1;
    if (isDuplicate) duplicates += 1;
    if (rowErrors.length) {
      for (const msg of rowErrors) errors.push(`Row ${row.rowNumber}: ${msg}`);
    }

    previewRows.push({
      ...row,
      name,
      email,
      valid: ok,
      roleNormalized,
      store_ids:
        roleNormalized === "owner" || roleNormalized === "admin" ? [] : store_ids,
      reports_to_user_id: reports.userId,
      error: rowErrors[0],
      isDuplicate,
      existingMemberId,
    });
  }

  return {
    total: rows.length,
    valid,
    duplicates,
    errors,
    previewRows,
  };
}

/** Invite new users / update existing members for every valid preview row. */
export async function importBulkUsers(
  validRows: BulkUserPreviewRow[],
): Promise<BulkUserImportResult> {
  let invited = 0;
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of validRows) {
    if (!row.valid || !row.roleNormalized) {
      failed += 1;
      errors.push(`Row ${row.rowNumber}: skipped (invalid).`);
      continue;
    }

    const input: UserInput = {
      name: row.name,
      email: row.email,
      role: row.roleNormalized,
      store_ids: row.store_ids,
      reports_to_user_id: row.reports_to_user_id,
    };

    try {
      if (row.existingMemberId) {
        await updateUser(row.existingMemberId, {
          name: input.name,
          role: input.role,
          store_ids: input.store_ids,
          reports_to_user_id: input.reports_to_user_id ?? null,
        });
        updated += 1;
      } else {
        await inviteUser(input);
        invited += 1;
      }
    } catch (err) {
      failed += 1;
      errors.push(
        `Row ${row.rowNumber} (${row.email}): ${err instanceof Error ? err.message : "Import failed."}`,
      );
    }
  }

  return { invited, updated, failed, errors };
}
