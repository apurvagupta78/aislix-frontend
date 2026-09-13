import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Lightbulb,
  ScanLine,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorState, Skeleton, TableSkeleton } from "@/components/States";
import { roleDescriptions, roleLabels, type TeamRole } from "@/lib/account";
import {
  addStoreMember,
  fetchStoreHealthTrend,
  fetchStoreRecommendations,
  fetchStoreReports,
  fetchStoreScans,
  fetchStoreTeam,
  formatConfidence,
  formatDate,
  formatDateTime,
  formatNumber,
  formatScore,
  removeStoreMember,
  updateStoreMemberRole,
} from "@/lib/organization";

export function Panel({
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
  return (
    <section className="card-surface p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-semibold tracking-tight text-foreground">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const axisProps = {
  tick: { fill: "var(--muted-foreground)", fontSize: 11 },
  stroke: "var(--border)",
} as const;

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 12,
} as const;

/* ------------------------------ health trend ------------------------------ */

export function StoreHealthTrend({ storeId }: { storeId: string }) {
  const [days, setDays] = useState("30");
  const query = useQuery({
    queryKey: ["store-health-trend", storeId, days],
    queryFn: ({ signal }) => fetchStoreHealthTrend(storeId, Number(days), signal),
    retry: false,
  });
  const points = query.data?.points ?? [];

  return (
    <Panel
      title="Shelf health trend"
      description="Health score and AI confidence over time for this store."
      actions={
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="h-9 w-28 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 days</SelectItem>
            <SelectItem value="30">30 days</SelectItem>
            <SelectItem value="90">90 days</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      {query.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : query.isError ? (
        <ErrorState
          title="Trend unavailable"
          description={query.error instanceof Error ? query.error.message : undefined}
          onRetry={() => void query.refetch()}
        />
      ) : points.length === 0 ? (
        <EmptyState
          icon={<ScanLine className="size-5" />}
          title="No trend data yet"
          description="Run a few scans in this store to build a shelf health trend."
        />
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="healthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" {...axisProps} tickFormatter={(v: string) => formatDate(v)} />
              <YAxis domain={[0, 100]} {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => formatDate(String(v))} />
              <Area
                type="monotone"
                dataKey="shelf_health_score"
                name="Shelf health"
                stroke="var(--chart-2)"
                strokeWidth={2}
                fill="url(#healthFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------ recent scans ------------------------------ */

export function StoreRecentScans({ storeId }: { storeId: string }) {
  const query = useQuery({
    queryKey: ["store-scans", storeId],
    queryFn: ({ signal }) => fetchStoreScans(storeId, 10, signal),
    retry: false,
  });
  const items = query.data?.items ?? [];

  return (
    <Panel
      title="Recent scans"
      description="Latest shelf audits captured for this store."
      actions={
        <Button asChild variant="subtle" size="sm" className="rounded-xl">
          <Link to="/history">Full audit history</Link>
        </Button>
      }
    >
      {query.isPending ? (
        <TableSkeleton rows={5} cols={5} />
      ) : query.isError ? (
        <ErrorState
          title="Couldn't load scans"
          description={query.error instanceof Error ? query.error.message : undefined}
          onRetry={() => void query.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ScanLine className="size-5" />}
          title="No scans yet"
          description="Capture a shelf photo to generate this store's first audit."
          action={
            <Button asChild variant="brand" size="sm" className="rounded-xl">
              <Link to="/scan">Start a audit</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Audit</TableHead>
                  <TableHead>Captured</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Alerts</TableHead>
                  <TableHead className="text-right">Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((scan) => (
                  <TableRow key={scan.scan_id}>
                    <TableCell className="font-medium">
                      <Link
                        to="/results"
                        search={{ scan: scan.scan_id }}
                        className="text-brand hover:underline"
                      >
                        {scan.scan_id}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(scan.captured_at)}
                    </TableCell>
                    <TableCell>{formatScore(scan.shelf_health_score)}</TableCell>
                    <TableCell>{formatNumber(scan.products_detected)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatNumber(scan.low_stock_products)} low ·{" "}
                      {formatNumber(scan.out_of_stock_products)} out
                    </TableCell>
                    <TableCell className="text-right">
                      {formatConfidence(scan.average_confidence)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="space-y-3 md:hidden">
            {items.map((scan) => (
              <li key={scan.scan_id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    to="/results"
                    search={{ scan: scan.scan_id }}
                    className="truncate text-sm font-medium text-brand"
                  >
                    {scan.scan_id}
                  </Link>
                  <Badge variant="secondary" className="shrink-0 rounded-md">
                    {formatScore(scan.shelf_health_score)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(scan.captured_at)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatNumber(scan.products_detected)} products ·{" "}
                  {formatNumber(scan.low_stock_products)} low ·{" "}
                  {formatConfidence(scan.average_confidence)} confidence
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

/* --------------------------- recommendations ----------------------------- */

const impactVariant = {
  high: "destructive",
  medium: "default",
  low: "secondary",
} as const;

export function StoreRecommendations({ storeId }: { storeId: string }) {
  const query = useQuery({
    queryKey: ["store-recommendations", storeId],
    queryFn: ({ signal }) => fetchStoreRecommendations(storeId, signal),
    retry: false,
  });
  const items = query.data?.items ?? [];

  return (
    <Panel title="AI recommendations" description="Merchandising actions ranked by expected impact.">
      {query.isPending ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState
          title="Recommendations unavailable"
          description={query.error instanceof Error ? query.error.message : undefined}
          onRetry={() => void query.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Lightbulb className="size-5" />}
          title="No recommendations yet"
          description="Recommendations appear once this store has scan data to analyse."
        />
      ) : (
        <ul className="space-y-3">
          {items.map((rec) => (
            <li key={rec.id} className="flex gap-3 rounded-xl border border-border bg-surface p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                <Lightbulb className="size-4" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{rec.title}</p>
                  {rec.impact && (
                    <Badge variant={impactVariant[rec.impact]} className="rounded-md">
                      {rec.impact} impact
                    </Badge>
                  )}
                </div>
                {rec.detail && (
                  <p className="mt-1 text-sm text-muted-foreground">{rec.detail}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ------------------------- inventory reports ----------------------------- */

export function StoreReports({ storeId }: { storeId: string }) {
  const query = useQuery({
    queryKey: ["store-reports", storeId],
    queryFn: ({ signal }) => fetchStoreReports(storeId, signal),
    retry: false,
  });
  const items = query.data?.items ?? [];

  return (
    <Panel
      title="Inventory reports"
      description="Generated PDF and CSV reports for this store's audits."
    >
      {query.isPending ? (
        <TableSkeleton rows={4} cols={3} />
      ) : query.isError ? (
        <ErrorState
          title="Reports unavailable"
          description={query.error instanceof Error ? query.error.message : undefined}
          onRetry={() => void query.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-5" />}
          title="No reports available"
          description="Reports are published here after each completed shelf audit."
        />
      ) : (
        <ul className="divide-y divide-border">
          {items.map((report) => (
            <li
              key={report.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                  {report.kind === "csv" || report.kind === "xlsx" ? (
                    <FileSpreadsheet className="size-4" />
                  ) : (
                    <FileText className="size-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{report.label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[report.period, report.generated_at ? formatDate(report.generated_at) : null]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
              </div>
              {report.url ? (
                <Button asChild variant="subtle" size="sm" className="shrink-0 rounded-xl">
                  <a href={report.url} target="_blank" rel="noreferrer">
                    <Download className="size-4" /> Download
                  </a>
                </Button>
              ) : (
                <Button variant="subtle" size="sm" className="shrink-0 rounded-xl" disabled>
                  <Download className="size-4" /> Download
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ---------------------------- store team access -------------------------- */

const roles: TeamRole[] = ["owner", "admin", "manager", "viewer"];

export function StoreTeamPanel({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("manager");

  const query = useQuery({
    queryKey: ["store-team", storeId],
    queryFn: ({ signal }) => fetchStoreTeam(storeId, signal),
    retry: false,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["store-team", storeId] });

  const add = useMutation({
    mutationFn: () => addStoreMember(storeId, { email: email.trim(), role }),
    onSuccess: () => {
      void invalidate();
      setEmail("");
      toast.success("Access granted");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not add this member."),
  });

  const changeRole = useMutation({
    mutationFn: ({ id, nextRole }: { id: string; nextRole: TeamRole }) =>
      updateStoreMemberRole(storeId, id, nextRole),
    onSuccess: () => {
      void invalidate();
      toast.success("Role updated");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not update the role."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeStoreMember(storeId, id),
    onSuccess: () => {
      void invalidate();
      toast.success("Access removed");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not remove access."),
  });

  const items = query.data?.items ?? [];

  return (
    <Panel
      title="Team access"
      description="Grant per-store access. Granular role permissions arrive with the permissions engine."
    >
      <form
        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          if (!email.trim()) {
            toast.error("Enter a work email to invite.");
            return;
          }
          add.mutate();
        }}
      >
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@company.com"
          aria-label="Team member email"
        />
        <Select value={role} onValueChange={(v) => setRole(v as TeamRole)}>
          <SelectTrigger aria-label="Role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r} value={r}>
                {roleLabels[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" variant="brand" className="rounded-xl" disabled={add.isPending}>
          <UserPlus className="size-4" /> {add.isPending ? "Adding…" : "Add"}
        </Button>
      </form>
      <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
        {roleDescriptions[role]}
      </p>

      <div className="mt-4">
        {query.isPending ? (
          <TableSkeleton rows={3} cols={3} />
        ) : query.isError ? (
          <ErrorState
            title="Couldn't load store access"
            description={query.error instanceof Error ? query.error.message : undefined}
            onRetry={() => void query.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<UserPlus className="size-5" />}
            title="No one assigned yet"
            description="Add managers or viewers so they can scan and review this store."
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((member) => (
              <li
                key={member.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {member.name ?? member.email}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.name ? member.email : null}
                    {member.status ? ` · ${member.status}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Select
                    value={member.role}
                    onValueChange={(v) =>
                      changeRole.mutate({ id: member.id, nextRole: v as TeamRole })
                    }
                  >
                    <SelectTrigger className="h-9 w-32 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r} value={r}>
                          {roleLabels[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl text-destructive hover:text-destructive"
                    onClick={() => remove.mutate(member.id)}
                    disabled={remove.isPending}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
