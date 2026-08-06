import { createFileRoute, Link } from "@tanstack/react-router";
import { Filter, Download, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { scans } from "@/lib/aislix-data";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Scan History — Aislix Shelf Audits" },
      {
        name: "description",
        content: "Browse every shelf scan across your stores with confidence, shelf health and stock gaps.",
      },
      { property: "og:title", content: "Scan history — Aislix" },
      { property: "og:description", content: "A searchable archive of every shelf audit you've run." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  return (
    <AppShell
      title="Scan history"
      description="1,284 scans across 42 stores. Filter by store, category or date."
      actions={
        <Button variant="subtle" size="sm" className="rounded-xl">
          <Download className="size-4" /> Export CSV
        </Button>
      }
    >
      <div className="card-surface p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by scan ID or store" className="h-10 rounded-xl pl-9" />
          </div>
          <Select>
            <SelectTrigger className="h-10 w-44 rounded-xl">
              <SelectValue placeholder="All stores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stores</SelectItem>
              <SelectItem value="moremart">MoreMart Superstore</SelectItem>
              <SelectItem value="freshpick">FreshPick Hypermarket</SelectItem>
              <SelectItem value="kirana">Kirana network</SelectItem>
            </SelectContent>
          </Select>
          <Select>
            <SelectTrigger className="h-10 w-40 rounded-xl">
              <SelectValue placeholder="Last 30 days" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last quarter</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" className="rounded-xl">
            <Filter className="size-4" /> More filters
          </Button>
        </div>

        <div className="mt-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scan</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Aisle</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Products</TableHead>
                <TableHead className="text-right">Brands</TableHead>
                <TableHead className="text-right">Confidence</TableHead>
                <TableHead className="text-right">Shelf health</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scans.map((s) => (
                <TableRow key={s.id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link to="/results" className="hover:text-brand">
                      {s.id}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{s.store}</p>
                    <p className="text-xs text-muted-foreground">{s.city}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.aisle}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.date}
                    <span className="ml-1 text-xs">{s.time}</span>
                  </TableCell>
                  <TableCell className="text-right">{s.products || "—"}</TableCell>
                  <TableCell className="text-right">{s.brands || "—"}</TableCell>
                  <TableCell className="text-right">
                    {s.confidence ? `${s.confidence}%` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {s.shelfHealth ? (
                      <span
                        className={
                          s.shelfHealth >= 85
                            ? "text-brand"
                            : s.shelfHealth >= 70
                              ? "text-warning"
                              : "text-destructive"
                        }
                      >
                        {s.shelfHealth}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant="secondary"
                      className={`rounded-full ${
                        s.status === "completed"
                          ? "bg-brand-soft text-brand hover:bg-brand-soft"
                          : s.status === "processing"
                            ? "bg-warning/15 text-warning hover:bg-warning/15"
                            : "bg-destructive/10 text-destructive hover:bg-destructive/10"
                      }`}
                    >
                      {s.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Showing 8 of 1,284 scans</p>
          <div className="flex gap-2">
            <Button variant="subtle" size="sm" className="rounded-xl">
              Previous
            </Button>
            <Button variant="brand" size="sm" className="rounded-xl">
              Next
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
