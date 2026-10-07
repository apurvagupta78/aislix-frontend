import { DEFAULT_DASHBOARD_FILTERS, type DashboardFilterState } from "@/lib/dashboard-filters";

/**
 * Ask Aislix query scope — intentionally independent from Control Tower dashboard filters.
 * Data access is limited by auth scope; time/location/product constraints come from the question
 * and tool arguments, not the workspace filter bar.
 */
export const ASK_AISLIX_QUERY_FILTERS: DashboardFilterState = {
  ...DEFAULT_DASHBOARD_FILTERS,
  datePreset: "90d",
  dateFrom: "",
  dateTo: "",
  country: "all",
  city: "all",
  storeId: "all",
  category: "all",
  subCategory: "all",
  teamMemberId: "all",
  auditAssignment: "all",
  kri: "all",
  skuId: "",
  itemCode: "",
  itemName: "",
};

export type AskPeriod = "7d" | "30d" | "90d" | "quarter" | "ytd";

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12,
};
const UNIT_DAYS: Record<string, number> = { day: 1, week: 7, month: 30, quarter: 91, year: 365 };

const RELATIVE_TIMEFRAME =
  /\b(?:last|past|previous|over the(?: last| past)?)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve)?\s*(day|week|month|quarter|year)s?\b/i;
const CURRENT_TIMEFRAME = /\bthis\s+(week|month|quarter|year)\b|\byear to date\b|\bytd\b/i;
/** Timeframes the tools cannot express as a single window; the model narrows from all data. */
const OPEN_TIMEFRAME = /\bsince\b|\b(19|20)\d{2}\b|\byesterday\b|\btoday\b|\ball time\b|\bbetween\b/i;

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfCurrent(unit: string, now: Date): Date {
  if (unit === "week") {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }
  if (unit === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (unit === "quarter") return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  return new Date(now.getFullYear(), 0, 1);
}

/** A timeframe written in the question overrides the period chip. */
function timeframeFromQuestion(question: string, now: Date): Partial<DashboardFilterState> | null {
  const rel = RELATIVE_TIMEFRAME.exec(question);
  if (rel) {
    const raw = rel[1]?.toLowerCase();
    const n = raw ? (Number(raw) || WORD_NUMBERS[raw] || 1) : 1;
    const from = new Date(now);
    from.setDate(from.getDate() - n * UNIT_DAYS[rel[2]!.toLowerCase()]!);
    return { datePreset: "custom", dateFrom: isoDay(from), dateTo: "" };
  }
  const cur = CURRENT_TIMEFRAME.exec(question);
  if (cur) {
    const unit = cur[1]?.toLowerCase() ?? "year";
    return { datePreset: "custom", dateFrom: isoDay(startOfCurrent(unit, now)), dateTo: "" };
  }
  if (OPEN_TIMEFRAME.test(question)) return { datePreset: "all", dateFrom: "", dateTo: "" };
  return null;
}

export function resolveAskAislixQueryFilters(
  period?: AskPeriod,
  question?: string,
  now = new Date(),
): DashboardFilterState {
  const base = { ...ASK_AISLIX_QUERY_FILTERS };
  const asked = question?.replace(/\s*\(Scope:[^)]*\)\s*$/, "") ?? "";
  const fromQuestion = asked ? timeframeFromQuestion(asked, now) : null;
  if (fromQuestion) return { ...base, ...fromQuestion };
  switch (period) {
    case "7d":
    case "30d":
    case "90d":
      return { ...base, datePreset: period };
    case "quarter":
      return { ...base, datePreset: "custom", dateFrom: isoDay(startOfCurrent("quarter", now)) };
    case "ytd":
      return { ...base, datePreset: "custom", dateFrom: isoDay(startOfCurrent("year", now)) };
    default:
      return base;
  }
}
