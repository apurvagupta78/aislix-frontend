import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  ScanLine,

  History,
  FileText,
  CreditCard,
  User,
  Settings,
  Store,
  Users,
  Bell,
  Search,
  LogOut,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
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
import { cn } from "@/lib/utils";
import { fetchProfile } from "@/lib/account";

const nav = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Scan", to: "/scan", icon: ScanLine },
  { label: "Scan History", to: "/history", icon: History },

  { label: "Reports", to: "/report", icon: FileText },
  { label: "Stores", to: "/stores", icon: Store },
  { label: "Team", to: "/team", icon: Users },
] as const;

const secondary = [
  { label: "Billing", to: "/billing", icon: CreditCard },
  { label: "Profile", to: "/profile", icon: User },
  { label: "Settings", to: "/settings", icon: Settings },
] as const;

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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
    retry: false,
    staleTime: 60_000,
  });
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

  const item = (to: string, label: string, Icon: typeof Bell) => (
    <Link
      key={to}
      to={to}
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors",
        pathname === to
          ? "bg-brand-soft font-medium text-brand"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-surface">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-card px-4 py-5 lg:flex">
        <Logo to="/dashboard" />
        <nav className="mt-8 space-y-1">
          <p className="px-3 pb-2 text-[0.7rem] font-medium uppercase tracking-widest text-muted-foreground">
            Workspace
          </p>
          {nav.map((n) => item(n.to, n.label, n.icon))}
        </nav>
        <nav className="mt-7 space-y-1">
          <p className="px-3 pb-2 text-[0.7rem] font-medium uppercase tracking-widest text-muted-foreground">
            Account
          </p>
          {secondary.map((n) => item(n.to, n.label, n.icon))}
        </nav>
        <div className="mt-auto rounded-2xl border border-border bg-brand-soft/60 p-4">
          <p className="text-sm font-medium text-foreground">Need more scans?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Review your plan, quota and invoices in billing.
          </p>
          <Button asChild size="sm" variant="brand" className="mt-3 w-full rounded-lg">
            <Link to="/billing">Manage plan</Link>
          </Button>
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
                className="flex w-[85vw] max-w-xs flex-col gap-0 overflow-y-auto p-0"
              >
                <div className="border-b border-border px-4 py-4">
                  <Logo to="/dashboard" />
                </div>
                <nav className="space-y-1 px-3 py-4">
                  <p className="px-3 pb-2 text-[0.7rem] font-medium uppercase tracking-widest text-muted-foreground">
                    Workspace
                  </p>
                  {nav.map((n) => item(n.to, n.label, n.icon, () => setMenuOpen(false)))}
                </nav>
                <nav className="space-y-1 px-3 pb-4">
                  <p className="px-3 pb-2 text-[0.7rem] font-medium uppercase tracking-widest text-muted-foreground">
                    Account
                  </p>
                  {secondary.map((n) => item(n.to, n.label, n.icon, () => setMenuOpen(false)))}
                </nav>
                <div className="mt-auto border-t border-border px-4 py-4">
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
                aria-label="Search scans, stores and SKUs"
                placeholder="Search scans, stores, SKUs…"
                className="h-9 rounded-xl border-border bg-surface pl-9"
              />
            </form>
            <div className="ml-auto flex items-center gap-2">
              <Button asChild variant="brand" size="sm" className="rounded-xl">
                <Link to="/scan">New scan</Link>
              </Button>
              <Button asChild variant="ghost" size="icon" className="rounded-xl" aria-label="Notifications">
                <Link to="/dashboard" hash="notifications">
                  <Bell className="size-4" />
                </Link>
              </Button>
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
          <nav className="flex gap-1 overflow-x-auto border-t border-border px-3 py-2 lg:hidden">
            {[...nav, ...secondary].map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs",
                  pathname === n.to
                    ? "bg-brand-soft font-medium text-brand"
                    : "text-muted-foreground",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
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
