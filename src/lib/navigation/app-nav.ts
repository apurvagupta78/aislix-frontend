import {
  AlertTriangle,
  BarChart3,
  ClipboardCheck,
  FileBarChart,
  LayoutDashboard,
  Settings,
  Zap,
} from "lucide-react";

export type NavLeafConfig = {
  kind: "leaf";
  label: string;
  to: string;
  search?: Record<string, string>;
  managerOnly?: boolean;
  badge?: "open-tasks";
};

export type NavParentConfig = {
  kind: "parent";
  label: string;
  managerOnly?: boolean;
  badge?: "open-tasks";
  children: NavLeafConfig[];
};

export type NavItemConfig = NavLeafConfig | NavParentConfig;

export type NavSectionConfig = {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  managerOnly?: boolean;
  items: NavItemConfig[];
};

/** Full Aislix application navigation — maps to existing routes where available. */
export const APP_NAV_SECTIONS: NavSectionConfig[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [{ kind: "leaf", label: "Dashboard", to: "/dashboard" }],
  },
  {
    id: "audits",
    label: "Audits",
    icon: ClipboardCheck,
    items: [
      { kind: "leaf", label: "My work", to: "/my-scans" },
      { kind: "leaf", label: "All audits", to: "/history" },
      { kind: "leaf", label: "Assignments", to: "/assigned-scans" },
      { kind: "leaf", label: "Audit calendar", to: "/audit-calendar" },
      { kind: "leaf", label: "Audit templates", to: "/audit-templates", managerOnly: true },
    ],
  },
  {
    id: "quick-checks",
    label: "Quick checks",
    icon: Zap,
    items: [
      { kind: "leaf", label: "Display check", to: "/display-check" },
      { kind: "leaf", label: "Rack check", to: "/rack-check" },
      { kind: "leaf", label: "Shelf to CSV", to: "/shelf-to-csv" },
      { kind: "leaf", label: "FNV check", to: "/fnv-check" },
      { kind: "leaf", label: "Hygiene check", to: "/hygiene-check" },
    ],
  },
  {
    id: "exceptions",
    label: "Exceptions",
    icon: AlertTriangle,
    items: [
      { kind: "leaf", label: "Findings", to: "/findings" },
      { kind: "leaf", label: "Corrective actions", to: "/corrective-actions" },
      { kind: "leaf", label: "SLA dashboard", to: "/sla" },
      { kind: "leaf", label: "SLA & escalations", to: "/escalation-settings", managerOnly: true },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    icon: BarChart3,
    items: [{ kind: "leaf", label: "Intelligence", to: "/intelligence" }],
  },
  {
    id: "reports",
    label: "Reports",
    icon: FileBarChart,
    items: [{ kind: "leaf", label: "Reports", to: "/report" }],
  },
  {
    id: "manage",
    label: "Manage",
    icon: Settings,
    managerOnly: true,
    items: [
      { kind: "leaf", label: "Stores", to: "/stores" },
      { kind: "leaf", label: "Team", to: "/team" },
      { kind: "leaf", label: "Workspace settings", to: "/settings", search: { tab: "company" } },
      { kind: "leaf", label: "Notifications", to: "/settings", search: { tab: "notifications" } },
      { kind: "leaf", label: "Security", to: "/settings", search: { tab: "security" } },
      { kind: "leaf", label: "Billing & plan", to: "/billing" },
    ],
  },
];
