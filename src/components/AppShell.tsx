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
import { NEW_AUDIT_BUTTON_CLASS } from "@/lib/aislix-theme";
import { Badge } from "@/components/ui/badge";
import { GlobalFilterProvider } from "@/lib/global-filters";
import { PageHeader } from "@/components/design-system";
import { APP_NAV_SECTIONS, type NavItemConfig, type NavLeafConfig, type NavSectionConfig } from "@/lib/navigation/app-nav";
import { useIsGuest } from "@/lib/use-is-guest";
import { GuestNavPage } from "@/components/guest/GuestNavPage";

type LucideIcon = typeof Bell;
type NavLeaf = NavLeafConfig & { icon?: LucideIcon };
type NavParent = Extract<NavItemConfig, { kind: "parent" }>;
type NavItem = NavItemConfig;
type NavSection = NavSectionConfig;

const SECTIONS: NavSection[] = APP_NAV_SECTIONS;

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

function singleLeafSection(
  section: NavSection,
  showManagerNav: boolean,
): NavLeaf | null {
  const items = sectionItems(section, showManagerNav);
  if (items.length === 1 && items[0]?.kind === "leaf") return items[0];
  return null;
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
    if (leaf.to === "/dashboard") {
      return pathname === "/dashboard" || pathname === "/dashboard/";
    }
    if (pathname === leaf.to) {
      const tab = leaf.search?.["tab"];
      if (!tab) return true;
      if (activeTab) return activeTab === tab;
      return tab === "assigned" || tab === "assignments";
    }
    return pathname.startsWith(`${leaf.to}/`);
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
          "flex min-h-11 items-center gap-2 rounded-xl py-2 pr-3 text-sm transition-colors lg:min-h-9",
          depth === 1 ? "pl-6" : "pl-10",
          active
            ? "bg-local-bg font-semibold text-navy"
            : "text-mp-muted hover:bg-canvas hover:text-navy",
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
        {visibleSections.map((section) => {
          const direct = singleLeafSection(section, showManagerNav);
          if (direct) {
            const active = leafActive(direct);
            return (
              <RailTooltip key={section.id} label={direct.label}>
                <Link
                  to={direct.to}
                  search={direct.search ?? {}}
                  onClick={onNavigate}
                  className={cn(
                    "relative flex size-10 items-center justify-center rounded-xl transition-colors",
                    active
                      ? "bg-local-bg text-navy"
                      : "text-mp-muted hover:bg-canvas hover:text-navy",
                  )}
                >
                  <section.icon className="size-4" />
                </Link>
              </RailTooltip>
            );
          }
          return (
            <Popover key={section.id}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`${section.label} — expand for sub-items`}
                  title={`${section.label} — expand for sub-items`}
                  className={cn(
                    "relative flex size-10 items-center justify-center rounded-xl transition-colors",
                    activeSectionId === section.id
                      ? "bg-local-bg text-navy"
                      : "text-mp-muted hover:bg-canvas hover:text-navy",
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
                        "flex min-h-10 items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition-colors",
                        leafActive(child)
                          ? "bg-local-bg font-semibold text-navy"
                          : "text-mp-muted hover:bg-canvas hover:text-navy",
                      )}
                    >
                      <span className="flex-1 truncate">{child.label}</span>
                      <CountBadge count={badgeFor(child.badge)} />
                    </Link>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-0.5">
      {visibleSections.map((section) => {
        const direct = singleLeafSection(section, showManagerNav);
        if (direct) {
          const active = leafActive(direct);
          return (
            <Link
              key={section.id}
              to={direct.to}
              search={direct.search ?? {}}
              onClick={onNavigate}
              className={cn(
                "flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors lg:min-h-10",
                active
                  ? "bg-local-bg text-navy"
                  : "text-mp-muted hover:bg-canvas hover:text-navy",
              )}
            >
              <section.icon className="size-4 shrink-0" />
              <span className="flex-1 truncate text-left">{direct.label}</span>
              <CountBadge count={badgeFor(direct.badge)} />
            </Link>
          );
        }

        const open = openSection === section.id;
        return (
          <div key={section.id} className="flex flex-col gap-0.5">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => toggleSection(section.id)}
              className={cn(
                "flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors lg:min-h-10",
                activeSectionId === section.id
                  ? "bg-local-bg text-navy"
                  : "text-mp-muted hover:bg-canvas hover:text-navy",
              )}
            >
              <section.icon className="size-4 shrink-0" />
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
  eyebrow,
  nextStep,
  hidePageHeader = false,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** "Where am I?" — defaults to the active navigation section. */
  eyebrow?: string;
  /** "What should I do next?" — one short plain-English line. */
  nextStep?: ReactNode;
  /** When true, page title/actions render inside children (e.g. Control Tower). */
  hidePageHeader?: boolean;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed();
  const isGuest = useIsGuest();
  const isDashboardRoute = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  const sectionLabel =
    SECTIONS.find((section) =>
      section.items.some((item) =>
        item.kind === "leaf"
          ? pathname === item.to || pathname.startsWith(`${item.to}/`)
          : item.children.some((c) => pathname === c.to || pathname.startsWith(`${c.to}/`)),
      ),
    )?.label ?? null;
  const headerEyebrow = eyebrow ?? sectionLabel ?? undefined;

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
    retry: false,
    staleTime: 60_000,
    enabled: !isGuest,
  });

  const managerQuery = useQuery({
    queryKey: ["is-org-manager"],
    queryFn: () => isOrgManager(),
    retry: false,
    staleTime: 60_000,
    enabled: !isGuest,
  });
  const showManagerNav = isGuest || managerQuery.data === true;
  const queryClient = useQueryClient();
  const pendingQuery = useQuery({
    queryKey: ["my-assignments-pending"],
    queryFn: () => fetchMyPendingCount(),
    retry: false,
    staleTime: 30_000,
    enabled: !isGuest,
  });
  const activeMembershipQuery = useQuery({
    queryKey: ["active-membership"],
    queryFn: () => getMembership(),
    retry: false,
    staleTime: 60_000,
    enabled: !isGuest,
  });
  const activeMembership = activeMembershipQuery.data ?? null;
  const inboxQuery = useQuery({
    queryKey: ["inbox"],
    queryFn: () => fetchInbox(15),
    retry: false,
    staleTime: 30_000,
    enabled: !isGuest,
  });
  const membershipsQuery = useQuery({
    queryKey: ["memberships"],
    queryFn: () => listMemberships(),
    retry: false,
    staleTime: 60_000,
    enabled: !isGuest,
  });
  const unreadQuery = useQuery({
    queryKey: ["inbox-unread"],
    queryFn: () => fetchUnreadCount(),
    retry: false,
    staleTime: 30_000,
    refetchInterval: isGuest ? false : 60_000,
    enabled: !isGuest,
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
  const displayName = isGuest
    ? "Guest"
    : profile?.full_name?.trim() || profile?.email || "Your account";
  const displayEmail = isGuest ? "Demo workspace · not signed in" : (profile?.email ?? "");
  const initials = isGuest
    ? "G"
    : (profile?.full_name?.trim()
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
        <div className="play-canvas">
          <aside
            className={cn(
                "fixed inset-y-0 left-0 z-40 hidden h-screen flex-col border-r border-line bg-white lg:flex",
              sidebarCollapsed ? "w-[68px] items-center px-2 py-4" : "w-[248px] px-3 py-4",
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
                      className="flex size-10 items-center justify-center rounded-xl bg-local-bg text-navy"
                    >
                      <CreditCard className="size-4" />
                    </Link>
                  </RailTooltip>
                ) : (
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <p className="text-sm font-bold text-foreground">Need more audits?</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Review your plan, quota and invoices in billing.
                    </p>
                    <Button asChild size="sm" variant="brand" className="mt-3 w-full rounded-xl">
                      <Link to="/billing">Manage plan</Link>
                    </Button>
                  </div>

                )}
              </div>
            </div>
          </aside>

          <div className={sidebarCollapsed ? "lg:pl-[68px]" : "lg:pl-[248px]"}>
            <header className="sticky top-0 z-30 border-b border-line bg-white px-3 sm:px-5">
              <div className="flex h-16 items-center gap-3 px-1 sm:px-3">

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
                    className="nav-dark nav-panel flex h-full w-[85vw] max-w-xs flex-col gap-0 overflow-hidden border-y-0 border-l-0 p-0"
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
                    className="h-10 rounded-lg border-line bg-canvas pl-9"
                  />
                </form>
                <div className="ml-auto flex items-center gap-2">
                  {isGuest ? (
                    <>
                      <Badge className="hidden rounded-md border border-border bg-surface text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:inline-flex">
                        Guest
                      </Badge>
                      <Badge className="hidden rounded-md bg-[var(--aislix-supermarket-bg)] text-[10px] font-semibold uppercase tracking-wide text-[#4F6B2E] sm:inline-flex">
                        Demo ON
                      </Badge>
                      <Button asChild variant="brand" size="sm" className="rounded-lg">
                        <Link to="/signup">Start free</Link>
                      </Button>
                      <Button asChild variant="outline" size="sm" className={NEW_AUDIT_BUTTON_CLASS}>
                        <Link to="/guest" search={{ intent: "sample" } as never}>
                          <Plus className="size-4" /> New Audit
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <Button asChild variant="outline" size="sm" className={NEW_AUDIT_BUTTON_CLASS}>
                      <Link to="/new-audit">
                        <Plus className="size-4" /> New Audit
                      </Link>
                    </Button>
                  )}
                  {!isGuest ? (
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
                  ) : null}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="rounded-full outline-none ring-brand/40 focus-visible:ring-2">
                        <Avatar className="size-8">
                          {!isGuest && profile?.avatar_url ? (
                            <AvatarImage src={profile.avatar_url} alt={displayName} />
                          ) : null}
                          <AvatarFallback className="bg-local-bg text-xs font-medium uppercase text-navy">
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
                      {isGuest ? (
                        <>
                          <DropdownMenuItem asChild>
                            <Link to="/signup">Create free account</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/login">Sign in</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/">Back to homepage</Link>
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <>
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
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </header>

            <main id="main-content" className="px-5 py-6 sm:px-8 sm:py-8">
              <div className="mx-auto max-w-7xl space-y-6">
                {!hidePageHeader && !(isGuest && !isDashboardRoute) ? (
                  <PageHeader
                    title={title}
                    {...(description ? { description } : {})}
                    {...(actions ? { actions } : {})}
                    {...(headerEyebrow ? { eyebrow: headerEyebrow } : {})}
                    {...(nextStep ? { nextStep } : {})}
                  />
                ) : null}

                {!(isGuest && !isDashboardRoute) ? <GlobalFilterBarShell /> : null}
                <div className="animate-fade-in">
                  {isGuest && !isDashboardRoute ? <GuestNavPage pathname={pathname} /> : children}
                </div>
              </div>
            </main>
            <SiteFooter />
          </div>
        </div>
      </TooltipProvider>
    </GlobalFilterProvider>
  );
}
