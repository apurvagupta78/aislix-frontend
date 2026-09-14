/**
 * Read-only app chrome for fullscreen demo — mirrors dashboard layout with Guest user.
 */

import { Link } from "@tanstack/react-router";
import {
  ClipboardCheck,
  History,
  LayoutDashboard,
  LogIn,
  Plus,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "New audit", to: "/scan", icon: Plus },
  { label: "Audit history", to: "/history", icon: History },
  { label: "Assigned audits", to: "/my-scans", icon: ClipboardCheck },
];

type GuestDemoShellProps = {
  title: string;
  description?: string;
  onClose: () => void;
  actions?: ReactNode;
  children: ReactNode;
};

export function GuestDemoShell({
  title,
  description,
  onClose,
  actions,
  children,
}: GuestDemoShellProps) {
  return (
    <div className="fixed inset-0 z-[100] flex bg-surface">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-card py-5 lg:flex">
        <div className="px-4">
          <Logo to="/" />
          <Badge variant="outline" className="mt-3 rounded-md text-[10px] uppercase tracking-wide">
            Guest demo
          </Badge>
        </div>
        <nav className="mt-6 flex flex-col gap-0.5 px-2">
          {NAV.map(({ label, to, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto px-4 pb-2">
          <Button asChild variant="brand" size="sm" className="w-full rounded-lg">
            <Link to="/signup">
              <LogIn className="size-4" /> Create free account
            </Link>
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-lg lg:hidden"
            aria-label="Close fullscreen"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">{title}</h1>
            {description ? (
              <p className="truncate text-xs text-muted-foreground sm:text-sm">{description}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <div className="hidden items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 sm:flex">
              <span className="flex size-7 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                G
              </span>
              <span className="text-sm font-medium">Guest</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden rounded-lg sm:inline-flex"
              onClick={onClose}
            >
              Exit fullscreen
            </Button>
          </div>
        </header>

        <main className={cn("min-h-0 flex-1 overflow-y-auto p-4 sm:p-6")}>{children}</main>
      </div>
    </div>
  );
}
