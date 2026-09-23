import { Link } from "@tanstack/react-router";
import {
  ClipboardCheck,
  History,
  LayoutDashboard,
  LogIn,
  Plus,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Dashboard", href: "/guest", icon: LayoutDashboard },
  { label: "New audit", href: "/guest?intent=sample#start-scanning", icon: Plus },
  { label: "Audit history", href: "/guest#history", icon: History },
  { label: "Assigned audits", href: "/guest#assigned", icon: ClipboardCheck },
];

type GuestPageChromeProps = {
  children: ReactNode;
  className?: string;
};

/** Full-page guest workspace chrome — same feel as AppShell, no auth required. */
export function GuestPageChrome({ children, className }: GuestPageChromeProps) {
  return (
    <div className={cn("flex min-h-screen bg-surface", className)}>
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-card py-5 lg:flex">
        <div className="px-4">
          <Logo to="/" />
          <Badge variant="outline" className="mt-3 rounded-md text-[10px] uppercase tracking-wide">
            Guest mode
          </Badge>
        </div>
        <nav className="mt-6 flex flex-col gap-0.5 px-2">
          {NAV.map(({ label, href, icon: Icon }) => (
            <a
              key={label}
              href={href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </a>
          ))}
        </nav>
        <div className="mt-auto space-y-2 px-4 pb-2">
          <Button asChild variant="brand" size="sm" className="w-full rounded-lg">
            <Link to="/signup">
              <LogIn className="size-4" /> Create free account
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="w-full rounded-lg">
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1 lg:hidden">
            <Logo to="/" />
          </div>
          <div className="hidden min-w-0 flex-1 lg:block">
            <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
              Operations dashboard
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              Guest mode · Demo data · Run a real shelf scan below
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="rounded-md bg-[var(--aislix-supermarket-bg)] text-[10px] font-semibold uppercase tracking-wide text-[#4F6B2E]">
              Demo ON
            </Badge>
            <div className="flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5">
              <span className="flex size-7 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                G
              </span>
              <span className="hidden text-sm font-medium sm:inline">Guest</span>
            </div>
            <Button asChild variant="brand" size="sm" className="hidden rounded-lg sm:inline-flex">
              <Link to="/signup">Start free</Link>
            </Button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
