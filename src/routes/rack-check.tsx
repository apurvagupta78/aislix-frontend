import { useMemo, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { requireOrgId } from "@/lib/db/context";
import { photoExtension, shrinkPhoto } from "@/lib/photo/shrink-photo";
import {
  BIN_STATUSES,
  BIN_STATUS_LABEL,
  RACK_STATUS_LABEL,
  type BinStatus,
  type RackCheckStatus,
  type RackShelf,
} from "@/lib/rack-check/rack-check-parse";
import { RACK_CHECK_FOLDER, runRackCheck } from "@/lib/rack-check/rack-check.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/rack-check")({
  head: () => ({
    meta: [
      { title: "Rack check — Aislix" },
      {
        name: "description",
        content: "Photograph a whole rack. AI marks every bin as empty, low, stocked or messy, and empty bins open a refill fix.",
      },
    ],
  }),
  component: RackCheckPage,
});

type StoreOption = { id: string; name: string; city: string | null };

type CheckRow = {
  id: string;
  store_id: string;
  storage_path: string;
  rack_code: string | null;
  rack_code_read: string | null;
  status: RackCheckStatus;
  shelves: RackShelf[];
  bins_total: number;
  bins_empty: number;
  bins_low: number;
  bins_stocked: number;
  bins_messy: number;
  bins_not_visible: number;
  summary: string | null;
  issues_raised: number;
  created_at: string;
  stores: { name: string | null; city: string | null } | null;
};

const STATUS_STYLE: Record<RackCheckStatus, string> = {
  good: "border-[#79E2A8] bg-[#79E2A8]/15 text-[#102A43]",
  attention: "border-[#8EC9E8] bg-[#8EC9E8]/15 text-[#102A43]",
  needs_refill: "border-[#F6CFDC] bg-[#FFEAF1] text-[#102A43]",
  none_found: "border-[#D9E2E8] bg-[#EEF1F4] text-[#667085]",
  unclear: "border-[#D9E2E8] bg-[#EEF1F4] text-[#667085]",
};

const BIN_STYLE: Record<BinStatus, string> = {
  stocked: "border-[#79E2A8] bg-[#79E2A8]/20",
  low: "border-[#8EC9E8] bg-[#8EC9E8]/25",
  empty: "border-[#F6CFDC] bg-[#FFEAF1]",
  messy: "border-[#9B86D9] bg-[#9B86D9]/15",
  not_visible: "border-[#D9E2E8] bg-[#EEF1F4]",
};

function rackLabel(row: Pick<CheckRow, "rack_code" | "rack_code_read">): string | null {
  return row.rack_code ?? row.rack_code_read;
}

function RackCheckPage() {
  const queryClient = useQueryClient();
  const [storeId, setStoreId] = useState<string>("");
  const [rackCode, setRackCode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const stores = useQuery({
    queryKey: ["rack-check-stores"],
    queryFn: async (): Promise<StoreOption[]> => {
      const orgId = await requireOrgId();
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, city")
        .eq("org_id", orgId)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return (data ?? []) as StoreOption[];
    },
  });

  const checks = useQuery({
    queryKey: ["rack-checks"],
    queryFn: async () => {
      const orgId = await requireOrgId();
      const { data, error } = await supabase
        .from("rack_checks" as never)
        .select(
          "id, store_id, storage_path, rack_code, rack_code_read, status, shelves, bins_total, bins_empty, bins_low, bins_stocked, bins_messy, bins_not_visible, summary, issues_raised, created_at, stores(name, city)",
        )
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      const rows = (data ?? []) as unknown as CheckRow[];
      const { data: signed } = rows.length
        ? await supabase.storage.from("audit-evidence").createSignedUrls(
            rows.map((r) => r.storage_path),
            3600,
          )
        : { data: [] };
      const urls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
      return rows.map((r) => ({ ...r, photoUrl: urls.get(r.storage_path) ?? null }));
    },
  });

  const run = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Add a photo of the whole rack.");
      if (!storeId) throw new Error("Pick a store.");
      const orgId = await requireOrgId();
      const photo = await shrinkPhoto(file);
      const path = `${orgId}/${RACK_CHECK_FOLDER}/${crypto.randomUUID()}.${photoExtension(photo)}`;
      const { error } = await supabase.storage
        .from("audit-evidence")
        .upload(path, photo, { upsert: false, contentType: photo.type || "image/jpeg" });
      if (error) throw new Error("Could not upload the photo. Try again.");
      return runRackCheck({
        data: { activeOrgId: orgId, storeId, storagePath: path, rackCode: rackCode.trim() || null },
      });
    },
    onSuccess: async (out) => {
      const opened = out.issuesRaised
        ? `${out.issuesRaised} fix${out.issuesRaised === 1 ? "" : "es"} opened.`
        : `Checked: ${RACK_STATUS_LABEL[out.result.status]}.`;
      const already = out.issuesAlreadyOpen
        ? ` ${out.issuesAlreadyOpen} bin${out.issuesAlreadyOpen === 1 ? " already has" : "s already have"} an open fix.`
        : "";
      toast.success(`${opened}${already}`);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      await queryClient.invalidateQueries({ queryKey: ["rack-checks"] });
      setSelectedId(out.id);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "The rack check failed."),
  });

  const rows = checks.data ?? [];
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? rows[0] ?? null, [rows, selectedId]);

  return (
    <AppShell
      title="Rack check"
      description="Photograph a whole rack. AI marks every bin as empty, low, stocked or messy, and empty bins open a refill fix."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <section
          aria-labelledby="new-check"
          className="h-fit rounded-2xl border border-[#D9E2E8] bg-white p-4 shadow-sm sm:p-5"
        >
          <h2 id="new-check" className="text-base font-semibold text-[#102A43]">
            New rack check
          </h2>
          <p className="mt-1 text-sm text-[#667085]">Which bins are empty, running low or messy right now?</p>

          <div className="mt-4 space-y-3">
            <Select value={storeId} onValueChange={setStoreId} disabled={!stores.data?.length}>
              <SelectTrigger className="h-10 rounded-xl" aria-label="Store">
                <SelectValue
                  placeholder={
                    stores.isPending ? "Loading stores…" : stores.data?.length ? "Choose a store" : "No stores in your access"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(stores.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.city && !s.name.toLowerCase().includes(s.city.toLowerCase()) ? `${s.name} · ${s.city}` : s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={rackCode}
              maxLength={24}
              onChange={(e) => setRackCode(e.target.value)}
              placeholder="Rack code (optional), e.g. D07"
              aria-label="Rack code"
            />
            <label
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-3 py-3 text-sm transition-colors duration-150",
                file ? "border-[#7DB7D6] bg-[#EEF6FA] text-[#102A43]" : "border-[#D9E2E8] text-[#667085] hover:bg-[#F4F7F9]",
              )}
            >
              <Camera className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 truncate">{file ? file.name : "Take or choose a photo of the whole rack"}</span>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <Button
              variant="brand"
              className="w-full rounded-xl"
              disabled={!file || !storeId || run.isPending}
              onClick={() => run.mutate()}
            >
              {run.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Checking rack…
                </>
              ) : (
                "Check rack"
              )}
            </Button>
            <p className="text-xs text-[#667085]">
              Stand back so the whole rack is in frame, with the normal 1x lens. Empty and messy bins open a fix in{" "}
              <Link to="/corrective-actions" className="underline">
                Corrective Actions
              </Link>
              .
            </p>
          </div>
        </section>

        <section aria-labelledby="check-result" className="space-y-4">
          {checks.isPending ? (
            <div className="h-48 animate-pulse rounded-2xl border border-[#D9E2E8] bg-[#F4F7F9]" aria-busy="true" />
          ) : checks.isError ? (
            <Notice title="Rack checks unavailable" body="Refresh the page to try again." />
          ) : !selected ? (
            <Notice title="No rack checks yet" body="Pick a store, photograph a whole rack and run your first check." />
          ) : (
            <CheckResult row={selected} />
          )}

          {rows.length > 1 ? (
            <div className="rounded-2xl border border-[#D9E2E8] bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-[#102A43]">Recent checks</h3>
              <ul className="mt-2 divide-y divide-[#EEF1F4]">
                {rows.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-150 hover:bg-[#F4F7F9]",
                        selected?.id === r.id && "bg-[#F4F7F9]",
                      )}
                    >
                      {r.photoUrl ? (
                        <img src={r.photoUrl} alt="" className="size-10 shrink-0 rounded-md object-cover" />
                      ) : (
                        <span className="size-10 shrink-0 rounded-md bg-[#EEF1F4]" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[#102A43]">
                          {r.stores?.name ?? "Store"}
                          {rackLabel(r) ? ` · Rack ${rackLabel(r)}` : ""}
                        </span>
                        <span className="block text-xs text-[#667085]">
                          {new Date(r.created_at).toLocaleString(undefined, {
                            day: "numeric",
                            month: "short",
                            hour: "numeric",
                            minute: "2-digit",
                          })}{" "}
                          · {r.bins_total} bin{r.bins_total === 1 ? "" : "s"}
                        </span>
                      </span>
                      <StatusPill status={r.status} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

function StatusPill({ status }: { status: RackCheckStatus }) {
  return (
    <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold", STATUS_STYLE[status])}>
      {RACK_STATUS_LABEL[status]}
    </span>
  );
}

function CountTile({ label, value, accent, hint }: { label: string; value: number; accent: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[#D9E2E8] border-l-4 bg-white px-3 py-2" style={{ borderLeftColor: accent }}>
      <p className="text-xs text-[#667085]">{label}</p>
      <p className="text-xl font-semibold tabular-nums text-[#102A43]">{value}</p>
      {hint ? <p className="text-[11px] text-[#667085]">{hint}</p> : null}
    </div>
  );
}

function CheckResult({ row }: { row: CheckRow & { photoUrl: string | null } }) {
  const rack = rackLabel(row);
  const verdict = row.status !== "unclear" && row.status !== "none_found";
  return (
    <div id="check-result" className="rounded-2xl border border-[#D9E2E8] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[#102A43]">
            {row.stores?.name ?? "Store"}
            {rack ? ` · Rack ${rack}` : ""}
          </h2>
          <p className="mt-0.5 text-xs text-[#667085]">
            {new Date(row.created_at).toLocaleString()}
            {row.issues_raised ? ` · ${row.issues_raised} fix${row.issues_raised === 1 ? "" : "es"} opened` : ""}
          </p>
        </div>
        <StatusPill status={row.status} />
      </div>

      {verdict ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <CountTile
            label="Bins checked"
            value={row.bins_total - row.bins_not_visible}
            accent="#7DB7D6"
            hint={row.bins_not_visible ? `${row.bins_not_visible} not visible` : undefined}
          />
          <CountTile label="Empty" value={row.bins_empty} accent="#F6CFDC" />
          <CountTile label="Low" value={row.bins_low} accent="#8EC9E8" />
          <CountTile label="Messy" value={row.bins_messy} accent="#9B86D9" />
          <CountTile label="Stocked" value={row.bins_stocked} accent="#79E2A8" />
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
        {row.photoUrl ? (
          <a href={row.photoUrl} target="_blank" rel="noopener noreferrer" className="block">
            <img
              src={row.photoUrl}
              alt="Rack photo"
              className="aspect-[3/4] w-full rounded-xl border border-[#D9E2E8] object-cover"
            />
          </a>
        ) : (
          <div className="flex aspect-[3/4] items-center justify-center rounded-xl bg-[#EEF1F4] text-xs text-[#667085]">
            Photo unavailable
          </div>
        )}
        <div className="min-w-0 space-y-3">
          {row.summary ? (
            <p className="flex gap-2 text-sm text-[#102A43]">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-[#9B86D9]" aria-hidden />
              <span>{row.summary}</span>
            </p>
          ) : null}
          {row.status === "unclear" ? (
            <p className="rounded-xl bg-[#EEF1F4] px-3 py-2 text-sm text-[#667085]">
              The photo is too unclear for a verdict, so no fixes were opened. Retake it from straight in front, in better
              light, with the whole rack in frame.
            </p>
          ) : null}
          {row.shelves.length ? (
            <BinGrid shelves={row.shelves} />
          ) : row.status !== "unclear" ? (
            <p className="rounded-xl bg-[#EEF1F4] px-3 py-3 text-sm text-[#667085]">No rack bins were found in this photo.</p>
          ) : null}
          <p className="text-xs text-[#667085]">AI detected · Counts calculated by Aislix</p>
        </div>
      </div>
    </div>
  );
}

function BinGrid({ shelves }: { shelves: RackShelf[] }) {
  return (
    <div className="space-y-2">
      <div className="space-y-1.5" role="table" aria-label="Bin status by shelf, top to bottom">
        {shelves.map((shelf, si) => (
          <div key={si} role="row" className="flex items-stretch gap-1.5">
            <span role="rowheader" className="flex w-14 shrink-0 items-center text-xs font-medium text-[#667085]">
              {shelf.shelf ? `Shelf ${shelf.shelf}` : `Row ${si + 1}`}
            </span>
            <div className="grid min-w-0 flex-1 gap-1.5" style={{ gridTemplateColumns: `repeat(${shelf.bins.length}, minmax(0, 1fr))` }}>
              {shelf.bins.map((bin, bi) => (
                <div
                  key={bi}
                  role="cell"
                  title={[bin.code ?? `Bin ${bi + 1}`, BIN_STATUS_LABEL[bin.status], bin.note].filter(Boolean).join(" · ")}
                  className={cn("min-w-0 rounded-lg border px-2 py-1.5", BIN_STYLE[bin.status])}
                >
                  <span className="block truncate text-[11px] font-medium text-[#102A43]">{bin.code ?? `Bin ${bi + 1}`}</span>
                  <span className="block truncate text-[11px] text-[#667085]">{BIN_STATUS_LABEL[bin.status]}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <ul className="flex flex-wrap gap-3 pt-1 text-[11px] text-[#667085]" aria-label="Legend">
        {BIN_STATUSES.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded border", BIN_STYLE[s])} aria-hidden />
            {BIN_STATUS_LABEL[s]}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-[#D9E2E8] bg-[#EEF1F4]/80 px-4 py-6">
      <p className="text-sm font-semibold text-[#102A43]">{title}</p>
      <p className="mt-1 text-sm text-[#667085]">{body}</p>
    </div>
  );
}
