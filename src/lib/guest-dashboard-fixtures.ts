/** Soft design-system accents for guest KPI strip (no adjacent same accent). */
export const GUEST_KPI_CARDS = [
  {
    label: "Completion",
    value: "84%",
    detail: "42 of 50 planned audits",
    accent: "#9B86D9",
  },
  {
    label: "Evidence coverage",
    value: "91%",
    detail: "Photos attached on completed audits",
    accent: "#7DB7D6",
  },
  {
    label: "Pass rate",
    value: "78%",
    detail: "Within configured KPI targets",
    accent: "#79E2A8",
  },
  {
    label: "Open findings",
    value: "14",
    detail: "Across 6 stores this week",
    accent: "#8EC9E8",
  },
  {
    label: "Critical",
    value: "3",
    detail: "Need attention today",
    accent: "#B03A63",
  },
  {
    label: "Overdue actions",
    value: "5",
    detail: "SLA past due",
    accent: "#DBE0E5",
  },
] as const;

export const GUEST_RECENT_AUDITS = [
  {
    name: "Oral care · Aisle 7",
    store: "More Mart — Koramangala",
    status: "Completed",
    score: "91%",
    date: "Today",
  },
  {
    name: "Beverages · Aisle 3",
    store: "Big Bazaar — Whitefield",
    status: "In progress",
    score: "—",
    date: "Today",
  },
  {
    name: "Snacks end-cap",
    store: "Reliance Smart — Jayanagar",
    status: "Needs action",
    score: "76%",
    date: "Yesterday",
  },
  {
    name: "Personal care bay",
    store: "DMart — HSR Layout",
    status: "Completed",
    score: "88%",
    date: "2 days ago",
  },
] as const;
