import { useMemo, useState, type ReactNode } from "react";
import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, SearchX, SlidersHorizontal } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { EmptyState, FilterSearch, PageHeader } from "@/components/design-system";
import { TablePager, usePager } from "@/components/design-system/TablePager";
import { ErrorState, TableSkeleton } from "@/components/States";
import { KpiCard } from "@/components/audit-governance/KpiCard";
import { FindingSeverityBadge, FindingStatusBadge } from "@/components/audit-governance/GovernanceBadges";
import { SLAIndicator } from "@/components/audit-governance/SLAIndicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toUserMessage } from "@/lib/api/errors";
import {
  AUDIT_ORIGIN_LABEL,
  FINDING_SEVERITIES,
  FINDING_STATUSES,
  FINDING_TYPES,
  fetchFindings,
  findingTypeLabel,
  isOverdue,
  rcaLabel,
  type Finding,
} from "@/lib/findings";
import { findingSubjectLabel } from "@/lib/finding-subject";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/findings")({
  head: () => ({
    meta: [
      { title: "Findings — Aislix" },
      {
        name: "description",
        content: "Every problem found by AI audits and Digital audits — filter by store, date, category, priority and status.",
      },
    ],
  }),
  component: FindingsLayout,
});

/** Nested /findings/$findingId needs an Outlet or the list page stays stuck. */
function FindingsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isIndex = pathname === "/findings" || pathname === "/findings/";
  if (!isIndex) return <Outlet />;
  return (
    <AppShell title="" hidePageHeader>
      <FindingsMain />
    </AppShell>
  );
}

type Sort = "newest" | "oldest" | "priority";

type Filters = {
  q: string;
  auditType: string;
  store: string;
  category: string;
  subCategory: string;
  dateFrom: string;
  dateTo: string;
  problem: string;
  priority: string;
  status: string;
  reason: string;
  assignee: string;
  due: string;
  sort: Sort;
};

const EMPTY_FILTERS: Filters = {
  q: "",
  auditType: "all",
  store: "all",
  category: "all",
  subCategory: "all",
  dateFrom: "",
  dateTo: "",
  problem: "all",
  priority: "all",
  status: "all",
  reason: "all",
  assignee: "all",
  due: "all",
  sort: "newest",
};

const UNASSIGNED = "unassigned";
const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const DONE = new Set(["resolved", "closed", "dismissed", "rejected"]);

function activeCount(f: Filters): number {
  return (Object.keys(EMPTY_FILTERS) as (keyof Filters)[]).filter(
    (k) => k !== "q" && k !== "sort" && f[k] !== EMPTY_FILTERS[k],
  ).length;
}

function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function matches(row: Finding, f: Filters): boolean {
  if (f.auditType !== "all" && row.audit_origin !== f.auditType) return false;
  if (f.store !== "all" && row.store_id !== f.store) return false;
  if (f.category !== "all" && row.category !== f.category) return false;
  if (f.subCategory !== "all" && row.sub_category !== f.subCategory) return false;
  if (f.problem !== "all" && row.finding_type !== f.problem) return false;
  if (f.priority !== "all" && row.severity !== f.priority) return false;
  if (f.status !== "all" && row.status !== f.status) return false;
  if (f.reason !== "all" && row.rca_code !== f.reason) return false;
  if (f.assignee === UNASSIGNED && row.assigned_to) return false;
  if (f.assignee !== "all" && f.assignee !== UNASSIGNED && row.assigned_to !== f.assignee) return false;
  if (f.due === "past_due" && !isOverdue(row.due_at, row.status)) return false;
  if (f.dateFrom || f.dateTo) {
    const day = localDay(row.created_at);
    if (f.dateFrom && day < f.dateFrom) return false;
    if (f.dateTo && day > f.dateTo) return false;
  }
  const q = f.q.trim().toLowerCase();
  if (q) {
    const hay = [
      row.product_name,
      row.sku,
      row.store_name,
      row.title,
      row.description,
      row.category,
      row.sub_category,
      findingTypeLabel(row.finding_type),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function distinct(values: (string | null)[]): { id: string; name: string }[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))]
    .sort((a, b) => a.localeCompare(b))
    .map((v) => ({ id: v, name: v }));
}

function formatQty(value: number | null): string {
  return value == null ? "—" : value.toLocaleString("en-IN");
}

function formatVariance(value: number | null): string {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${value.toLocaleString("en-IN")}`;
}

function formatInr(value: number | null): string {
  return value == null ? "—" : `₹${Math.round(Math.abs(value)).toLocaleString("en-IN")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function FindingsMain() {
  const navigate = useNavigate();
  const [filters, setFiltersState] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const query = useQuery({
    queryKey: ["findings-register"],
    queryFn: () => fetchFindings({ all: true }),
    retry: false,
  });
  const rows = useMemo(() => query.data ?? [], [query.data]);

  const options = useMemo(() => {
    const stores = new Map<string, string>();
    const people = new Map<string, string>();
    for (const r of rows) {
      if (r.store_id) stores.set(r.store_id, r.store_name);
      if (r.assigned_to) people.set(r.assigned_to, r.assigned_name);
    }
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    const has = (key: keyof Finding, value: string) => rows.some((r) => r[key] === value);
    return {
      auditTypes: (Object.keys(AUDIT_ORIGIN_LABEL) as (keyof typeof AUDIT_ORIGIN_LABEL)[])
        .filter((o) => has("audit_origin", o))
        .map((o) => ({ id: o, name: AUDIT_ORIGIN_LABEL[o] })),
      stores: [...stores].map(([id, name]) => ({ id, name })).sort(byName),
      categories: distinct(rows.map((r) => r.category)),
      subCategories: distinct(
        rows.filter((r) => filters.category === "all" || r.category === filters.category).map((r) => r.sub_category),
      ),
      problems: FINDING_TYPES.filter((t) => has("finding_type", t.value)).map((t) => ({ id: t.value, name: t.label })),
      statuses: FINDING_STATUSES.filter((s) => has("status", s.value)).map((s) => ({ id: s.value, name: s.label })),
      reasons: distinct(rows.map((r) => r.rca_code)).map((o) => ({ id: o.id, name: rcaLabel(o.id) })),
      assignees: [...people].map(([id, name]) => ({ id, name })).sort(byName),
    };
  }, [rows, filters.category]);

  const filtered = useMemo(() => {
    const out = rows.filter((r) => matches(r, filters));
    if (filters.sort === "oldest") out.reverse();
    if (filters.sort === "priority") {
      out.sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9));
    }
    return out;
  }, [rows, filters]);

  const kpis = useMemo(
    () => ({
      total: filtered.length,
      open: filtered.filter((r) => !DONE.has(r.status)).length,
      critical: filtered.filter((r) => r.severity === "critical" && !DONE.has(r.status)).length,
      pastDue: filtered.filter((r) => isOverdue(r.due_at, r.status)).length,
    }),
    [filtered],
  );

  const pager = usePager(filtered.length, 25);
  const pageRows = filtered.slice(pager.start, pager.end);
  const count = activeCount(filters);
  const narrowed = count > 0 || filters.q.trim().length > 0;

  const setFilters = (patch: Partial<Filters>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
    pager.setPage(0);
  };
  const clearFilters = () => {
    setFiltersState({ ...EMPTY_FILTERS, sort: filters.sort });
    pager.setPage(0);
  };
  const openFinding = (id: string) => void navigate({ to: "/findings/$findingId", params: { findingId: id } });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Findings"
        description="Every problem found by AI audits and Digital audits — what went wrong, where, and whether it is fixed."
      />

      {query.isPending ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[88px] animate-pulse rounded-lg border border-[#D9E2E8] bg-[#F4F7F9]" />
          ))}
        </div>
      ) : !query.error ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="All findings" value={kpis.total.toLocaleString()} tone="info" />
          <KpiCard label="Still open" value={kpis.open.toLocaleString()} tone="warn" />
          <KpiCard label="Critical" value={kpis.critical.toLocaleString()} tone="danger" hint="Open, fix first" />
          <KpiCard label="Past due" value={kpis.pastDue.toLocaleString()} tone="neutral" />
        </div>
      ) : null}

      <section className="space-y-3 rounded-xl border border-[#D9E2E8] bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <FilterSearch
            value={filters.q}
            onChange={(value) => setFilters({ q: value })}
            placeholder="Search product, SKU, store or category…"
          />
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-3 text-sm font-medium text-[#04203F] transition-colors hover:bg-[#F4F7F9]",
              count > 0 ? "border-[#04203F]/40" : "border-[#D9E2E8]",
            )}
          >
            <SlidersHorizontal className="size-4 text-[#667085]" aria-hidden />
            Filters{count > 0 ? ` (${count})` : ""}
            <ChevronDown className={cn("size-4 text-[#667085] transition-transform", filtersOpen && "rotate-180")} aria-hidden />
          </button>
          <Select value={filters.sort} onValueChange={(v) => setFilters({ sort: v as Sort })}>
            <SelectTrigger className="h-10 w-[170px] rounded-lg" aria-label="Sort findings">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="priority">Highest priority</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtersOpen ? (
          <div className="grid gap-3 border-t border-[#D9E2E8] pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterField label="Audit type">
              <OptionSelect
                value={filters.auditType}
                onChange={(v) => setFilters({ auditType: v })}
                allLabel="AI and Digital"
                options={options.auditTypes}
                ariaLabel="Filter by audit type"
              />
            </FilterField>
            <FilterField label="Store">
              <OptionSelect
                value={filters.store}
                onChange={(v) => setFilters({ store: v })}
                allLabel="All stores"
                options={options.stores}
                ariaLabel="Filter by store"
              />
            </FilterField>
            <FilterField label="From">
              <Input
                type="date"
                value={filters.dateFrom}
                max={filters.dateTo || undefined}
                onChange={(e) => setFilters({ dateFrom: e.target.value })}
                className="h-10 rounded-lg"
                aria-label="From date"
              />
            </FilterField>
            <FilterField label="To">
              <Input
                type="date"
                value={filters.dateTo}
                min={filters.dateFrom || undefined}
                onChange={(e) => setFilters({ dateTo: e.target.value })}
                className="h-10 rounded-lg"
                aria-label="To date"
              />
            </FilterField>
            <FilterField label="Category">
              <OptionSelect
                value={filters.category}
                onChange={(v) => setFilters({ category: v, subCategory: "all" })}
                allLabel="All categories"
                options={options.categories}
                ariaLabel="Filter by category"
              />
            </FilterField>
            <FilterField label="Sub-category">
              <OptionSelect
                value={filters.subCategory}
                onChange={(v) => setFilters({ subCategory: v })}
                allLabel="All sub-categories"
                options={options.subCategories}
                ariaLabel="Filter by sub-category"
              />
            </FilterField>
            <FilterField label="Problem">
              <OptionSelect
                value={filters.problem}
                onChange={(v) => setFilters({ problem: v })}
                allLabel="All problems"
                options={options.problems}
                ariaLabel="Filter by problem type"
              />
            </FilterField>
            <FilterField label="Priority">
              <OptionSelect
                value={filters.priority}
                onChange={(v) => setFilters({ priority: v })}
                allLabel="All priorities"
                options={FINDING_SEVERITIES.map((s) => ({ id: s.value, name: s.label }))}
                ariaLabel="Filter by priority"
              />
            </FilterField>
            <FilterField label="Status">
              <OptionSelect
                value={filters.status}
                onChange={(v) => setFilters({ status: v })}
                allLabel="All statuses"
                options={options.statuses}
                ariaLabel="Filter by status"
              />
            </FilterField>
            <FilterField label="Reason">
              <OptionSelect
                value={filters.reason}
                onChange={(v) => setFilters({ reason: v })}
                allLabel="All reasons"
                options={options.reasons}
                ariaLabel="Filter by reason"
              />
            </FilterField>
            <FilterField label="Assigned to">
              <OptionSelect
                value={filters.assignee}
                onChange={(v) => setFilters({ assignee: v })}
                allLabel="Anyone"
                options={[{ id: UNASSIGNED, name: "Unassigned" }, ...options.assignees]}
                ariaLabel="Filter by assignee"
              />
            </FilterField>
            <FilterField label="Due">
              <OptionSelect
                value={filters.due}
                onChange={(v) => setFilters({ due: v })}
                allLabel="Any due date"
                options={[{ id: "past_due", name: "Past due only" }]}
                ariaLabel="Filter by due date"
              />
            </FilterField>
          </div>
        ) : null}

        {narrowed && rows.length ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085]">
            <span>
              {filtered.length.toLocaleString()} of {rows.length.toLocaleString()} findings match
            </span>
            <Button variant="ghost" size="sm" className="h-7 rounded-lg px-2 text-xs" onClick={clearFilters}>
              Clear all
            </Button>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-[#D9E2E8] bg-white">
        {query.isPending ? (
          <div className="p-4">
            <TableSkeleton rows={8} cols={8} />
          </div>
        ) : query.error ? (
          <div className="p-4">
            <ErrorState
              title="Couldn't load findings"
              description={toUserMessage(query.error)}
              onRetry={() => void query.refetch()}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={narrowed ? <SearchX className="size-5" /> : <AlertTriangle className="size-5" />}
              title={narrowed ? "No findings match your filters" : "No findings yet"}
              description={
                narrowed
                  ? "Try another store, date range, category or status."
                  : "Findings appear here automatically when an AI audit or Digital audit finds a problem."
              }
              action={
                narrowed ? (
                  <Button variant="subtle" size="sm" className="rounded-lg" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Date</TableHead>
                    <TableHead className="whitespace-nowrap">Audit type</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="whitespace-nowrap">Sub-category</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Problem</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="whitespace-nowrap">Assigned to</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead className="whitespace-nowrap text-right">₹ at risk</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>
                      <span className="sr-only">Audit</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer transition-colors hover:bg-[#F4F7F9]"
                      onClick={() => openFinding(row.id)}
                    >
                      <TableCell className="whitespace-nowrap text-sm text-[#667085]">{formatDate(row.created_at)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{AUDIT_ORIGIN_LABEL[row.audit_origin]}</TableCell>
                      <TableCell className="max-w-[180px] truncate text-sm" title={row.store_name}>
                        {row.store_name}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-sm" title={row.category ?? undefined}>
                        {row.category ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-sm" title={row.sub_category ?? undefined}>
                        {row.sub_category ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[260px]">
                        <Link
                          to="/findings/$findingId"
                          params={{ findingId: row.id }}
                          onClick={(e) => e.stopPropagation()}
                          className="block truncate font-medium text-[#04203F] hover:underline"
                          title={findingSubjectLabel(row)}
                        >
                          {findingSubjectLabel(row)}
                        </Link>
                        {row.sku && row.product_name ? (
                          <span className="block truncate text-xs text-[#667085]">{row.sku}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{findingTypeLabel(row.finding_type)}</TableCell>
                      <TableCell>
                        <FindingSeverityBadge severity={row.severity} />
                      </TableCell>
                      <TableCell>
                        <FindingStatusBadge status={row.status} className="whitespace-nowrap" />
                      </TableCell>
                      <TableCell>
                        {row.due_at ? <SLAIndicator dueAt={row.due_at} status={row.status} showRemaining={false} /> : "—"}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-sm">
                        {row.assigned_to ? row.assigned_name : <span className="text-[#667085]">Unassigned</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatQty(row.expected_value)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatQty(row.actual_value)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatVariance(row.variance_units)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatInr(row.variance_value_inr)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{rcaLabel(row.rca_code)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        {row.scan_id ? (
                          <Link
                            to="/results"
                            search={{ scan: row.scan_id }}
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm font-medium text-[#04203F] hover:underline"
                          >
                            Open audit
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="divide-y divide-[#D9E2E8] md:hidden">
              {pageRows.map((row) => (
                <li key={row.id}>
                  <Link
                    to="/findings/$findingId"
                    params={{ findingId: row.id }}
                    className="block p-4 transition-colors hover:bg-[#F4F7F9]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#04203F]">{findingSubjectLabel(row)}</p>
                        <p className="mt-0.5 truncate text-xs text-[#667085]">
                          {row.store_name} · {formatDate(row.created_at)}
                        </p>
                      </div>
                      <FindingSeverityBadge severity={row.severity} />
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      {[
                        { l: "Problem", v: findingTypeLabel(row.finding_type) },
                        { l: "Audit type", v: AUDIT_ORIGIN_LABEL[row.audit_origin] },
                        { l: "Category", v: [row.category, row.sub_category].filter(Boolean).join(" · ") || "—" },
                        { l: "Assigned to", v: row.assigned_to ? row.assigned_name : "Unassigned" },
                        { l: "Expected / Actual", v: `${formatQty(row.expected_value)} / ${formatQty(row.actual_value)}` },
                        { l: "₹ at risk", v: formatInr(row.variance_value_inr) },
                      ].map((item) => (
                        <div key={item.l} className="min-w-0">
                          <dt className="text-[#667085]">{item.l}</dt>
                          <dd className="mt-0.5 truncate font-medium tabular-nums text-[#04203F]">{item.v}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <FindingStatusBadge status={row.status} />
                      {row.due_at ? <SLAIndicator dueAt={row.due_at} status={row.status} showRemaining={false} /> : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            <TablePager pager={pager} noun="findings" className="border-t border-[#D9E2E8]" />
          </>
        )}
      </section>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs text-[#667085]">
      {label}
      {children}
    </label>
  );
}

function OptionSelect({
  value,
  onChange,
  allLabel,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: { id: string; name: string }[];
  ariaLabel: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-10 rounded-lg" aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
