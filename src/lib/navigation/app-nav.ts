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
      { kind: "leaf", label: "My work", to: "/my-scans" },
      { kind: "leaf", label: "All audits", to: "/history" },
      { kind: "leaf", label: "Display check", to: "/display-check" },
      { kind: "leaf", label: "Rack check", to: "/rack-check" },
      { kind: "leaf", label: "Assignments", to: "/assigned-scans" },
      { kind: "leaf", label: "Audit calendar", to: "/audit-calendar" },
      { kind: "leaf", label: "Recurring schedules", to: "/audit-schedules" },
      { kind: "leaf", label: "Audit templates", to: "/audit-templates", managerOnly: true },
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
      { kind: "leaf", label: "Exception queue", to: "/exceptions", managerOnly: true },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    icon: BarChart3,
    items: [
      { kind: "leaf", label: "Inventory & variance", to: "/intelligence/inventory-variance" },
      { kind: "leaf", label: "Expiry control", to: "/expiry-control" },
      { kind: "leaf", label: "Analytics", to: "/audit-intelligence", managerOnly: true },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: Store,
    items: [
      { kind: "leaf", label: "Stores / outlets", to: "/stores" },
      { kind: "leaf", label: "Supermarkets", to: "/stores", search: { model: "supermarket" } },
      { kind: "leaf", label: "Warehouses", to: "/operations/warehouses" },
      { kind: "leaf", label: "Distributors", to: "/operations/distributors" },
      { kind: "leaf", label: "SKUs", to: "/sku-intelligence" },
      { kind: "leaf", label: "Master data", to: "/store-master", managerOnly: true },
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
      { kind: "leaf", label: "Workspace settings", to: "/settings", search: { tab: "company" } },
      { kind: "leaf", label: "Notifications", to: "/settings", search: { tab: "notifications" } },
      { kind: "leaf", label: "Security", to: "/settings", search: { tab: "security" } },
      { kind: "leaf", label: "Billing & plan", to: "/billing" },
    ],
  },
];
