import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import {
  LayoutDashboard,
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
  ChevronDown,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { cn } from "@/lib/utils";
import { fetchProfile } from "@/lib/account";
import { fetchMyPendingCount, isOrgManager } from "@/lib/assignments";
import { getMembership, listMemberships, setActiveOrgId } from "@/lib/db/context";
import {
  fetchInbox,
  markAllNotificationsRead,
  markNotificationRead,
  notificationHref,
} from "@/lib/notifications";
import { Badge } from "@/components/ui/badge";

type LucideIcon = typeof Bell;

type NavLeaf = {
  kind: "leaf";
  label: string;
  to: string;
  search?: Record<string, string>;
  icon?: LucideIcon;
  /** Badge only renders when the resolved count is > 0. */
  badge?: "open-tasks";
};

type NavParent = {
  kind: "parent";
  label: string;
  icon: LucideIcon;
  badge?: "open-tasks";
  children: NavLeaf[];
};

type NavItem = NavLeaf | NavParent;

type NavSection = {
  /** Undefined renders the items without an uppercase header. */
  header?: string;
  managerOnly?: boolean;
  items: NavItem[];
};

const SECTIONS: NavSection[] = [
  {
    items: [{ kind: "leaf", label: "Dashboard", to: "/dashboard", icon: LayoutDashboard }],
  },
  {
    header: "Scan & tasks",
    items: [
      { kind: "leaf", label: "New Scan", to: "/scan", icon: Plus },
      {
        kind: "parent",
        label: "My Scans",
        icon: ClipboardCheck,
        badge: "open-tasks",
        children: [
          {
            kind: "leaf",
            label: "Assigned to Me",
            to: "/my-scans",
            search: { tab: "assigned" },
            badge: "open-tasks",
          },
          {
            kind: "leaf",
            label: "Completed by Me",
            to: "/my-scans",
            search: { tab: "completed" },
          },
        ],
      },
    ],
  },
  {
    managerOnly: true,
    items: [
      {
        kind: "parent",
        label: "Assigned Scans",
        icon: Send,
        children: [
          {
            kind: "leaf",
            label: "Scans I Assigned",
            to: "/assigned-scans",
            search: { tab: "assignments" },
          },
        ],
      },
    ],
  },
  {
    items: [{ kind: "leaf", label: "Scan History", to: "/scan-history", icon: History }],
  },
  {
    header: "Audit & actions",
    items: [
      { kind: "leaf", label: "Corrective Actions", to: "/corrective-actions", icon: Wrench },
    ],
  },
  {
    managerOnly: true,
    items: [{ kind: "leaf", label: "Reports", to: "/reports", icon: FileBarChart }],
  },
  {
    header: "Management",
    managerOnly: true,
    items: [
      { kind: "leaf", label: "Planogram Management", to: "/store-master", icon: LayoutGrid },
      { kind: "leaf", label: "Stores", to: "/stores", icon: Store },
      { kind: "leaf", label: "Team", to: "/team", icon: Users },
    ],
  },
];


const ACCOUNT_SECTION: NavSection = {
  header: "Account",
  items: [
    { kind: "leaf", label: "Billing", to: "/billing", icon: CreditCard },
    { kind: "leaf", label: "Profile", to: "/profile", icon: User },
    { kind: "leaf", label: "Settings", to: "/settings", icon: Settings },
  ],
};

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <p className="sticky top-0 z-10 bg-card px-3 pb-2 pt-3 text-[0.68rem] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const leafActive = (leaf: NavLeaf) => {
    if (pathname !== leaf.to) return false;
    const tab = leaf.search?.["tab"];
    if (!tab) return true;
    if (activeTab) return activeTab === tab;
    // No tab in the URL: the first child is the default landing tab.
    return tab === "assigned" || tab === "assignments";
  };

  const badgeFor = (badge: NavLeaf["badge"]) => (badge === "open-tasks" ? openTasks : 0);

  const railLink = (
    label: string,
    to: string,
    search: Record<string, string> | undefined,
    Icon: LucideIcon,
    active: boolean,
    count: number,
  ) => (
    <RailTooltip key={`${to}-${label}`} label={label}>
      <Link
        to={to}
        search={search ?? {}}
        onClick={onNavigate}
        aria-label={label}
        className={cn(
          "relative flex size-10 items-center justify-center rounded-xl transition-colors",
          active
            ? "bg-brand-soft text-brand"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Icon className="size-4" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[0.6rem] font-semibold text-brand-foreground">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Link>
    </RailTooltip>
  );

  const renderLeaf = (leaf: NavLeaf, nested = false) => {
    const active = leafActive(leaf);
    const count = badgeFor(leaf.badge);
    const Icon = leaf.icon;
    if (rail) {
      if (!Icon) return null;
      return railLink(leaf.label, leaf.to, leaf.search, Icon, active, count);
    }
    return (
      <Link
        key={`${leaf.to}-${leaf.label}`}
        to={leaf.to}
        search={leaf.search ?? {}}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-2.5 rounded-xl py-2 text-sm transition-colors",
          nested ? "ml-3 border-l border-border pl-4 pr-3" : "px-3",
          active
            ? "bg-brand-soft font-medium text-brand"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        {Icon && <Icon className="size-4" />}
        <span className="flex-1 truncate">{leaf.label}</span>
        <CountBadge count={count} />
      </Link>
    );
  };

  const renderParent = (parent: NavParent) => {
    const childActive = parent.children.some((child) => leafActive(child));
    const open = collapsed[parent.label] === undefined ? true : !collapsed[parent.label];
    const count = badgeFor(parent.badge);
    if (rail) {
      const first = parent.children[0];
      if (!first) return null;
      return railLink(parent.label, first.to, first.search, parent.icon, childActive, count);
    }
    return (
      <div key={parent.label} className="space-y-1">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => ({ ...prev, [parent.label]: open }))}
          aria-expanded={open}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors",
            childActive
              ? "bg-brand-soft font-medium text-brand"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <parent.icon className="size-4" />
          <span className="flex-1 text-left truncate">{parent.label}</span>
          <CountBadge count={count} />
          <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} />
        </button>
        {open && <div className="space-y-1">{parent.children.map((c) => renderLeaf(c, true))}</div>}
      </div>
    );
  };

  const renderSection = (section: NavSection, index: number) => {
    if (section.managerOnly && !showManagerNav) return null;
    return (
      <div
        key={section.header ?? `section-${index}`}
        className={cn("space-y-1", rail && "flex flex-col items-center gap-1 space-y-0")}
      >
        {section.header && !rail && <SectionHeader>{section.header}</SectionHeader>}
        {section.header && rail && <span className="my-1 h-px w-6 bg-border" />}
        {section.items.map((item) =>
          item.kind === "parent" ? renderParent(item) : renderLeaf(item),
        )}
      </div>
    );
  };

  return (
    <nav className={cn("space-y-1", rail && "flex flex-col items-center gap-1 space-y-0")}>
      {SECTIONS.map(renderSection)}
    </nav>
  );
}

function AccountNav({
  rail = false,
  onNavigate,
}: {
  rail?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className={cn("space-y-1", rail && "flex flex-col items-center gap-1 space-y-0")}>
      {rail ? (
        <span className="my-1 h-px w-6 bg-border" />
      ) : (
        <SectionHeader>{ACCOUNT_SECTION.header}</SectionHeader>
      )}
      {ACCOUNT_SECTION.items.map((item) => {
        if (item.kind !== "leaf") return null;
        const Icon = item.icon!;
        const active = pathname === item.to;
        if (rail) {
          return (
            <RailTooltip key={item.to} label={item.label}>
              <Link
                to={item.to}
                onClick={onNavigate}
                aria-label={item.label}
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl transition-colors",
                  active
                    ? "bg-brand-soft text-brand"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
              </Link>
            </RailTooltip>
          );
        }
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors",
              active
                ? "bg-brand-soft font-medium text-brand"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            <span className="flex-1">{item.label}</span>
          </Link>
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
  const inbox = inboxQuery.data ?? [];
  const unread = inbox.filter((n) => !n.read_at).length;
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
    <div className="min-h-screen bg-surface">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col overflow-y-auto border-r border-border bg-card px-4 py-5 lg:flex">
        <Logo to="/dashboard" />
        {workspaceSwitcher}
        <div className="mt-5">
          <SidebarNav showManagerNav={showManagerNav} openTasks={pendingCount} />
        </div>
        <div className="mt-6 rounded-2xl border border-border bg-brand-soft/60 p-4">
          <p className="text-sm font-medium text-foreground">Need more scans?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Review your plan, quota and invoices in billing.
          </p>
          <Button asChild size="sm" variant="brand" className="mt-3 w-full rounded-lg">
            <Link to="/billing">Manage plan</Link>
          </Button>
        </div>
        <div className="mt-4 pb-2">
          <AccountNav />
        </div>
      </aside>

      <div className="lg:pl-64">
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
                className="flex w-[85vw] max-w-xs flex-col gap-0 overflow-y-auto bg-card p-0"
              >
                <div className="border-b border-border px-4 py-4">
                  <Logo to="/dashboard" />
                  {workspaceSwitcher}
                </div>
                <div className="px-3 py-3">
                  <SidebarNav
                    showManagerNav={showManagerNav}
                    openTasks={pendingCount}
                    onNavigate={() => setMenuOpen(false)}
                  />
                </div>
                <div className="px-4 pb-2">
                  <Button asChild size="sm" variant="brand" className="w-full rounded-lg">
                    <Link to="/billing" onClick={() => setMenuOpen(false)}>
                      Manage plan
                    </Link>
                  </Button>
                </div>
                <div className="px-3 pb-6">
                  <AccountNav onNavigate={() => setMenuOpen(false)} />
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
                aria-label="Search scans, stores and SKUs"
                placeholder="Search scans, stores, SKUs…"
                className="h-9 rounded-xl border-border bg-surface pl-9"
              />
            </form>
            <div className="ml-auto flex items-center gap-2">
              <Button asChild variant="brand" size="sm" className="rounded-xl">
                <Link to="/scan">New scan</Link>
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
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
                {description && (
                  <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
                )}
              </div>
              {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
            <div className="mt-7 animate-fade-in">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
