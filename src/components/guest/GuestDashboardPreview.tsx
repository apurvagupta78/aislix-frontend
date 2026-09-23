import { GUEST_KPI_CARDS, GUEST_RECENT_AUDITS } from "@/lib/guest-dashboard-fixtures";

export function GuestDashboardPreview() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Guest workspace · Demo data
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          Operations AI Dashboard
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Explore the same layout signed-in teams use. Run a real shelf scan below — sample or
          upload.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {GUEST_KPI_CARDS.map((kpi, i) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-border bg-card p-4 shadow-soft"
            style={{ borderTopWidth: 3, borderTopColor: kpi.accent }}
          >
            <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{kpi.value}</p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{kpi.detail}</p>
            <span className="sr-only">Card {i + 1}</span>
          </div>
        ))}
      </div>

      <div
        id="history"
        className="overflow-hidden rounded-xl border border-border bg-card shadow-soft"
      >
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Recent audits</h3>
          <p className="text-xs text-muted-foreground">Illustrative demo rows · not live org data</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Audit</th>
                <th className="px-4 py-2.5 font-medium">Store</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Score</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {GUEST_RECENT_AUDITS.map((row) => (
                <tr key={row.name}>
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

      <div
        id="assigned"
        className="rounded-xl border border-[var(--aislix-local-border)] bg-[var(--aislix-local-bg)] px-4 py-3 text-sm text-foreground"
      >
        Assigned audits appear here after you create a workspace. In guest mode, start with a
        shelf scan below.
      </div>
    </div>
  );
}
