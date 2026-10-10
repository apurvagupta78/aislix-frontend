import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
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
import { shelfCsvText, type ShelfCsvProduct } from "@/lib/quick-checks/quick-check-parse";
import { QUICK_CHECK_FOLDERS, runShelfCsvCheck } from "@/lib/quick-checks/quick-checks.functions";
import { downloadBlob } from "@/lib/scan-results";

const DESCRIPTION = "Photograph a shelf. AI lists every brand, product and variant with its counts, ready to download as CSV.";

export const Route = createFileRoute("/shelf-to-csv")({
  head: () => ({
    meta: [{ title: "Shelf to CSV — Aislix" }, { name: "description", content: DESCRIPTION }],
  }),
  component: ShelfToCsvPage,
});

type CheckRow = QuickCheckRowBase & {
  shelf_label: string | null;
  products: ShelfCsvProduct[];
  products_count: number;
  brands_count: number;
  facings_total: number;
  units_total: number;
  image_quality: string | null;
};

const COLUMNS = "shelf_label, products, products_count, brands_count, facings_total, units_total, image_quality";

function checkTitle(row: CheckRow): string {
  return `${row.stores?.name ?? "Store"}${row.shelf_label ? ` · ${row.shelf_label}` : ""}`;
}

function csvFileName(row: CheckRow): string {
  const slug = checkTitle(row)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  return `aislix-shelf-${slug || "check"}-${row.created_at.slice(0, 10)}.csv`;
}

function ShelfToCsvPage() {
  const [storeId, setStoreId] = useState("");
  const [shelf, setShelf] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const check = useQuickCheckResult<CheckRow>("shelf_csv_checks", COLUMNS, lastId);

  const run = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Add a photo of the shelf.");
      if (!storeId) throw new Error("Pick a store.");
      const { orgId, path } = await uploadQuickCheckPhoto(file, QUICK_CHECK_FOLDERS.shelfCsv);
      return runShelfCsvCheck({ data: { activeOrgId: orgId, storeId, storagePath: path, hint: shelf.trim() || null } });
    },
    onSuccess: (out) => {
      toast.success(
        out.result.productsCount
          ? `${out.result.productsCount} product${out.result.productsCount === 1 ? "" : "s"} read from the shelf.`
          : "No products could be read from this photo.",
      );
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setLastId(out.id);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "The shelf check failed."),
  });

  return (
    <AppShell title="Shelf to CSV" description={DESCRIPTION}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <section aria-labelledby="new-check" className="h-fit rounded-2xl border border-[#D9E2E8] bg-white p-4 sm:p-5">
          <h2 id="new-check" className="text-base font-semibold text-[#04203F]">
            New shelf to CSV
          </h2>
          <p className="mt-1 text-sm text-[#667085]">What is on this shelf, and how much of each?</p>
          <div className="mt-4 space-y-3">
            <StorePicker value={storeId} onChange={setStoreId} />
            <Input
              value={shelf}
              maxLength={80}
              onChange={(e) => setShelf(e.target.value)}
              placeholder="Shelf or aisle (optional), e.g. Biscuits aisle"
              aria-label="Shelf or aisle"
            />
            <PhotoPicker file={file} onChange={setFile} inputRef={fileInput} placeholder="Take or choose a photo of the shelf" />
            <Button
              variant="brand"
              className="h-11 w-full rounded-xl"
              disabled={!file || !storeId || run.isPending}
              onClick={() => run.mutate()}
            >
              {run.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Reading shelf…
                </>
              ) : (
                "Read shelf"
              )}
            </Button>
            <p className="text-xs text-[#667085]">
              Stand straight in front of the shelf with the whole section in frame. A full shelf can take up to two minutes.
            </p>
          </div>
        </section>

        <section aria-labelledby="check-result" className="min-w-0 space-y-4">
          <QuickCheckResultSlot
            id={lastId}
            query={check}
            running={run.isPending}
            emptyTitle="Your shelf table will appear here"
            emptyBody="Pick a store, photograph a shelf and read it into a table you can download as CSV."
          >
            {(row) => <ShelfResult row={row} />}
          </QuickCheckResultSlot>
        </section>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-[#D9E2E8] bg-white px-3 py-2">
      <p className="flex items-center gap-1.5 text-xs text-[#667085]">
        <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: accent }} />
        {label}
      </p>
      <p className="text-xl font-semibold tabular-nums text-[#04203F]">{value}</p>
    </div>
  );
}

function ShelfResult({ row }: { row: CheckRow & { photoUrl: string | null } }) {
  const products = Array.isArray(row.products) ? row.products : [];
  return (
    <div id="check-result" className="rounded-2xl border border-[#D9E2E8] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[#04203F]">{checkTitle(row)}</h2>
          <p className="mt-0.5 text-xs text-[#667085]">
            {formatCheckTime(row.created_at)}
            {row.image_quality ? ` · Photo quality ${row.image_quality}` : ""}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl"
          disabled={!products.length}
          onClick={() => downloadBlob(`\uFEFF${shelfCsvText(products)}`, csvFileName(row), "text/csv;charset=utf-8")}
        >
          <Download className="size-4" /> Download CSV
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Products" value={row.products_count} accent="#9B86D9" />
        <Stat label="Brands" value={row.brands_count} accent="#7DB7D6" />
        <Stat label="Facings" value={row.facings_total} accent="#79E2A8" />
        <Stat label="Visible units" value={row.units_total} accent="#8EC9E8" />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[160px_minmax(0,1fr)]">
        <CheckPhoto url={row.photoUrl} alt="Shelf photo" />
        <div className="min-w-0">
          {products.length ? (
            <div className="overflow-x-auto rounded-xl border border-[#D9E2E8]">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-[#F4F7F9] text-xs text-[#667085]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Brand</th>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">Variant</th>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 text-right font-medium">Facings</th>
                    <th className="px-3 py-2 text-right font-medium">Units</th>
                    <th className="px-3 py-2 font-medium">Price</th>
                    <th className="px-3 py-2 font-medium">Promotion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF1F4] text-[#04203F]">
                  {products.map((p, i) => (
                    <tr key={i} className="transition-colors duration-150 hover:bg-[#F4F7F9]">
                      <td className="px-3 py-2">{p.brand ?? "—"}</td>
                      <td className="px-3 py-2 font-medium">{p.product}</td>
                      <td className="px-3 py-2">{p.variant ?? "—"}</td>
                      <td className="px-3 py-2 text-[#667085]">{p.category ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.facings ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.units ?? "—"}</td>
                      <td className="px-3 py-2">{p.price ?? "—"}</td>
                      <td className="px-3 py-2 text-[#667085]">{p.promotion ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-xl bg-[#EEF1F4] px-3 py-3 text-sm text-[#667085]">
              No products could be read from this photo. Retake it straight on, in good light, closer to the shelf.
            </p>
          )}
          <p className="mt-2 text-xs text-[#667085]">AI detected · Read from image · Totals calculated by Aislix</p>
        </div>
      </div>
      <div className="mt-4">
        <QuickCheckDisclaimer />
      </div>
    </div>
  );
}
