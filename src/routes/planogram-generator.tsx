import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2, Download, FileSpreadsheet, Loader2, Save, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { PlanogramEditor, QrSvg } from "@/components/planogram-generator/PlanogramEditor";
import {
  QuickCheckNotice,
  StorePicker,
  formatCheckTime,
  uploadQuickCheckPhoto,
} from "@/components/quick-checks/QuickCheckParts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { requireOrgId } from "@/lib/db/context";
import { uploadIntelligenceAttachment } from "@/lib/intelligence/intelligence.functions";
import { canManagePlanogram } from "@/lib/planogram";
import { createStorePlanogram, updateStorePlanogram } from "@/lib/planogram-library";
import { shelfLabelsPdf } from "@/lib/planogram-generator/labels-pdf";
import {
  MAX_GENERATOR_PHOTOS,
  MAX_RACKS,
  MAX_SHELVES,
  MAX_TYPED_PRODUCTS,
  PRIORITY_OPTIONS,
  SHELF_SPACE_BASE_URL,
  STORE_TYPES,
  isPlanogramLayout,
  layoutStats,
  rackPlanogramName,
  rackPlanogramRows,
  type InputProduct,
  type PlanogramLayout,
} from "@/lib/planogram-generator/layout";
import {
  PLANOGRAM_GENERATOR_FOLDER,
  approvePlanogramGeneration,
  generatePlanogram,
} from "@/lib/planogram-generator/planogram-generator.functions";
import { cn } from "@/lib/utils";

const DESCRIPTION =
  "Add shelf photos, shelf size and your product list. AI suggests where each product goes and how many facings it gets. Review, edit and approve.";

export const Route = createFileRoute("/planogram-generator")({
  head: () => ({
    meta: [{ title: "AI planogram generator — Aislix" }, { name: "description", content: DESCRIPTION }],
  }),
  component: PlanogramGeneratorPage,
});

type ProductMode = "file" | "type" | "photos";

type GenerationRow = {
  id: string;
  store_id: string;
  status: "draft" | "approved";
  store_type: string | null;
  layout: unknown;
  planogram_version_ids: string[] | null;
  created_at: string;
  approved_at: string | null;
  stores: { name: string | null; city: string | null } | null;
};

type SpaceRow = {
  location_code: string;
  physical_position: string;
  rack_number: number;
  shelf_number: number;
  space_number: number;
  products: Array<{ name: string; brand: string; facings: number | null }>;
  qr_token: string;
};

const PRODUCT_MODES: Array<{ id: ProductMode; label: string }> = [
  { id: "file", label: "Upload list" },
  { id: "type", label: "Type or paste" },
  { id: "photos", label: "Read from photos" },
];

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

/** One product per line: name, brand, category, SKU — commas or tabs (pasted from Excel). */
function parseTypedProducts(text: string): InputProduct[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const rows = lines.map((line) => (line.includes("\t") ? line.split("\t") : line.split(",")).map((c) => c.trim()));
  if (rows[0] && /^(product|item|name|sku name)/i.test(rows[0][0] ?? "")) rows.shift();
  return rows
    .map((r) => ({ name: r[0] ?? "", brand: r[1] ?? "", category: r[2] ?? "", sku: r[3] ?? "" }))
    .filter((p) => p.name)
    .slice(0, MAX_TYPED_PRODUCTS);
}

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function downloadBytes(bytes: Uint8Array, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function PlanogramGeneratorPage() {
  const queryClient = useQueryClient();
  const [storeId, setStoreId] = useState("");
  const [storeType, setStoreType] = useState<string>(STORE_TYPES[0]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [racks, setRacks] = useState("1");
  const [shelves, setShelves] = useState("5");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [productMode, setProductMode] = useState<ProductMode>("file");
  const [productFile, setProductFile] = useState<File | null>(null);
  const [typed, setTyped] = useState("");
  const [priorities, setPriorities] = useState<string[]>(["Bestsellers"]);
  const [priorityNote, setPriorityNote] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [layout, setLayout] = useState<PlanogramLayout | null>(null);
  const [dirty, setDirty] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const typedProducts = parseTypedProducts(typed);
  const hasProducts =
    (productMode === "file" && Boolean(productFile)) || (productMode === "type" && typedProducts.length > 0);
  const canGenerate = Boolean(storeId) && (photos.length > 0 || hasProducts);

  const isManager = useQuery({ queryKey: ["planogram-can-manage"], queryFn: () => canManagePlanogram(), retry: false });

  const recent = useQuery({
    queryKey: ["planogram-generations"],
    queryFn: async (): Promise<GenerationRow[]> => {
      const orgId = await requireOrgId();
      const { data, error } = await supabase
        .from("planogram_generations" as never)
        .select("id, store_id, status, store_type, layout, planogram_version_ids, created_at, approved_at, stores(name, city)")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as unknown as GenerationRow[];
    },
  });

  const open = recent.data?.find((g) => g.id === openId) ?? null;

  useEffect(() => {
    if (!open || layout) return;
    if (isPlanogramLayout(open.layout)) setLayout(open.layout);
  }, [open, layout]);

  const spaces = useQuery({
    queryKey: ["planogram-generation-spaces", openId],
    enabled: Boolean(openId) && open?.status === "approved",
    queryFn: async (): Promise<SpaceRow[]> => {
      const { data, error } = await supabase
        .from("shelf_spaces" as never)
        .select("location_code, physical_position, rack_number, shelf_number, space_number, products, qr_token")
        .eq("generation_id", openId!)
        .eq("status", "active")
        .order("rack_number")
        .order("shelf_number")
        .order("space_number");
      if (error) throw error;
      return (data ?? []) as unknown as SpaceRow[];
    },
  });

  const generate = useMutation({
    mutationFn: async () => {
      if (!storeId) throw new Error("Pick a store.");
      const orgId = await requireOrgId();
      const photoPaths: string[] = [];
      for (const photo of photos) {
        const { path } = await uploadQuickCheckPhoto(photo, PLANOGRAM_GENERATOR_FOLDER);
        photoPaths.push(path);
      }
      let uploaded: { path: string; name: string } | null = null;
      if (productMode === "file" && productFile) {
        const base64 = await readAsBase64(productFile);
        const att = await uploadIntelligenceAttachment({ data: { activeOrgId: orgId, name: productFile.name, base64 } });
        if (att.kind !== "csv" && att.kind !== "xlsx") throw new Error("The product list must be a CSV or Excel file.");
        uploaded = { path: att.path, name: att.name };
      }
      return generatePlanogram({
        data: {
          activeOrgId: orgId,
          storeId,
          storeType,
          photoPaths,
          racks: numberOrNull(racks),
          shelvesPerRack: numberOrNull(shelves),
          shelfWidthCm: numberOrNull(widthCm),
          shelfHeightCm: numberOrNull(heightCm),
          shelfDepthCm: null,
          productFile: uploaded,
          products: productMode === "type" ? typedProducts : [],
          priorities,
          priorityNote: priorityNote.trim(),
        },
      });
    },
    onSuccess: async (out) => {
      toast.success("Planogram ready. Review it before approving.");
      setDirty(false);
      setLayout(out.layout);
      setOpenId(out.id);
      await queryClient.invalidateQueries({ queryKey: ["planogram-generations"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "The planogram could not be generated."),
  });

  const saveLayout = async () => {
    if (!openId || !layout) return;
    const { error } = await supabase
      .from("planogram_generations" as never)
      .update({ layout, updated_at: new Date().toISOString() } as never)
      .eq("id", openId)
      .eq("status", "draft");
    if (error) throw new Error("Could not save your changes. Try again.");
    setDirty(false);
  };

  const save = useMutation({
    mutationFn: saveLayout,
    onSuccess: async () => {
      toast.success("Draft saved.");
      await queryClient.invalidateQueries({ queryKey: ["planogram-generations"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save the draft."),
  });

  const approve = useMutation({
    mutationFn: async () => {
      if (!open || !layout || !openId) throw new Error("Open a planogram first.");
      const stats = layoutStats(layout);
      if (!stats.products) throw new Error("Add at least one product before approving.");
      if (layout.racks.some((r) => r.shelves.some((s) => s.spaces.some((sp) => sp.products.some((p) => !p.name.trim()))))) {
        throw new Error("Some products have no name. Fill them in or remove them.");
      }
      await saveLayout();

      const orgId = await requireOrgId();
      const existingIds = open.planogram_version_ids ?? [];
      const byRack = new Map<number, string>();
      if (existingIds.length) {
        const { data } = await supabase.from("planogram_versions").select("id, name").in("id", existingIds);
        for (const v of (data ?? []) as Array<{ id: string; name: string }>) {
          const m = /Rack (\d+)/.exec(v.name);
          if (m) byRack.set(Number(m[1]), v.id);
        }
      }
      const ids = [...byRack.values()];
      for (const rack of layout.racks) {
        const rows = rackPlanogramRows(rack);
        if (!rows.length) continue;
        const name = rackPlanogramName(rack, layout.storeCode);
        const existing = byRack.get(rack.rack);
        if (existing) {
          await updateStorePlanogram({ versionId: existing, storeId: open.store_id, rows, sourceType: "ai", name });
          continue;
        }
        const id = await createStorePlanogram({ storeId: open.store_id, rows, sourceType: "ai", name });
        ids.push(id);
        const { error } = await supabase
          .from("planogram_generations" as never)
          .update({ planogram_version_ids: ids } as never)
          .eq("id", openId);
        if (error) throw new Error("Could not link the store planogram. Try again.");
      }
      return approvePlanogramGeneration({ data: { activeOrgId: orgId, generationId: openId } });
    },
    onSuccess: async (out) => {
      toast.success(`Approved. ${out.spaces.length} shelf labels are ready to print.`);
      await queryClient.invalidateQueries({ queryKey: ["planogram-generations"] });
      await queryClient.invalidateQueries({ queryKey: ["planogram-generation-spaces", openId] });
    },
    onError: async (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Could not approve the planogram.");
      await queryClient.invalidateQueries({ queryKey: ["planogram-generations"] });
    },
  });

  const togglePriority = (p: string) =>
    setPriorities((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const next = [...photos, ...Array.from(files)].slice(0, MAX_GENERATOR_PHOTOS);
    if (photos.length + files.length > MAX_GENERATOR_PHOTOS) toast.message(`Up to ${MAX_GENERATOR_PHOTOS} photos.`);
    setPhotos(next);
    if (photoInput.current) photoInput.current.value = "";
  };

  const openGeneration = (id: string) => {
    if (dirty && !window.confirm("You have unsaved changes. Open another planogram anyway?")) return;
    setDirty(false);
    setLayout(null);
    setOpenId(id);
  };

  const editLayout = (next: PlanogramLayout) => {
    setLayout(next);
    setDirty(true);
  };

  const downloadLabels = () => {
    const rows = spaces.data ?? [];
    if (!rows.length) return;
    const bytes = shelfLabelsPdf(
      open?.stores?.name ?? "Store",
      rows.map((s) => ({
        locationCode: s.location_code,
        position: s.physical_position,
        url: `${SHELF_SPACE_BASE_URL}${s.qr_token}`,
        products: Array.isArray(s.products) ? s.products : [],
      })),
    );
    downloadBytes(bytes, `shelf-labels-${layout?.storeCode ?? "store"}.pdf`, "application/pdf");
  };

  const approved = open?.status === "approved";

  return (
    <AppShell title="AI planogram generator" description={DESCRIPTION}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <section aria-labelledby="new-plan" className="h-fit rounded-2xl border border-[#D9E2E8] bg-white p-4 sm:p-5">
            <h2 id="new-plan" className="text-base font-semibold text-[#04203F]">
              New planogram
            </h2>
            <p className="mt-1 text-sm text-[#667085]">Which products go where, and how many facings each gets.</p>

            <div className="mt-4 space-y-3">
              <StorePicker value={storeId} onChange={setStoreId} />
              <Select value={storeType} onValueChange={setStoreType}>
                <SelectTrigger className="h-10 rounded-xl" aria-label="Store type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STORE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-3 py-3 text-sm transition-colors duration-150",
                    photos.length >= MAX_GENERATOR_PHOTOS
                      ? "pointer-events-none border-[#D9E2E8] text-[#667085] opacity-60"
                      : "border-[#D9E2E8] text-[#667085] hover:bg-[#F4F7F9]",
                  )}
                >
                  <Camera className="size-4 shrink-0" aria-hidden />
                  <span>
                    {photos.length
                      ? `${photos.length} of ${MAX_GENERATOR_PHOTOS} shelf photos · add more`
                      : `Add photos of the current shelves (up to ${MAX_GENERATOR_PHOTOS})`}
                  </span>
                  <input
                    ref={photoInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="sr-only"
                    onChange={(e) => addPhotos(e.target.files)}
                  />
                </label>
                {photos.length ? (
                  <ul className="mt-2 space-y-1">
                    {photos.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 text-xs text-[#04203F]">
                        <span className="min-w-0 truncate">{f.name}</span>
                        <button
                          type="button"
                          className="rounded p-1 text-[#667085] hover:bg-[#F4F7F9]"
                          onClick={() => setPhotos((cur) => cur.filter((_, j) => j !== i))}
                          aria-label={`Remove ${f.name}`}
                        >
                          <X className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <fieldset>
                <legend className="text-sm font-medium text-[#04203F]">Shelf size</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="text-xs text-[#667085]">
                    Racks
                    <Input
                      className="mt-1 h-10 rounded-xl"
                      inputMode="numeric"
                      value={racks}
                      onChange={(e) => setRacks(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
                      placeholder={`1–${MAX_RACKS}`}
                    />
                  </label>
                  <label className="text-xs text-[#667085]">
                    Shelves per rack
                    <Input
                      className="mt-1 h-10 rounded-xl"
                      inputMode="numeric"
                      value={shelves}
                      onChange={(e) => setShelves(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
                      placeholder={`1–${MAX_SHELVES}`}
                    />
                  </label>
                  <label className="text-xs text-[#667085]">
                    Width (cm)
                    <Input
                      className="mt-1 h-10 rounded-xl"
                      inputMode="numeric"
                      value={widthCm}
                      onChange={(e) => setWidthCm(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                      placeholder="e.g. 120"
                    />
                  </label>
                  <label className="text-xs text-[#667085]">
                    Shelf height (cm)
                    <Input
                      className="mt-1 h-10 rounded-xl"
                      inputMode="numeric"
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
                      placeholder="e.g. 35"
                    />
                  </label>
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-medium text-[#04203F]">Products</legend>
                <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-[#F4F7F9] p-1" role="radiogroup" aria-label="Product list source">
                  {PRODUCT_MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={productMode === m.id}
                      onClick={() => setProductMode(m.id)}
                      className={cn(
                        "rounded-lg px-2 py-1.5 text-xs transition-colors duration-150",
                        productMode === m.id ? "border border-[#D9E2E8] bg-white font-medium text-[#04203F]" : "text-[#667085]",
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                {productMode === "file" ? (
                  <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#D9E2E8] px-3 py-3 text-sm text-[#667085] transition-colors duration-150 hover:bg-[#F4F7F9]">
                    <FileSpreadsheet className="size-4 shrink-0" aria-hidden />
                    <span className={cn("min-w-0 truncate", productFile && "text-[#04203F]")}>
                      {productFile ? productFile.name : "CSV or Excel: product, brand, category, SKU"}
                    </span>
                    <input
                      ref={fileInput}
                      type="file"
                      accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className="sr-only"
                      onChange={(e) => setProductFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                ) : null}
                {productMode === "type" ? (
                  <div className="mt-2">
                    <Textarea
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      rows={5}
                      className="rounded-xl text-sm"
                      placeholder={"One product per line: name, brand, category, SKU\nDove Soap 100g, Dove, Soap, 8901030\nLux Soap 150g, Lux, Soap"}
                      aria-label="Product list"
                    />
                    <p className="mt-1 text-xs text-[#667085]">
                      {typedProducts.length
                        ? `${typedProducts.length} products read. You can paste straight from Excel.`
                        : "You can paste straight from Excel."}
                    </p>
                  </div>
                ) : null}
                {productMode === "photos" ? (
                  <p className="mt-2 rounded-xl border border-[#D9E2E8] px-3 py-2 text-xs text-[#667085]">
                    AI uses only the products it can clearly read in your shelf photos.
                    {photos.length ? "" : " Add at least one photo."}
                  </p>
                ) : null}
              </fieldset>

              <fieldset>
                <legend className="text-sm font-medium text-[#04203F]">Give more visibility to</legend>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {PRIORITY_OPTIONS.map((p) => {
                    const on = priorities.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={on}
                        onClick={() => togglePriority(p)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition-colors duration-150",
                          on ? "border-[#04203F] bg-[#04203F] text-white" : "border-[#D9E2E8] text-[#04203F] hover:bg-[#F4F7F9]",
                        )}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
                <Input
                  className="mt-2 h-10 rounded-xl"
                  value={priorityNote}
                  maxLength={500}
                  onChange={(e) => setPriorityNote(e.target.value)}
                  placeholder="Anything else? e.g. Push Dove, keep kids items low"
                  aria-label="Priority note"
                />
              </fieldset>

              <Button
                variant="brand"
                className="h-11 w-full rounded-xl"
                disabled={!canGenerate || generate.isPending}
                onClick={() => generate.mutate()}
              >
                {generate.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Designing the shelf…
                  </>
                ) : (
                  "Generate planogram"
                )}
              </Button>
              <p className="text-xs text-[#667085]">
                {generate.isPending
                  ? "This can take up to two minutes. Keep this page open."
                  : "Nothing goes live until a manager approves it."}
              </p>
            </div>
          </section>

          <section aria-labelledby="recent-plans" className="rounded-2xl border border-[#D9E2E8] bg-white p-4 sm:p-5">
            <h2 id="recent-plans" className="text-sm font-semibold text-[#04203F]">
              Recent planograms
            </h2>
            {recent.isPending ? (
              <div className="mt-3 h-16 animate-pulse rounded-xl bg-[#F4F7F9]" />
            ) : recent.data?.length ? (
              <ul className="mt-2 divide-y divide-[#EEF1F4]">
                {recent.data.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => openGeneration(g.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors duration-150 hover:bg-[#F4F7F9]",
                        g.id === openId && "bg-[#F4F7F9]",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[#04203F]">{g.stores?.name ?? "Store"}</span>
                        <span className="block text-xs text-[#667085]">{formatCheckTime(g.created_at)}</span>
                      </span>
                      <StatusPill approved={g.status === "approved"} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[#667085]">No planograms yet.</p>
            )}
          </section>
        </div>

        <section aria-labelledby="plan-result" className="min-w-0 space-y-4">
          {generate.isPending ? (
            <div className="h-64 animate-pulse rounded-2xl border border-[#D9E2E8] bg-[#F4F7F9]" aria-busy="true" />
          ) : !openId ? (
            <QuickCheckNotice
              title="Your planogram will appear here"
              body="Pick a store, add shelf photos or a product list, and generate. You can edit every space before approving."
            />
          ) : !layout || !open ? (
            <div className="h-64 animate-pulse rounded-2xl border border-[#D9E2E8] bg-[#F4F7F9]" aria-busy="true" />
          ) : (
            <>
              <PlanSummary
                storeName={open.stores?.name ?? "Store"}
                createdAt={open.created_at}
                approved={approved}
                layout={layout}
                dirty={dirty}
                canApprove={isManager.data === true}
                saving={save.isPending}
                approving={approve.isPending}
                onSave={() => save.mutate()}
                onApprove={() => approve.mutate()}
              />
              <div className="rounded-2xl border border-[#D9E2E8] bg-white p-4 sm:p-5">
                <h2 id="plan-result" className="text-base font-semibold text-[#04203F]">
                  Shelf layout
                </h2>
                <p className="mb-3 mt-1 text-xs text-[#667085]">
                  AI suggested · Location IDs by Aislix{approved ? " · Approved" : " · Edit anything before approving"}
                </p>
                <PlanogramEditor key={openId} layout={layout} readOnly={approved} onChange={editLayout} />
                {approved ? null : (
                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-[#EEF1F4] pt-4">
                    <span className="mr-auto text-xs text-[#667085]">{dirty ? "You have unsaved changes." : "All changes saved."}</span>
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      disabled={!dirty || save.isPending || approve.isPending}
                      onClick={() => save.mutate()}
                    >
                      {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save draft
                    </Button>
                    {isManager.data === true ? (
                      <Button
                        variant="brand"
                        className="rounded-xl"
                        disabled={approve.isPending || save.isPending}
                        onClick={() => approve.mutate()}
                      >
                        {approve.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}{" "}
                        Approve
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
              {approved ? (
                <ShelfLabels
                  loading={spaces.isPending}
                  spaces={spaces.data ?? []}
                  storeName={open.stores?.name ?? "Store"}
                  onDownload={downloadLabels}
                />
              ) : null}
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function StatusPill({ approved }: { approved: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        approved ? "border-[#79E2A8] bg-[#79E2A8]/15 text-[#04203F]" : "border-[#D9E2E8] bg-[#EEF1F4] text-[#667085]",
      )}
    >
      {approved ? "Approved" : "Draft"}
    </span>
  );
}

function PlanSummary({
  storeName,
  createdAt,
  approved,
  layout,
  dirty,
  canApprove,
  saving,
  approving,
  onSave,
  onApprove,
}: {
  storeName: string;
  createdAt: string;
  approved: boolean;
  layout: PlanogramLayout;
  dirty: boolean;
  canApprove: boolean;
  saving: boolean;
  approving: boolean;
  onSave: () => void;
  onApprove: () => void;
}) {
  const stats = layoutStats(layout);
  const tiles: Array<{ label: string; value: number; dot: string }> = [
    { label: "Racks", value: stats.racks, dot: "bg-[#7DB7D6]" },
    { label: "Shelves", value: stats.shelves, dot: "bg-[#9B86D9]" },
    { label: "Shelf spaces", value: stats.spaces, dot: "bg-[#7DB7D6]" },
    { label: "Products placed", value: stats.products, dot: "bg-[#9B86D9]" },
  ];
  return (
    <div className="rounded-2xl border border-[#D9E2E8] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold text-[#04203F]">{storeName}</h2>
            <StatusPill approved={approved} />
          </div>
          <p className="mt-0.5 text-xs text-[#667085]">
            Store code {layout.storeCode} · {formatCheckTime(createdAt)}
          </p>
        </div>
        {approved ? null : (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-xl" disabled={!dirty || saving || approving} onClick={onSave}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save draft
            </Button>
            {canApprove ? (
              <Button variant="brand" className="rounded-xl" disabled={approving || saving} onClick={onApprove}>
                {approving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Approve
              </Button>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-[#D9E2E8] px-3 py-2">
            <p className="flex items-center gap-1.5 text-xs text-[#667085]">
              <span className={cn("size-1.5 rounded-full", t.dot)} aria-hidden /> {t.label}
            </p>
            <p className="mt-0.5 text-lg font-semibold text-[#04203F]">{t.value}</p>
          </div>
        ))}
      </div>

      {stats.notInList ? (
        <p className="mt-3 rounded-xl border border-[#ECBDCC] px-3 py-2 text-sm text-[#04203F]">
          {stats.notInList} placed {stats.notInList === 1 ? "product is" : "products are"} not in your product list. Check
          them before approving.
        </p>
      ) : null}

      {layout.summary ? (
        <p className="mt-3 flex gap-2 text-sm text-[#04203F]">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-[#9B86D9]" aria-hidden />
          <span>{layout.summary}</span>
        </p>
      ) : null}

      {layout.assumptions.length || layout.missing.length ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {layout.assumptions.length ? (
            <div>
              <p className="text-xs font-medium text-[#04203F]">Assumptions</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-[#667085]">
                {layout.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {layout.missing.length ? (
            <div>
              <p className="text-xs font-medium text-[#04203F]">Missing information</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-[#667085]">
                {layout.missing.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {approved ? (
        <p className="mt-3 text-xs text-[#667085]">
          Saved to this store's planogram library as AI generated (one planogram per rack). Your team can now assign audits
          against it.
        </p>
      ) : canApprove ? null : (
        <p className="mt-3 text-xs text-[#667085]">A manager or admin approves planograms. Save your edits as a draft.</p>
      )}
      <p className="mt-3 border-t border-[#EEF1F4] pt-3 text-xs text-[#667085]">
        AI-generated suggestions may contain errors. Review the layout before approving.
      </p>
    </div>
  );
}

function ShelfLabels({
  loading,
  spaces,
  storeName,
  onDownload,
}: {
  loading: boolean;
  spaces: SpaceRow[];
  storeName: string;
  onDownload: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[#D9E2E8] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[#04203F]">Shelf QR labels</h2>
          <p className="mt-0.5 text-xs text-[#667085]">
            Stick each label on its space. Anyone who scans it sees what belongs there — no login needed.
          </p>
        </div>
        <Button variant="brand" className="rounded-xl" disabled={!spaces.length} onClick={onDownload}>
          <Download className="size-4" /> Download labels (PDF)
        </Button>
      </div>
      {loading ? (
        <div className="mt-3 h-24 animate-pulse rounded-xl bg-[#F4F7F9]" />
      ) : spaces.length ? (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {spaces.map((s) => {
            const url = `${SHELF_SPACE_BASE_URL}${s.qr_token}`;
            return (
              <li key={s.location_code}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-[#D9E2E8] p-2 transition-colors duration-150 hover:border-[#04203F]"
                >
                  <QrSvg value={url} size={64} label={`QR code for ${s.location_code} at ${storeName}`} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[#04203F]">{s.location_code}</span>
                    <span className="block truncate text-xs text-[#667085]">{s.physical_position}</span>
                    <span className="block text-xs text-[#667085]">
                      {Array.isArray(s.products) && s.products.length
                        ? `${s.products.length} product${s.products.length === 1 ? "" : "s"}`
                        : "Leave free"}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[#667085]">No active labels. They may have been replaced by a newer planogram.</p>
      )}
    </div>
  );
}
