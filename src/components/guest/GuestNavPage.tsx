import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GUEST_TABLE_ROWS } from "@/lib/guest-ops-fixtures";
import { APP_NAV_SECTIONS } from "@/lib/navigation/app-nav";

function titleForPath(pathname: string): string {
  for (const section of APP_NAV_SECTIONS) {
    for (const item of section.items) {
      if (item.kind === "leaf" && (pathname === item.to || pathname.startsWith(`${item.to}/`))) {
        return item.label;
      }
      if (item.kind === "parent") {
        for (const child of item.children) {
          if (pathname === child.to || pathname.startsWith(`${child.to}/`)) return child.label;
        }
      }
    }
  }
  if (pathname.startsWith("/stores")) return "Stores / Outlets";
  if (pathname.startsWith("/operations/warehouses")) return "Warehouses";
  if (pathname.startsWith("/operations/distributors")) return "Distributors";
  return "Workspace";
}

/** Read-only demo body for Guest on non-dashboard AppShell routes. */
export function GuestNavPage({ pathname }: { pathname: string }) {
  const title = titleForPath(pathname);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Guest mode · Demo data
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          This is the same workspace area signed-in teams use. Demo rows are shown below. Create a
          free account to save audits and manage your stores.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="brand" className="rounded-xl">
          <Link to="/dashboard" search={{ intent: "sample" } as never}>
            Run sample audit
          </Link>
        </Button>
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/signup">Create free account</Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Demo records</h3>
            <p className="text-xs text-muted-foreground">Illustrative · not your live org</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Lock className="size-3" aria-hidden="true" />
            Read-only
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Store</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Score</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {GUEST_TABLE_ROWS.map((row) => (
                <tr key={`${row.name}-${row.store}`}>
                  <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.store}</td>
                  <td className="px-4 py-3 text-foreground">{row.status}</td>
                  <td className="px-4 py-3 tabular-nums text-foreground">{row.score}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
