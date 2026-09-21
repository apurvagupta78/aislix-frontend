import {
  AlertTriangle,
  BarChart3,
  ClipboardCheck,
  FileBarChart,
  LayoutDashboard,
  Settings,
  Store,
  Users,
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
      { kind: "leaf", label: "My Work", to: "/my-scans" },
      { kind: "leaf", label: "All Audits", to: "/history" },
      { kind: "leaf", label: "Assignments", to: "/assigned-scans" },
      { kind: "leaf", label: "Audit Calendar", to: "/audit-calendar" },
      { kind: "leaf", label: "Recurring Schedules", to: "/audit-schedules" },
      { kind: "leaf", label: "Audit Templates", to: "/audit-templates", managerOnly: true },
    ],
  },
  {
    id: "exceptions",
    label: "Exceptions",
    icon: AlertTriangle,
    items: [
      { kind: "leaf", label: "Findings", to: "/findings" },
      { kind: "leaf", label: "Corrective Actions", to: "/corrective-actions" },
      { kind: "leaf", label: "SLA & Escalations", to: "/escalation-settings", managerOnly: true },
      { kind: "leaf", label: "Recurring Issues", to: "/exceptions" },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    icon: BarChart3,
    items: [
      { kind: "leaf", label: "Inventory & Variance", to: "/intelligence/inventory-variance" },
      { kind: "leaf", label: "Expiry Control", to: "/expiry-control" },
      { kind: "leaf", label: "Analytics", to: "/audit-intelligence", managerOnly: true },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: Store,
    items: [
      { kind: "leaf", label: "Stores / Outlets", to: "/stores" },
      { kind: "leaf", label: "Supermarkets", to: "/stores", search: { model: "supermarket" } },
      { kind: "leaf", label: "Warehouses", to: "/operations/warehouses" },
      { kind: "leaf", label: "Distributors", to: "/operations/distributors" },
      { kind: "leaf", label: "SKUs", to: "/sku-intelligence" },
      { kind: "leaf", label: "Master Data", to: "/store-master", managerOnly: true },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: FileBarChart,
    items: [{ kind: "leaf", label: "Reports", to: "/report" }],
  },
  {
    id: "team",
    label: "Team",
    icon: Users,
    managerOnly: true,
    items: [{ kind: "leaf", label: "Team", to: "/team" }],
  },
  {
    id: "manage",
    label: "Manage",
    icon: Settings,
    managerOnly: true,
    items: [
      { kind: "leaf", label: "SLA", to: "/escalation-settings" },
      { kind: "leaf", label: "Users & Roles", to: "/team" },
      { kind: "leaf", label: "Notifications", to: "/settings" },
      { kind: "leaf", label: "Settings", to: "/settings" },
    ],
  },
];
