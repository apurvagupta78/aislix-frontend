/**
 * Store / outlet list import and export (CSV). Pure helpers — no network.
 * The same headers are used for the template, the export and the import, so a
 * downloaded list can be edited and uploaded back.
 */

export const STORE_CSV_HEADERS = [
  "name",
  "store_code",
  "store_type",
  "address",
  "city",
  "state",
  "pincode",
  "country",
  "latitude",
  "longitude",
  "contact_name",
  "contact_number",
] as const;

const TEMPLATE_ROWS: string[][] = [
  [
    "Sharma Kirana",
    "OUT-001",
    "local_store",
    "Shop 4, MG Road",
    "Pune",
    "Maharashtra",
    "411001",
    "India",
    "18.51957",
    "73.85535",
    "Ramesh Sharma",
    "9876543210",
  ],
  [
    "FreshMart Bandra",
    "SM-014",
    "supermarket",
    "Hill Road, Bandra West",
    "Mumbai",
    "Maharashtra",
    "400050",
    "India",
    "",
    "",
    "",
    "",
  ],
];

const HEADER_ALIASES: Record<string, (typeof STORE_CSV_HEADERS)[number]> = {
  name: "name",
  store: "name",
  store_name: "name",
  outlet: "name",
  outlet_name: "name",
  retailer: "name",
  retailer_name: "name",
  code: "store_code",
  store_code: "store_code",
  outlet_code: "store_code",
  retailer_code: "store_code",
  type: "store_type",
  store_type: "store_type",
  outlet_type: "store_type",
  format: "store_type",
  address: "address",
  address_line1: "address",
  city: "city",
  town: "city",
  state: "state",
  pincode: "pincode",
  pin: "pincode",
  pin_code: "pincode",
  postcode: "pincode",
  zip: "pincode",
  country: "country",
  latitude: "latitude",
  lat: "latitude",
  longitude: "longitude",
  lng: "longitude",
  long: "longitude",
  lon: "longitude",
  contact_name: "contact_name",
  manager_name: "contact_name",
  owner_name: "contact_name",
  contact_number: "contact_number",
  contact_phone: "contact_number",
  phone: "contact_number",
  mobile: "contact_number",
};

const STORE_TYPE_ALIASES: Record<string, string> = {
  warehouse: "warehouse",
  supermarket: "supermarket",
  hypermarket: "supermarket",
  modern_trade: "supermarket",
  distributor: "fmcg_distributor",
  fmcg_distributor: "fmcg_distributor",
  fmcg: "fmcg_distributor",
  outlet: "outlet",
  retailer: "outlet",
  retail_outlet: "outlet",
  local_store: "local_store",
  local: "local_store",
  kirana: "local_store",
  general_store: "local_store",
  dark_store: "dark_store",
  darkstore: "dark_store",
  quick_commerce: "dark_store",
};

export function normalizeHeader(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeImportStoreType(raw: string | undefined | null): string | null {
  const key = normalizeHeader(raw ?? "");
  if (!key) return null;
  return STORE_TYPE_ALIASES[key] ?? key;
}

/** RFC 4180 CSV: quoted cells may contain commas, quotes ("") and line breaks. */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

export type StoreImportRow = {
  line: number;
  name: string;
  code: string | null;
  store_type: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  contact_name: string | null;
  contact_phone: string | null;
};

export type StoreImportIssue = { line: number; reason: string };

function coordinate(raw: string | undefined, limit: number): number | null | "invalid" {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || Math.abs(n) > limit) return "invalid";
  return n;
}

/** Map CSV text to store rows. Rows without a name or with broken coordinates are reported, not guessed. */
export function parseStoreCsv(text: string): { rows: StoreImportRow[]; issues: StoreImportIssue[] } {
  const table = parseCsvRows(text);
  if (!table.length) return { rows: [], issues: [] };
  const fields = table[0]!.map((h) => HEADER_ALIASES[normalizeHeader(h)] ?? null);
  const rows: StoreImportRow[] = [];
  const issues: StoreImportIssue[] = [];

  table.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const get = (field: (typeof STORE_CSV_HEADERS)[number]) => {
      const at = fields.indexOf(field);
      const v = at >= 0 ? (cells[at] ?? "").trim() : "";
      return v || null;
    };
    const name = get("name");
    if (!name) {
      issues.push({ line, reason: "Missing name" });
      return;
    }
    const lat = coordinate(get("latitude") ?? undefined, 90);
    const lng = coordinate(get("longitude") ?? undefined, 180);
    if (lat === "invalid" || lng === "invalid" || (lat == null) !== (lng == null)) {
      issues.push({ line, reason: "Latitude and longitude must both be valid numbers" });
      return;
    }
    rows.push({
      line,
      name,
      code: get("store_code"),
      store_type: normalizeImportStoreType(get("store_type")),
      address_line1: get("address"),
      city: get("city"),
      state: get("state"),
      pincode: get("pincode"),
      country: get("country"),
      latitude: lat,
      longitude: lng,
      contact_name: get("contact_name"),
      contact_phone: get("contact_number"),
    });
  });
  return { rows, issues };
}

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: readonly string[], rows: unknown[][]): string {
  return [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n");
}

export function storeCsvTemplate(): string {
  return toCsv(STORE_CSV_HEADERS, TEMPLATE_ROWS);
}
