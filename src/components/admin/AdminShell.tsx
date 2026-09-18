import { Link, useRouterState } from "@tanstack/react-router";
import { Database, LayoutDashboard, LogOut, ScanLine, Shield, Upload, Users } from "lucide-react";
import { SiteFooter } from "@/components/Footer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/scans", label: "Audits", icon: ScanLine },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/orgs", label: "Organizations", icon: Database },
  { to: "/admin/demo-scans", label: "Demo audits", icon: Shield },
  { to: "/admin/demo-seed", label: "Demo evidence", icon: Upload },
];

export function AdminShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-brand text-brand-foreground">
              <Shield className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight">Aislix Platform Admin</p>
              <p className="text-xs text-muted-foreground">Cross-tenant data console</p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="rounded-lg">
            <Link to="/logout">
              <LogOut className="size-4" /> Sign out
            </Link>
          </Button>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand-soft text-brand"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
