import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ImageIcon,
  LineChart,
  MapPin,
  Package,
  RefreshCw,
} from "lucide-react";

export type AskSuggestionUiGroupId = "Inventory" | "Compliance" | "Evidence" | "Team";

export type AskSuggestionUiIcon = "repeat" | "trend" | "alert" | "image" | "box" | "map";

export type AskSuggestionUiItem = {
  id: string;
  category: AskSuggestionUiGroupId;
  icon: AskSuggestionUiIcon;
  /** Display + submit text (matched to suggestion library where possible). */
  text: string;
};

export const ASK_SUGGESTION_UI_GROUPS: AskSuggestionUiGroupId[] = [
  "Inventory",
  "Compliance",
  "Evidence",
  "Team",
];

/** Curated 4-tab panel — Magic Pattern Ask redesign. Texts align with the wired suggestion library. */
export const ASK_SUGGESTION_UI_ITEMS: AskSuggestionUiItem[] = [
  {
    id: "s1",
    category: "Inventory",
    icon: "repeat",
    text: "Which SKUs repeatedly showed shortages?",
  },
  {
    id: "s2",
    category: "Inventory",
    icon: "trend",
    text: "What was inventory variance over the last 30 days?",
  },
  {
    id: "s3",
    category: "Inventory",
    icon: "map",
    text: "Which cities have the highest inventory variance?",
  },
  {
    id: "s4",
    category: "Compliance",
    icon: "trend",
    text: "Why did compliance change this month?",
  },
  {
    id: "s5",
    category: "Compliance",
    icon: "alert",
    text: "Which locations have the highest recurring issues?",
  },
  {
    id: "s6",
    category: "Compliance",
    icon: "box",
    text: "Which outlets have the lowest execution compliance?",
  },
  {
    id: "s7",
    category: "Evidence",
    icon: "image",
    text: "Show me the latest audit evidence images",
  },
  {
    id: "s8",
    category: "Evidence",
    icon: "image",
    text: "Show before/after evidence for recent corrective actions",
  },
  {
    id: "s9",
    category: "Evidence",
    icon: "alert",
    text: "Show shelf images from stores with failed audits",
  },
  {
    id: "s10",
    category: "Team",
    icon: "alert",
    text: "Which of my managers has the highest repeat finding rate?",
  },
  {
    id: "s11",
    category: "Team",
    icon: "repeat",
    text: "Which corrective actions are overdue?",
  },
  {
    id: "s12",
    category: "Team",
    icon: "trend",
    text: "Show audit completion trend over the last 30 days",
  },
];

export const ASK_SUGGESTION_UI_ICONS: Record<AskSuggestionUiIcon, LucideIcon> = {
  repeat: RefreshCw,
  trend: LineChart,
  alert: AlertTriangle,
  image: ImageIcon,
  box: Package,
  map: MapPin,
};

export type AskSuggestionUiTint = {
  cardBg: string;
  cardBorder: string;
  tabBg: string;
  tabBorder: string;
  tabText: string;
  ink: string;
};

/** Inventory / scopes use Demo Data toggle blue (`#EAF6FD`). Other tabs keep category tints. */
export const ASK_SUGGESTION_UI_TINTS: Record<AskSuggestionUiGroupId, AskSuggestionUiTint> = {
  Inventory: {
    cardBg: "#EAF6FD",
    cardBorder: "#C1E4F8",
    tabBg: "#EAF6FD",
    tabBorder: "#C1E4F8",
    tabText: "#102A43",
    ink: "#102A43",
  },
  Compliance: {
    cardBg: "#e9efdc",
    cardBorder: "#c8d4ae",
    tabBg: "#e9efdc",
    tabBorder: "#c8d4ae",
    tabText: "#4d6b22",
    ink: "#4d6b22",
  },
  Evidence: {
    cardBg: "#EAF6FD",
    cardBorder: "#C1E4F8",
    tabBg: "#EAF6FD",
    tabBorder: "#C1E4F8",
    tabText: "#102A43",
    ink: "#102A43",
  },
  Team: {
    cardBg: "#fde8ef",
    cardBorder: "#f5b8cb",
    tabBg: "#fde8ef",
    tabBorder: "#f5b8cb",
    tabText: "#b0305f",
    ink: "#b0305f",
  },
};

export const ASK_SCOPE_OPTIONS = {
  stores: ["All stores", "North region", "South region", "Dark stores", "Warehouses"],
  period: ["Last 7 days", "Last 30 days", "This quarter", "Year to date"],
} as const;
