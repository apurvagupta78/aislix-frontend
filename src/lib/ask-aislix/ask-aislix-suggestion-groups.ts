import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ImageIcon,
  LineChart,
  MapPin,
  Package,
  RefreshCw,
} from "lucide-react";

import { AISLIX_PALETTE } from "@/lib/ai-audit/kpi-palette";

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

export const ASK_SUGGESTION_UI_TINTS: Record<AskSuggestionUiGroupId, AskSuggestionUiTint> = {
  Inventory: {
    cardBg: "rgba(125, 183, 214, 0.16)",
    cardBorder: "#C5DCE8",
    tabBg: "rgba(125, 183, 214, 0.22)",
    tabBorder: "#B5D4E4",
    tabText: "#2A5A78",
    ink: "#2A5A78",
  },
  Compliance: {
    cardBg: "rgba(121, 226, 168, 0.18)",
    cardBorder: "#B8E8CF",
    tabBg: "rgba(121, 226, 168, 0.24)",
    tabBorder: "#A5DEB9",
    tabText: "#1A4D36",
    ink: "#1A4D36",
  },
  Evidence: {
    cardBg: "rgba(142, 201, 232, 0.2)",
    cardBorder: "#B8DCEF",
    tabBg: "rgba(142, 201, 232, 0.28)",
    tabBorder: "#A5D2E8",
    tabText: "#1E5570",
    ink: "#1E5570",
  },
  Team: {
    cardBg: AISLIX_PALETTE.pink,
    cardBorder: "#ECBDCC",
    tabBg: AISLIX_PALETTE.pink,
    tabBorder: "#ECBDCC",
    tabText: "#7A3A52",
    ink: "#7A3A52",
  },
};

export const ASK_SCOPE_OPTIONS = {
  stores: ["All stores", "North region", "South region", "Dark stores", "Warehouses"],
  period: ["Last 7 days", "Last 30 days", "This quarter", "Year to date"],
} as const;
