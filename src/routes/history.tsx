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
  const [query, setQuery] = useState("");
  const [store, setStore] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scans.filter((s) => {
      const matchesQuery =
        !q ||
        s.id.toLowerCase().includes(q) ||
        s.store.toLowerCase().includes(q) ||
        s.aisle.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q);
      const matchesStore = store === "all" || s.store === store;
      return matchesQuery && matchesStore;
    });
  }, [query, store]);

  const storeOptions = useMemo(() => Array.from(new Set(scans.map((s) => s.store))), []);

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
      <div className="card-surface p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
          <div className="relative min-w-0 flex-1 sm:col-span-2 lg:min-w-56">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by scan ID, store, aisle or city"
              className="h-10 rounded-xl pl-9"
            />
          </div>
          <Select value={store} onValueChange={setStore}>
            <SelectTrigger className="h-10 rounded-xl lg:w-52">
              <SelectValue placeholder="All stores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stores</SelectItem>
              {storeOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select defaultValue="30">
            <SelectTrigger className="h-10 rounded-xl lg:w-40">
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

        {loading ? (
          <div className="mt-6">
            <TableSkeleton rows={7} cols={6} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={<SearchX className="size-5" />}
              title="No scans match your filters"
              description="Try a different store, widen the date range, or clear your search."
              action={
                <Button
                  variant="subtle"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => {
                    setQuery("");
                    setStore("all");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          </div>
        ) : (
          <div className="mt-6 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scan</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead className="hidden md:table-cell">Aisle</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Brands</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Confidence</TableHead>
                  <TableHead className="text-right">Shelf health</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id} className="cursor-pointer transition-colors hover:bg-brand-soft/50">
                    <TableCell className="font-medium">
                      <Link to="/results" className="hover:text-brand">
                        {s.id}
                      </Link>
                    </TableCell>
                    <TableCell className="min-w-0">
                      <p className="truncate font-medium">{s.store}</p>
                      <p className="text-xs text-muted-foreground">{s.city}</p>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {s.aisle}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                      {s.date}
                      <span className="ml-1 text-xs">{s.time}</span>
                    </TableCell>
                    <TableCell className="text-right">{s.products || "—"}</TableCell>
                    <TableCell className="hidden text-right lg:table-cell">
                      {s.brands || "—"}
                    </TableCell>
                    <TableCell className="hidden text-right lg:table-cell">
                      {s.confidence ? `${s.confidence}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.shelfHealth ? (
                        <span
                          className={
                            s.shelfHealth >= 85
                              ? "text-accent-green"
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
                            ? "bg-accent-green/12 text-accent-green hover:bg-accent-green/12"
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
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Showing {loading ? "…" : filtered.length} of 1,284 scans
          </p>
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

