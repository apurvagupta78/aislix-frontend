import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import {
  CheckPhoto,
  PhotoPicker,
  QuickCheckDisclaimer,
  QuickCheckResultSlot,
  StorePicker,
  formatCheckTime,
  uploadQuickCheckPhoto,
  useQuickCheckResult,
  type QuickCheckRowBase,
} from "@/components/quick-checks/QuickCheckParts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const DESCRIPTION = "Photograph a whole rack. AI marks every bin as empty, low, stocked or messy.";

export const Route = createFileRoute("/rack-check")({
  head: () => ({
    meta: [{ title: "Rack check — Aislix" }, { name: "description", content: DESCRIPTION }],
  }),
  component: RackCheckPage,
});

type CheckRow = QuickCheckRowBase & {
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
};

const COLUMNS =
  "rack_code, rack_code_read, status, shelves, bins_total, bins_empty, bins_low, bins_stocked, bins_messy, bins_not_visible, summary";

const STATUS_STYLE: Record<RackCheckStatus, string> = {
  good: "border-[#79E2A8] bg-[#79E2A8]/15 text-[#04203F]",
  attention: "border-[#8EC9E8] bg-[#8EC9E8]/15 text-[#04203F]",
  needs_refill: "border-[#F6CFDC] bg-[#FFEAF1] text-[#04203F]",
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
  const [storeId, setStoreId] = useState("");
  const [rackCode, setRackCode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const check = useQuickCheckResult<CheckRow>("rack_checks", COLUMNS, lastId);

  const run = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Add a photo of the whole rack.");
      if (!storeId) throw new Error("Pick a store.");
      const { orgId, path } = await uploadQuickCheckPhoto(file, RACK_CHECK_FOLDER);
      return runRackCheck({
        data: { activeOrgId: orgId, storeId, storagePath: path, rackCode: rackCode.trim() || null },
      });
    },
    onSuccess: (out) => {
      toast.success(`Checked: ${RACK_STATUS_LABEL[out.result.status]}.`);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setLastId(out.id);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "The rack check failed."),
  });

  return (
    <AppShell title="Rack check" description={DESCRIPTION}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <section aria-labelledby="new-check" className="h-fit rounded-2xl border border-[#D9E2E8] bg-white p-4 sm:p-5">
          <h2 id="new-check" className="text-base font-semibold text-[#04203F]">
            New rack check
          </h2>
          <p className="mt-1 text-sm text-[#667085]">Which bins are empty, running low or messy right now?</p>

          <div className="mt-4 space-y-3">
            <StorePicker value={storeId} onChange={setStoreId} />
            <Input
              value={rackCode}
              maxLength={24}
              onChange={(e) => setRackCode(e.target.value)}
              placeholder="Rack code (optional), e.g. D07"
              aria-label="Rack code"
            />
            <PhotoPicker file={file} onChange={setFile} inputRef={fileInput} placeholder="Take or choose a photo of the whole rack" />
            <Button
              variant="brand"
              className="h-11 w-full rounded-xl"
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
            <p className="text-xs text-[#667085]">Stand back so the whole rack is in frame, with the normal 1x lens.</p>
          </div>
        </section>

        <section aria-labelledby="check-result" className="min-w-0 space-y-4">
          <QuickCheckResultSlot
            id={lastId}
            query={check}
            running={run.isPending}
            emptyTitle="Your result will appear here"
            emptyBody="Pick a store, photograph a whole rack and run the check."
          >
            {(row) => <CheckResult row={row} />}
          </QuickCheckResultSlot>
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
    <div className="rounded-xl border border-[#D9E2E8] bg-white px-3 py-2">
      <p className="flex items-center gap-1.5 text-xs text-[#667085]">
        <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: accent }} />
        {label}
      </p>
      <p className="text-xl font-semibold tabular-nums text-[#04203F]">{value}</p>
      {hint ? <p className="text-[11px] text-[#667085]">{hint}</p> : null}
    </div>
  );
}

function CheckResult({ row }: { row: CheckRow & { photoUrl: string | null } }) {
  const rack = rackLabel(row);
  const verdict = row.status !== "unclear" && row.status !== "none_found";
  const shelves = Array.isArray(row.shelves) ? row.shelves : [];
  return (
    <div id="check-result" className="rounded-2xl border border-[#D9E2E8] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[#04203F]">
            {row.stores?.name ?? "Store"}
            {rack ? ` · Rack ${rack}` : ""}
          </h2>
          <p className="mt-0.5 text-xs text-[#667085]">{formatCheckTime(row.created_at)}</p>
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
        <CheckPhoto url={row.photoUrl} alt="Rack photo" />
        <div className="min-w-0 space-y-3">
          {row.summary ? (
            <p className="flex gap-2 text-sm text-[#04203F]">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-[#9B86D9]" aria-hidden />
              <span>{row.summary}</span>
            </p>
          ) : null}
          {row.status === "unclear" ? (
            <p className="rounded-xl bg-[#EEF1F4] px-3 py-2 text-sm text-[#667085]">
              The photo is too unclear for a verdict. Retake it from straight in front, in better light, with the whole rack
              in frame.
            </p>
          ) : null}
          {shelves.length ? (
            <BinGrid shelves={shelves} />
          ) : row.status !== "unclear" ? (
            <p className="rounded-xl bg-[#EEF1F4] px-3 py-3 text-sm text-[#667085]">No rack bins were found in this photo.</p>
          ) : null}
          <p className="text-xs text-[#667085]">AI detected · Counts calculated by Aislix</p>
        </div>
      </div>
      <div className="mt-4">
        <QuickCheckDisclaimer />
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
                  <span className="block truncate text-[11px] font-medium text-[#04203F]">{bin.code ?? `Bin ${bi + 1}`}</span>
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
