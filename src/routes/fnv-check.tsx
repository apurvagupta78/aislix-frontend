import { useMemo, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import {
  CheckPhoto,
  PhotoPicker,
  QuickCheckNotice,
  RecentChecks,
  StorePicker,
  VerdictPill,
  formatCheckTime,
  uploadQuickCheckPhoto,
  useRecentQuickChecks,
  type QuickCheckRowBase,
} from "@/components/quick-checks/QuickCheckParts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FNV_VERDICT_LABEL, fnvDefectLabel, type FnvVerdict } from "@/lib/quick-checks/quick-check-parse";
import { QUICK_CHECK_FOLDERS, runFnvCheck } from "@/lib/quick-checks/quick-checks.functions";

const DESCRIPTION = "Photograph fruit or vegetables. AI says whether they can be sold today, and what to do if not.";

export const Route = createFileRoute("/fnv-check")({
  head: () => ({
    meta: [{ title: "FNV check — Aislix" }, { name: "description", content: DESCRIPTION }],
  }),
  component: FnvCheckPage,
});

type CheckRow = QuickCheckRowBase & {
  item_hint: string | null;
  product: string | null;
  verdict: FnvVerdict;
  units_visible: number | null;
  units_not_sellable: number | null;
  defects: string[];
  reason: string | null;
  action: string | null;
  issues_raised: number;
};

const COLUMNS = "item_hint, product, verdict, units_visible, units_not_sellable, defects, reason, action, issues_raised";

const TONE: Record<FnvVerdict, "good" | "bad" | "neutral"> = {
  sellable: "good",
  not_sellable: "bad",
  check_manually: "neutral",
};

function itemName(row: CheckRow): string {
  return row.product ?? row.item_hint ?? "Produce";
}

function FnvCheckPage() {
  const queryClient = useQueryClient();
  const [storeId, setStoreId] = useState("");
  const [item, setItem] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const checks = useRecentQuickChecks<CheckRow>("fnv_checks", COLUMNS);

  const run = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Add a photo of the produce.");
      if (!storeId) throw new Error("Pick a store.");
      const { orgId, path } = await uploadQuickCheckPhoto(file, QUICK_CHECK_FOLDERS.fnv);
      return runFnvCheck({ data: { activeOrgId: orgId, storeId, storagePath: path, hint: item.trim() || null } });
    },
    onSuccess: async (out) => {
      toast.success(
        `${FNV_VERDICT_LABEL[out.result.verdict]}.${out.issueRaised ? " A fix was opened for the store." : ""}`,
      );
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      await queryClient.invalidateQueries({ queryKey: ["quick-checks", "fnv_checks"] });
      setSelectedId(out.id);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "The FNV check failed."),
  });

  const rows = checks.data ?? [];
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? rows[0] ?? null, [rows, selectedId]);

  return (
    <AppShell title="FNV check" description={DESCRIPTION}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <section aria-labelledby="new-check" className="h-fit rounded-2xl border border-[#D9E2E8] bg-white p-4 sm:p-5">
          <h2 id="new-check" className="text-base font-semibold text-[#04203F]">
            New FNV check
          </h2>
          <p className="mt-1 text-sm text-[#667085]">Can this produce be sold to a customer today?</p>
          <div className="mt-4 space-y-3">
            <StorePicker value={storeId} onChange={setStoreId} />
            <Input
              value={item}
              maxLength={80}
              onChange={(e) => setItem(e.target.value)}
              placeholder="Item (optional), e.g. Banana"
              aria-label="Item"
            />
            <PhotoPicker file={file} onChange={setFile} inputRef={fileInput} placeholder="Take or choose a photo of the produce" />
            <Button
              variant="brand"
              className="h-11 w-full rounded-xl"
              disabled={!file || !storeId || run.isPending}
              onClick={() => run.mutate()}
            >
              {run.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Checking produce…
                </>
              ) : (
                "Check produce"
              )}
            </Button>
            <p className="text-xs text-[#667085]">
              Take the photo close up, in good light. Produce that is not sellable opens a fix in{" "}
              <Link to="/corrective-actions" className="underline">
                Corrective Actions
              </Link>
              .
            </p>
          </div>
        </section>

        <section aria-labelledby="check-result" className="min-w-0 space-y-4">
          {checks.isPending ? (
            <div className="h-48 animate-pulse rounded-2xl border border-[#D9E2E8] bg-[#F4F7F9]" aria-busy="true" />
          ) : checks.isError ? (
            <QuickCheckNotice title="FNV checks unavailable" body="Refresh the page to try again." />
          ) : !selected ? (
            <QuickCheckNotice title="No FNV checks yet" body="Pick a store, photograph fruit or vegetables and run your first check." />
          ) : (
            <FnvResult row={selected} />
          )}
          <RecentChecks
            rows={rows}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
            title={(r) => `${r.stores?.name ?? "Store"} · ${itemName(r)}`}
            meta={(r) => (r.units_visible != null ? `${r.units_visible} unit${r.units_visible === 1 ? "" : "s"} seen` : "Produce")}
            pill={(r) => <VerdictPill label={FNV_VERDICT_LABEL[r.verdict]} tone={TONE[r.verdict]} />}
          />
        </section>
      </div>
    </AppShell>
  );
}

function FnvResult({ row }: { row: CheckRow & { photoUrl: string | null } }) {
  const defects = Array.isArray(row.defects) ? row.defects : [];
  return (
    <div id="check-result" className="rounded-2xl border border-[#D9E2E8] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[#04203F]">
            {row.stores?.name ?? "Store"} · {itemName(row)}
          </h2>
          <p className="mt-0.5 text-xs text-[#667085]">
            {formatCheckTime(row.created_at)}
            {row.issues_raised ? " · Fix opened" : ""}
          </p>
        </div>
        <VerdictPill label={FNV_VERDICT_LABEL[row.verdict]} tone={TONE[row.verdict]} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
        <CheckPhoto url={row.photoUrl} alt="Produce photo" />
        <div className="min-w-0 space-y-3">
          {row.reason ? (
            <p className="flex gap-2 text-sm text-[#04203F]">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-[#9B86D9]" aria-hidden />
              <span>{row.reason}</span>
            </p>
          ) : null}
          {row.units_visible != null || row.units_not_sellable != null ? (
            <dl className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-[#D9E2E8] px-3 py-2">
                <dt className="flex items-center gap-1.5 text-xs text-[#667085]">
                  <span aria-hidden className="size-1.5 rounded-full bg-[#8EC9E8]" /> Units seen
                </dt>
                <dd className="text-xl font-semibold tabular-nums text-[#04203F]">{row.units_visible ?? "N/A"}</dd>
              </div>
              <div className="rounded-xl border border-[#D9E2E8] px-3 py-2">
                <dt className="flex items-center gap-1.5 text-xs text-[#667085]">
                  <span aria-hidden className="size-1.5 rounded-full bg-[#F6CFDC]" /> Not sellable
                </dt>
                <dd className="text-xl font-semibold tabular-nums text-[#04203F]">{row.units_not_sellable ?? "N/A"}</dd>
              </div>
            </dl>
          ) : null}
          {defects.length ? (
            <ul className="flex flex-wrap gap-1.5" aria-label="Defects">
              {defects.map((d) => (
                <li key={d} className="rounded-full border border-[#ECBDCC] bg-white px-2 py-0.5 text-xs text-[#04203F]">
                  {fnvDefectLabel(d)}
                </li>
              ))}
            </ul>
          ) : null}
          {row.action ? (
            <div className="rounded-xl border border-[#D9E2E8] px-3 py-2">
              <p className="text-xs text-[#667085]">What to do</p>
              <p className="text-sm text-[#04203F]">{row.action}</p>
            </div>
          ) : null}
          {row.verdict === "check_manually" ? (
            <p className="rounded-xl bg-[#EEF1F4] px-3 py-2 text-sm text-[#667085]">
              The photo is too unclear for a verdict. Retake it closer, in better light, with the produce surface visible.
            </p>
          ) : null}
          <p className="text-xs text-[#667085]">AI detected · Read from image</p>
        </div>
      </div>
    </div>
  );
}
