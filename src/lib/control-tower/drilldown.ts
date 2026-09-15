import type { ControlTowerSearch, DrilldownLevel } from "./types";

export const DRILLDOWN_LEVELS: DrilldownLevel[] = [
  "overview",
  "kpi",
  "location",
  "category",
  "sku",
  "audit",
  "finding",
  "action",
  "evidence",
  "verification",
];

export function drilldownLabel(level: DrilldownLevel): string {
  switch (level) {
    case "overview":
      return "Overview";
    case "kpi":
      return "KPI";
    case "location":
      return "Location";
    case "category":
      return "Category";
    case "sku":
      return "SKU";
    case "audit":
      return "Audit";
    case "finding":
      return "Finding";
    case "action":
      return "Corrective Action";
    case "evidence":
      return "Evidence";
    case "verification":
      return "Verification";
    default:
      return level;
  }
}

export function buildDrilldownTrail(search: ControlTowerSearch): { level: DrilldownLevel; label: string }[] {
  const trail: { level: DrilldownLevel; label: string }[] = [{ level: "overview", label: "Control Tower" }];
  if (search.kpi) trail.push({ level: "kpi", label: search.kpi });
  if (search.location) trail.push({ level: "location", label: search.location });
  if (search.category) trail.push({ level: "category", label: search.category });
  if (search.sku) trail.push({ level: "sku", label: search.sku });
  if (search.audit) trail.push({ level: "audit", label: search.audit });
  if (search.finding) trail.push({ level: "finding", label: search.finding });
  if (search.action) trail.push({ level: "action", label: search.action });
  if (search.drill === "evidence") trail.push({ level: "evidence", label: "Evidence" });
  if (search.drill === "verification") trail.push({ level: "verification", label: "Verification" });
  return trail;
}

export function nextDrilldownSearch(
  current: ControlTowerSearch,
  level: DrilldownLevel,
  value: string,
): ControlTowerSearch {
  const next = { ...current, drill: level };
  switch (level) {
    case "kpi":
      return { ...next, kpi: value };
    case "location":
      return { ...next, location: value };
    case "category":
      return { ...next, category: value };
    case "sku":
      return { ...next, sku: value };
    case "audit":
      return { ...next, audit: value };
    case "finding":
      return { ...next, finding: value };
    case "action":
      return { ...next, action: value };
    default:
      return next;
  }
}

export function truncateDrilldownSearch(current: ControlTowerSearch, level: DrilldownLevel): ControlTowerSearch {
  const next: ControlTowerSearch = { model: current.model };
  if (level === "overview") return next;
  if (["kpi", "location", "category", "sku", "audit", "finding", "action", "evidence", "verification"].indexOf(level) >= 0) {
    if (current.kpi && level !== "overview") next.kpi = current.kpi;
  }
  if (["location", "category", "sku", "audit", "finding", "action", "evidence", "verification"].includes(level)) {
    if (current.location) next.location = current.location;
  }
  if (["category", "sku", "audit", "finding", "action", "evidence", "verification"].includes(level)) {
    if (current.category) next.category = current.category;
  }
  if (["sku", "audit", "finding", "action", "evidence", "verification"].includes(level)) {
    if (current.sku) next.sku = current.sku;
  }
  if (["audit", "finding", "action", "evidence", "verification"].includes(level)) {
    if (current.audit) next.audit = current.audit;
  }
  if (["finding", "action", "evidence", "verification"].includes(level)) {
    if (current.finding) next.finding = current.finding;
  }
  if (["action", "evidence", "verification"].includes(level)) {
    if (current.action) next.action = current.action;
  }
  if (level === "evidence") next.drill = "evidence";
  if (level === "verification") next.drill = "verification";
  return next;
}
