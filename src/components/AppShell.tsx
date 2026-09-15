import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import {
  LayoutDashboard,
  AlertTriangle,
  Plus,
  History,
  FileBarChart,
  CreditCard,
  User,
  Settings,
  Store,
  Users,
  Bell,
  Search,
  LogOut,
  Menu,
  ClipboardCheck,
  LayoutGrid,
  Send,
  Wrench,
  BarChart3,
  CalendarClock,
  Clock,
  PackageSearch,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SiteFooter } from "@/components/Footer";
import { Logo } from "@/components/Logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { fetchProfile } from "@/lib/account";
import { fetchMyPendingCount, isOrgManager } from "@/lib/assignments";
import { getMembership, listMemberships, setActiveOrgId } from "@/lib/db/context";
import {
  fetchInbox,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  notificationHref,
} from "@/lib/notifications";
import { formatAssignmentId } from "@/components/AssignmentId";
import { GlobalFilterBarShell } from "@/components/filters/GlobalFilterBarShell";
import { Badge } from "@/components/ui/badge";
import { GlobalFilterProvider } from "@/lib/global-filters";

type LucideIcon = typeof Bell;

type NavLeaf = {
  kind: "leaf";
  label: string;
  to: string;
  search?: Record<string, string>;
  icon?: LucideIcon;
  managerOnly?: boolean;
  /** Badge only renders when the resolved count is > 0. */
  badge?: "open-tasks";
};

type NavParent = {
  kind: "parent";
  label: string;
  icon?: LucideIcon;
  managerOnly?: boolean;
  badge?: "open-tasks";
  children: NavLeaf[];
};

type NavItem = NavLeaf | NavParent;

type NavSection = {
  id: string;
  label: string;
  icon: LucideIcon;
  managerOnly?: boolean;
  items: NavItem[];
};

const DASHBOARD_LEAF: NavLeaf = {
  kind: "leaf",
  label: "Dashboard",
  to: "/dashboard",
  icon: LayoutDashboard,
};

const SECTIONS: NavSection[] = [
  {
    id: "new-audit",
    label: "New Audit",
    icon: Plus,
    items: [{ kind: "leaf", label: "Create or assign audit", to: "/new-audit", icon: Plus }],
  },
  {
    id: "audits",
    label: "Audits",
    icon: ClipboardCheck,
    items: [
      {
        kind: "leaf",
        label: "Audit workspace",
        to: "/audits",
        badge: "open-tasks",
      },
    ],
  },
  {
    id: "actions",
    label: "Actions",
    icon: Wrench,
    items: [
      { kind: "leaf", label: "Findings & action workspace", to: "/actions", icon: AlertTriangle },
    ],
  },
  {
    id: "manage",
    label: "Manage",
    icon: Settings,
    managerOnly: true,
    items: [{ kind: "leaf", label: "Management workspace", to: "/manage", icon: Store }],
  },
];

const OPEN_SECTION_KEY = "nav_open_section";

function RailTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Badge
      variant="secondary"
      className="rounded-full border-0 bg-brand px-2 text-[0.7rem] text-brand-foreground"
    >
      {count}
    </Badge>
  );
}

function sectionItems(section: NavSection, showManagerNav: boolean): NavItem[] {
  return section.items.filter((item) => !item.managerOnly || showManagerNav);
}

function SidebarNav({
  showManagerNav,
  openTasks,
  rail = false,
  onNavigate,
}: {
  showManagerNav: boolean;
  openTasks: number;
  rail?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const activeTab = new URLSearchParams(searchStr).get("tab");

  const leafActive = (leaf: NavLeaf) => {
    if (pathname !== leaf.to) return false;
    const tab = leaf.search?.["tab"];
    if (!tab) return true;
    if (activeTab) return activeTab === tab;
    // No tab in the URL: the first child is the default landing tab.
    return tab === "assigned" || tab === "assignments";
  };

  const itemActive = (item: NavItem): boolean =>
    item.kind === "leaf" ? leafActive(item) : item.children.some(leafActive);

  const visibleSections = SECTIONS.filter((s) => !s.managerOnly || showManagerNav);
  const activeSectionId =
    visibleSections.find((s) => sectionItems(s, showManagerNav).some(itemActive))?.id ?? null;

  // Single-open accordion: only the active route's section is open by default.
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [userTouched, setUserTouched] = useState(false);
  useEffect(() => {
    if (!userTouched) setOpenSection(activeSectionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSectionId]);
  const toggleSection = (id: string) => {
    setUserTouched(true);
    setOpenSection((prev) => {
      const next = prev === id ? null : id;
      window.localStorage.setItem(OPEN_SECTION_KEY, next ?? "");
      return next;
    });
  };

  const [openParent, setOpenParent] = useState<string | null>(null);
  const badgeFor = (badge: NavLeaf["badge"]) => (badge === "open-tasks" ? openTasks : 0);

  const renderLeaf = (leaf: NavLeaf, depth: 1 | 2 = 1) => {
    const active = leafActive(leaf);
    return (
      <Link
        key={`${leaf.to}-${leaf.label}`}
        to={leaf.to}
        search={leaf.search ?? {}}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-2 rounded-lg py-1.5 pr-3 text-sm transition-colors",
          depth === 1 ? "pl-6" : "pl-10",
          active
            ? "font-medium text-brand"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <span className="flex-1 truncate">{leaf.label}</span>
        <CountBadge count={badgeFor(leaf.badge)} />
      </Link>
    );
  };

  const renderSubParent = (parent: NavParent) => {
    const childActive = parent.children.some(leafActive);
    const open = childActive || openParent === parent.label;
    return (
      <div key={parent.label} className="flex flex-col gap-0.5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpenParent(open ? null : parent.label)}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg py-1.5 pl-6 pr-3 text-sm transition-colors",
            childActive
              ? "font-medium text-brand"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <span className="flex-1 truncate text-left">{parent.label}</span>
          <CountBadge count={badgeFor(parent.badge)} />
          <ChevronDown className={cn("size-3 transition-transform", !open && "-rotate-90")} />
        </button>
        {open && (
          <div className="flex flex-col gap-0.5">
            {parent.children.map((c) => renderLeaf(c, 2))}
          </div>
        )}
      </div>
    );
  };

  const renderItem = (item: NavItem) =>
    item.kind === "parent" ? renderSubParent(item) : renderLeaf(item, 1);

  const railFlyoutItems = (section: NavSection) =>
    sectionItems(section, showManagerNav).flatMap((item) =>
      item.kind === "leaf" ? [item] : item.children,
    );

  if (rail) {
    return (
      <nav className="flex flex-col items-center gap-1">
        <RailTooltip label="Dashboard">
          <Link
            to={DASHBOARD_LEAF.to}
            onClick={onNavigate}
            aria-label="Dashboard"
            className={cn(
              "flex size-10 items-center justify-center rounded-xl transition-colors",
              pathname === DASHBOARD_LEAF.to
                ? "bg-brand-soft text-brand"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <LayoutDashboard className="size-4" />
          </Link>
        </RailTooltip>
        {visibleSections.map((section) => (
          <Popover key={section.id}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`${section.label} — expand for sub-items`}
                title={`${section.label} — expand for sub-items`}
                className={cn(
                  "relative flex size-10 items-center justify-center rounded-xl transition-colors",
                  activeSectionId === section.id
                    ? "bg-brand-soft text-brand"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <section.icon className="size-4" />
                {section.id === "audits" && openTasks > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[0.6rem] font-semibold text-brand-foreground">
                    {openTasks > 9 ? "9+" : openTasks}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" align="start" className="w-52 p-1.5">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {railFlyoutItems(section).map((child) => (
                  <Link
                    key={`${child.to}-${child.label}`}
                    to={child.to}
                    search={child.search ?? {}}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
                      leafActive(child)
                        ? "font-medium text-brand"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <span className="flex-1 truncate">{child.label}</span>
                    <CountBadge count={badgeFor(child.badge)} />
                  </Link>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-0.5">
      <Link
        to={DASHBOARD_LEAF.to}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
          pathname === DASHBOARD_LEAF.to
            ? "font-medium text-brand"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <LayoutDashboard className="size-4" />
        <span className="flex-1 truncate">Dashboard</span>
      </Link>
      {visibleSections.map((section) => {
        const open = openSection === section.id;
        return (
          <div key={section.id} className="flex flex-col gap-0.5">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => toggleSection(section.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                activeSectionId === section.id
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <section.icon className="size-4" />
              <span className="flex-1 truncate text-left">{section.label}</span>
              <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} />
            </button>
            {open && (
              <div className="flex flex-col gap-0.5">
                {sectionItems(section, showManagerNav).map(renderItem)}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

const SIDEBAR_STORAGE_KEY = "sidebar_collapsed";

function useSidebarCollapsed(): [boolean, (next: boolean) => void] {
  const [collapsed, setCollapsed] = useState(true);
  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) setCollapsed(stored === "true");
  }, []);
  const update = (next: boolean) => {
    setCollapsed(next);
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
  };
  return [collapsed, update];
}

export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed();

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
    retry: false,
    staleTime: 60_000,
  });

  const managerQuery = useQuery({
    queryKey: ["is-org-manager"],
    queryFn: () => isOrgManager(),
    retry: false,
    staleTime: 60_000,
  });
  const showManagerNav = managerQuery.data === true;
  const queryClient = useQueryClient();
  const pendingQuery = useQuery({
    queryKey: ["my-assignments-pending"],
    queryFn: () => fetchMyPendingCount(),
    retry: false,
    staleTime: 30_000,
  });
  const activeMembershipQuery = useQuery({
    queryKey: ["active-membership"],
    queryFn: () => getMembership(),
    retry: false,
    staleTime: 60_000,
  });
  const activeMembership = activeMembershipQuery.data ?? null;
  const inboxQuery = useQuery({
    queryKey: ["inbox"],
    queryFn: () => fetchInbox(15),
    retry: false,
    staleTime: 30_000,
  });
  const membershipsQuery = useQuery({
    queryKey: ["memberships"],
    queryFn: () => listMemberships(),
    retry: false,
    staleTime: 60_000,
  });
  const unreadQuery = useQuery({
    queryKey: ["inbox-unread"],
    queryFn: () => fetchUnreadCount(),
    retry: false,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const inbox = inboxQuery.data ?? [];
  const unread = unreadQuery.data ?? inbox.filter((n) => !n.read_at).length;
  const memberships = membershipsQuery.data ?? [];
  const pendingCount = pendingQuery.data ?? 0;

  const switchWorkspace = (orgId: string) => {
    setActiveOrgId(orgId);
    void queryClient.invalidateQueries();
  };
  const profile = profileQuery.data;
  const displayName = profile?.full_name?.trim() || profile?.email || "Your account";
  const displayEmail = profile?.email ?? "";
  const initials =
    (profile?.full_name?.trim()
      ? profile.full_name
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join("")
      : profile?.email?.[0]) ?? "A";

  const workspaceSwitcher =
    memberships.length > 1 ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="mt-4 flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted">
            <span className="min-w-0 flex-1 truncate font-medium text-foreground">
              {activeMembership?.org_name ?? memberships[0]?.org_name ?? "Workspace"}
            </span>
            <ChevronDown className="size-3.5 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60 rounded-xl">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Workspace
          </DropdownMenuLabel>
          {memberships.map((m) => (
            <DropdownMenuItem
              key={m.org_id}
              onClick={() => switchWorkspace(m.org_id)}
              className="flex items-start justify-between gap-2 text-sm"
            >
              <span className="min-w-0">
                <span className="block truncate">{m.org_name ?? "Workspace"}</span>
                {m.org_hint && (
                  <span className="block truncate text-xs text-muted-foreground">{m.org_hint}</span>
                )}
              </span>
              {(m.pending_count ?? 0) > 0 && (
                <span className="mt-0.5 shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  {m.pending_count}
                </span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  return (
    <GlobalFilterProvider>
      <TooltipProvider delayDuration={120}>
        <div className="min-h-screen bg-surface">
          <aside
            className={cn(
              "fixed inset-y-0 left-0 z-40 hidden h-full flex-col border-r border-border bg-card py-5 lg:flex",
              sidebarCollapsed ? "w-16 items-center px-2" : "w-64 px-4",
            )}
          >
            <div
              className={cn(
                "flex shrink-0 items-center",
                sidebarCollapsed ? "flex-col gap-2" : "justify-between gap-2",
              )}
            >
              {sidebarCollapsed ? <Logo compact to="/dashboard" /> : <Logo to="/dashboard" />}
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl"
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="size-4" />
                ) : (
                  <ChevronLeft className="size-4" />
                )}
              </Button>
            </div>
            {!sidebarCollapsed && workspaceSwitcher}
            <div className="mt-5 flex min-h-0 flex-1 flex-col justify-start gap-1 overflow-hidden">
              <SidebarNav
                showManagerNav={showManagerNav}
                openTasks={pendingCount}
                rail={sidebarCollapsed}
              />
            </div>
            <div className={cn("mt-auto shrink-0", sidebarCollapsed ? "pt-2" : "pt-2 pb-2")}>
              <div className="pt-4">
                {sidebarCollapsed ? (
                  <RailTooltip label="Manage plan">
                    <Link
                      to="/billing"
                      aria-label="Manage plan"
                      className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand"
                    >
                      <CreditCard className="size-4" />
                    </Link>
                  </RailTooltip>
                ) : (
                  <div className="rounded-2xl border border-border bg-brand-soft/60 p-4">
                    <p className="text-sm font-medium text-foreground">Need more audits?</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Review your plan, quota and invoices in billing.
                    </p>
                    <Button asChild size="sm" variant="brand" className="mt-3 w-full rounded-lg">
                      <Link to="/billing">Manage plan</Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </aside>

          <div className={sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"}>
            <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-xl">
              <div className="flex h-16 items-center gap-3 px-5 sm:px-8">
                <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-xl lg:hidden"
                      aria-label="Open navigation menu"
                    >
                      <Menu className="size-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="left"
                    className="flex h-full w-[85vw] max-w-xs flex-col gap-0 overflow-hidden bg-card p-0"
                  >
                    <div className="shrink-0 border-b border-border px-4 py-4">
                      <Logo to="/dashboard" />
                      {workspaceSwitcher}
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3">
                      <SidebarNav
                        showManagerNav={showManagerNav}
                        openTasks={pendingCount}
                        onNavigate={() => setMenuOpen(false)}
                      />
                    </div>
                    <div className="shrink-0 border-t border-border px-4 py-4">
                      <Button asChild size="sm" variant="brand" className="w-full rounded-lg">
                        <Link to="/billing" onClick={() => setMenuOpen(false)}>
                          Manage plan
                        </Link>
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>
                <div className="lg:hidden">
                  <Logo compact to="/dashboard" />
                </div>

                <form
                  className="relative hidden max-w-sm flex-1 md:block"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const q = new FormData(e.currentTarget).get("q");
                    navigate({
                      to: "/history",
                      search: typeof q === "string" && q ? { q } : {},
                    });
                  }}
                >
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    name="q"
                    aria-label="Search audits, stores and SKUs"
                    placeholder="Search audit ID, store, SKU, employee…"
                    className="h-9 rounded-xl border-border bg-surface pl-9"
                  />
                </form>
                <div className="ml-auto flex items-center gap-2">
                  <Button asChild variant="brand" size="sm" className="rounded-xl">
                    <Link to="/scan">New audit</Link>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="relative rounded-xl p-2 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand/40"
                        aria-label={
                          unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
                        }
                      >
                        <Bell className="size-4" />
                        {unread > 0 && (
                          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[0.6rem] font-semibold text-destructive-foreground">
                            {unread > 9 ? "9+" : unread}
                          </span>
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80 rounded-xl">
                      <DropdownMenuLabel className="flex items-center justify-between font-normal">
                        <span className="text-sm font-medium">Notifications</span>
                        {unread > 0 && (
                          <button
                            className="text-xs text-brand hover:underline"
                            onClick={async () => {
                              await markAllNotificationsRead();
                              void queryClient.invalidateQueries({ queryKey: ["inbox"] });
                              void queryClient.invalidateQueries({ queryKey: ["inbox-unread"] });
                            }}
                          >
                            Mark all read
                          </button>
                        )}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {!inbox.length ? (
                        <p className="px-2 py-4 text-xs text-muted-foreground">
                          You have no notifications yet.
                        </p>
                      ) : (
                        inbox.map((n) => (
                          <DropdownMenuItem
                            key={n.id}
                            className="flex-col items-start gap-0.5 whitespace-normal rounded-lg"
                            onClick={async () => {
                              if (!n.read_at) {
                                await markNotificationRead(n.id);
                                void queryClient.invalidateQueries({ queryKey: ["inbox"] });
                                void queryClient.invalidateQueries({ queryKey: ["inbox-unread"] });
                              }
                              void navigate({ to: notificationHref(n) });
                            }}
                          >
                            <span className="flex w-full items-center gap-2 text-sm font-medium">
                              {!n.read_at && <span className="size-1.5 rounded-full bg-brand" />}
                              {n.title}
                            </span>
                            {n.body && (
                              <span className="text-xs text-muted-foreground">{n.body}</span>
                            )}
                            {typeof n.payload["assignment_id"] === "string" && (
                              <span className="font-mono text-xs text-muted-foreground">
                                Assignment{" "}
                                {formatAssignmentId(n.payload["assignment_id"] as string)}
                              </span>
                            )}
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="rounded-full outline-none ring-brand/40 focus-visible:ring-2">
                        <Avatar className="size-8">
                          {profile?.avatar_url ? (
                            <AvatarImage src={profile.avatar_url} alt={displayName} />
                          ) : null}
                          <AvatarFallback className="bg-brand-soft text-xs font-medium uppercase text-brand">
                            {initials.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52 rounded-xl">
                      <DropdownMenuLabel className="font-normal">
                        <p className="text-sm font-medium">{displayName}</p>
                        {displayEmail && (
                          <p className="text-xs text-muted-foreground">{displayEmail}</p>
                        )}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {memberships.length > 1 && (
                        <>
                          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                            Workspace
                          </DropdownMenuLabel>
                          {memberships.map((m) => (
                            <DropdownMenuItem
                              key={m.org_id}
                              onClick={() => switchWorkspace(m.org_id)}
                              className="flex items-start justify-between gap-2 text-sm"
                            >
                              <span className="min-w-0">
                                <span className="block truncate">{m.org_name ?? "Workspace"}</span>
                                {m.org_hint && (
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {m.org_hint}
                                  </span>
                                )}
                              </span>
                              {(m.pending_count ?? 0) > 0 && (
                                <span className="mt-0.5 shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                                  {m.pending_count}
                                </span>
                              )}
                            </DropdownMenuItem>
                          ))}

                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem asChild>
                        <Link to="/profile">Profile</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/settings">Settings</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/billing">Billing</Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/logout">
                          <LogOut className="mr-2 size-4" /> Sign out
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </header>

            <main className="px-5 py-8 sm:px-8">
              <div className="mx-auto max-w-7xl">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                      {title}
                    </h1>
                    {description && (
                      <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
                    )}
                  </div>
                  {actions && <div className="flex items-center gap-2">{actions}</div>}
                </div>
                <GlobalFilterBarShell />
                <div className="mt-7 animate-fade-in">{children}</div>
              </div>
            </main>
            <SiteFooter />
          </div>
        </div>
      </TooltipProvider>
    </GlobalFilterProvider>
  );
}
