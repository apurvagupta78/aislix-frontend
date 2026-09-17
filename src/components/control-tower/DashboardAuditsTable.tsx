import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAssignmentId } from "@/components/AssignmentId";
import { cn } from "@/lib/utils";
import type { AuditExecutionRow } from "@/lib/control-tower";
import { DashboardSectionHeader } from "./DashboardSectionHeader";

const PAGE_SIZE = 10;

const STAGE_CLASS: Record<AuditExecutionRow["stage"], string> = {
  "Not started": "border-[var(--aislix-custom-border)] bg-[var(--aislix-custom-bg)] text-[var(--aislix-primary)]",
  "In progress": "border-[var(--aislix-warehouse-border)] bg-[var(--aislix-warehouse-bg)] text-[var(--aislix-primary)]",
  Completed: "border-[var(--aislix-supermarket-border)] bg-[var(--aislix-supermarket-bg)] text-[var(--aislix-primary)]",
};

function formatDate(value: string) {
  if (!value || value === "—") return "—";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function DashboardAuditsTable({
  rows,
  onDownloadCsv,
}: {
  rows: AuditExecutionRow[];
  onDownloadCsv?: () => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [
        formatAssignmentId(row.auditId),
        row.auditId,
        row.location,
        row.city,
        row.template,
        row.assignedTo,
        row.stage,
        row.date,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [query, rows]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const slice = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const openRow = (row: AuditExecutionRow) => {
    if (row.scanId) {
      void navigate({ to: "/results", search: { scan: row.scanId } });
      return;
    }
    toast.message("This audit has not produced results yet.", {
      description: "Open it again after the assignee starts or submits the audit.",
    });
  };

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--aislix-border)] bg-white shadow-[0_2px_10px_rgba(16,42,67,0.06)]">
      <div className="border-b border-[var(--aislix-border)] bg-white px-4 py-3 sm:px-5">
        <DashboardSectionHeader
          title="Store audits"
          description="Every assignment across stores in this workspace. Click a row to open results."
          viewAllTo="/dashboard/audit-execution"
          {...(onDownloadCsv ? { onDownloadCsv, downloadLabel: "Download CSV" } : {})}
        />
        <div className="relative mt-3 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-[var(--aislix-secondary)]" />
          <Input
            className="h-9 bg-[var(--aislix-surface)] pl-8 text-xs"
            placeholder="Search store, audit name, assignee, ID…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-[var(--aislix-secondary)]">
          No audits match the current filters for stores in this profile.
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Audit ID</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Audit Name</TableHead>
                <TableHead>Audit Assigned</TableHead>
                <TableHead>Stage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slice.map((row) => (
                <TableRow
                  key={row.auditId}
                  className="cursor-pointer"
                  onClick={() => openRow(row)}
                >
                  <TableCell className="whitespace-nowrap text-[var(--aislix-secondary)]">
                    {formatDate(row.date)}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-medium">{formatAssignmentId(row.auditId)}</TableCell>
                  <TableCell className="font-medium text-[var(--aislix-primary)]">{row.location}</TableCell>
                  <TableCell className="text-[var(--aislix-secondary)]">{row.city}</TableCell>
                  <TableCell>{row.template}</TableCell>
                  <TableCell>{row.assignedTo}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("rounded-full border", STAGE_CLASS[row.stage])}>
                      {row.stage}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t border-[var(--aislix-border)] bg-[var(--aislix-surface)] px-4 py-2.5 text-xs text-[var(--aislix-secondary)]">
            <span>
              {filtered.length} audit{filtered.length === 1 ? "" : "s"}
              {filtered.length !== rows.length ? ` (from ${rows.length})` : ""}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={safePage <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span>
                {safePage + 1} / {pageCount}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
