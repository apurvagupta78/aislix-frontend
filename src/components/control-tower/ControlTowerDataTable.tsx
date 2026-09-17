import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Download, Search } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
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
import { EmptyState } from "@/components/States";
import { useGlobalFilters } from "@/lib/global-filters";
import { modelFilterLabel } from "@/lib/control-tower";

export type DataColumn<T> = {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
};

export function ControlTowerDataTable<T extends Record<string, unknown>>({
  title,
  description,
  columns,
  rows,
  searchKeys,
  onExportCsv,
  backTo = "/dashboard",
  backSearch,
  ctModel,
  demoBanner = true,
}: {
  title: string;
  description: string;
  columns: DataColumn<T>[];
  rows: T[];
  searchKeys: (keyof T)[];
  onExportCsv: () => void;
  backTo?: string;
  backSearch?: Record<string, unknown>;
  ctModel?: string;
  demoBanner?: boolean;
}) {
  const { filters } = useGlobalFilters();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const filtered = useMemo(() => {
    let list = rows;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((row) =>
        searchKeys.some((k) => String(row[k] ?? "").toLowerCase().includes(q)),
      );
    }
    if (sortKey) {
      list = [...list].sort((a, b) => {
        const av = String(a[sortKey as keyof T] ?? "");
        const bv = String(b[sortKey as keyof T] ?? "");
        const cmp = av.localeCompare(bv, undefined, { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [rows, query, searchKeys, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <AppShell
      title={title}
      description={description}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onExportCsv}>
            <Download className="mr-1 size-3" /> Export CSV
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to={backTo} search={backSearch}>
              <ArrowLeft className="mr-1 size-3" /> Control Tower
            </Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {demoBanner ? (
          <div className="rounded-xl border border-[var(--aislix-darkstore-border)] bg-[var(--aislix-darkstore-bg)] px-4 py-3 text-xs text-[var(--aislix-primary)]">
            <strong>Illustrative demo data</strong> — Phase 1E. Filters:{" "}
            {modelFilterLabel(ctModel as "all" | undefined)} · Period {filters.datePreset ?? "7d"}
            {filters.storeId ? " · Store filter active" : ""}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 rounded-xl border border-border bg-card p-4">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <Select
            value={sortKey ?? "none"}
            onValueChange={(v) => setSortKey(v === "none" ? null : v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Default order</SelectItem>
              {columns
                .filter((c) => c.sortable !== false)
                .map((c) => (
                  <SelectItem key={String(c.key)} value={String(c.key)}>
                    {c.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {!pageRows.length ? (
          <EmptyState title="No rows match" description="Try adjusting search or filters." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead
                      key={String(col.key)}
                      className={col.sortable !== false ? "cursor-pointer select-none" : undefined}
                      onClick={() => col.sortable !== false && toggleSort(String(col.key))}
                    >
                      {col.label}
                      {sortKey === String(col.key) ? (sortDir === "asc" ? " ↑" : " ↓") : null}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row, i) => (
                  <TableRow key={i}>
                    {columns.map((col) => (
                      <TableCell key={String(col.key)}>
                        {col.render
                          ? col.render(row)
                          : String(row[col.key as keyof T] ?? "")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {filtered.length} row{filtered.length === 1 ? "" : "s"}
            {query ? " (filtered)" : ""}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="flex items-center px-2">
              Page {page + 1} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
