import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Camera,
  Check,
  ImageIcon,
  Loader2,
  MapPin,
  Plus,
  ScanLine,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fetchStores } from "@/lib/account";
import { FALLBACK_CATEGORIES, type ShelfCategory } from "@/lib/categories.data";
import { fetchShelfCategories } from "@/lib/categories.functions";

import {
  LimitReachedDialog,
  toLimitDialogState,
  type LimitDialogState,
} from "@/components/billing/LimitReachedDialog";
import { getAssignmentScanContext } from "@/lib/assignment-context.functions";
import { startAssignment } from "@/lib/assignments";

import { MAX_SCAN_IMAGES, formatBytes, submitScanImages, validateScanFile } from "@/lib/scan-api";
import { PlanogramBuilder } from "@/components/planogram/PlanogramBuilder";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ClipboardList } from "lucide-react";
import {
  fetchActivePlanogram,
  fetchPlanogramItems,
  type DraftRow,
} from "@/lib/planogram";
import { toUserMessage } from "@/lib/api/errors";

export const Route = createFileRoute("/scan")({
  validateSearch: (search: Record<string, unknown>): { assignmentId?: string } => {
    const raw = search["assignmentId"];
    return typeof raw === "string" && raw.trim() ? { assignmentId: raw.trim() } : {};
  },
  head: () => ({
    meta: [
      { title: "Scan a Shelf — Aislix" },
      {
        name: "description",
        content:
          "Set store, location, category and subcategory, then capture or upload shelf photos for an AI audit.",
      },
      { property: "og:title", content: "Scan a shelf — Aislix" },
      {
        property: "og:description",
        content:
          "Set store, location, category and subcategory, then capture or upload shelf photos.",
      },

      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScanPage,
});

const CATEGORY_QUERY_KEY = ["shelf-categories"] as const;

type Phase = "idle" | "uploading" | "error";

type Attachment = { id: string; file: File; url: string };

function ScanPage() {
  const navigate = useNavigate();
  const { assignmentId } = Route.useSearch();
  const [items, setItems] = useState<Attachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [limitDialog, setLimitDialog] = useState<LimitDialogState>(null);

  const [storeId, setStoreId] = useState("");
  const [planogramOpen, setPlanogramOpen] = useState(false);
  const [planogramRows, setPlanogramRows] = useState<DraftRow[]>([]);
  const [planogramLoading, setPlanogramLoading] = useState(false);
  const [planogramNotice, setPlanogramNotice] = useState<string | null>(null);
  const [shelfLocation, setShelfLocation] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [subCategoryCustom, setSubCategoryCustom] = useState("");
  const [showSetupErrors, setShowSetupErrors] = useState(false);

  const storesQuery = useQuery({
    queryKey: ["stores", "scan-setup"],
    queryFn: () => fetchStores(),
    retry: false,
    staleTime: 60_000,
  });
  const stores = storesQuery.data?.items ?? [];

  const categoriesQuery = useQuery({
    queryKey: CATEGORY_QUERY_KEY,
    queryFn: () => fetchShelfCategories(),
    retry: false,
    staleTime: 10 * 60_000,
  });
  const categories: ShelfCategory[] = categoriesQuery.data?.length
    ? categoriesQuery.data
    : FALLBACK_CATEGORIES;

  const assignmentQuery = useQuery({
    queryKey: ["assignment-scan-context", assignmentId],
    queryFn: () => getAssignmentScanContext({ data: { assignmentId: assignmentId! } }),
    enabled: Boolean(assignmentId),
    retry: false,
  });
  const assignment = assignmentQuery.data ?? null;
  const lockedByAssignment = Boolean(assignment);
  const loadingAssignment = Boolean(assignmentId) && assignmentQuery.isPending;

  useEffect(() => {
    if (!assignment) return;
    setStoreId(assignment.store_id);
    setShelfLocation(assignment.location);
    setCategory(assignment.category);
    setSubCategory(assignment.sub_category);
  }, [assignment]);

  // The member has effectively started the task as soon as the form is open.
  const startedRef = useRef(false);
  useEffect(() => {
    if (!assignment || startedRef.current) return;
    if (assignment.status !== "pending") return;
    startedRef.current = true;
    void startAssignment(assignment.assignment_id).catch(() => undefined);
  }, [assignment]);


  const selectedCategory = categories.find((item) => item.name === category);
  const subcategories = selectedCategory?.subcategories ?? [];
  const isOtherCategory = category === "Others";
  const showSubcategory =
    !lockedByAssignment && Boolean(category) && !isOtherCategory && subcategories.length > 0;
  const selectedSub = subcategories.find((item) => item.id === subCategory);
  const needsCustom = isOtherCategory || subCategory === "others";

  const assignmentSubLabel = assignment?.sub_category ?? "";
  const setupErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (lockedByAssignment) return errors;
    if (!storeId) errors.store = "Select the store for this scan.";
    if (!shelfLocation.trim()) errors.location = "Location is required.";
    if (!category) errors.category = "Select a category.";
    if (showSubcategory && !subCategory) errors.subcategory = "Select a subcategory.";
    if (category && needsCustom && !subCategoryCustom.trim()) {
      errors.custom = "Describe the shelf type.";
    }
    return errors;
  }, [
    lockedByAssignment,
    planogramRows,
    storeId,
    shelfLocation,
    category,
    showSubcategory,
    subCategory,
    needsCustom,
    subCategoryCustom,
  ]);
  const setupComplete = Object.keys(setupErrors).length === 0;

  const shelfLabel = shelfLocation.trim();

  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const itemsRef = useRef<Attachment[]>([]);
  itemsRef.current = items;

  useEffect(
    () => () => {
      abortRef.current?.abort();
      for (const item of itemsRef.current) URL.revokeObjectURL(item.url);
    },
    [],
  );

  const guardSetup = useCallback(() => {
    if (setupComplete) return true;
    setShowSetupErrors(true);
    setFileError(
      "Complete scan setup (store, location, category and subcategory) before adding images.",
    );
    return false;
  }, [setupComplete]);

  const openCamera = useCallback(() => {
    if (guardSetup()) cameraInput.current?.click();
  }, [guardSetup]);

  const openFiles = useCallback(() => {
    if (guardSetup()) fileInput.current?.click();
  }, [guardSetup]);

  const acceptFiles = useCallback((incoming: FileList | File[] | null | undefined) => {
    const files = Array.from(incoming ?? []);
    if (!files.length) return;

    setFileError(null);
    setErrorMessage(null);
    setPhase("idle");

    setItems((current) => {
      const next = [...current];
      for (const file of files) {
        if (next.length >= MAX_SCAN_IMAGES) {
          setFileError(`You can scan up to ${MAX_SCAN_IMAGES} images at a time.`);
          break;
        }
        const problem = validateScanFile(file);
        if (problem) {
          setFileError(problem);
          continue;
        }
        next.push({
          id: `${file.name}-${file.size}-${Date.now()}-${next.length}`,
          file,
          url: URL.createObjectURL(file),
        });
      }
      return next;
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((item) => item.id !== id);
    });
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setItems((current) => {
      for (const item of current) URL.revokeObjectURL(item.url);
      return [];
    });
    setFileError(null);
    setErrorMessage(null);
    setUploadProgress(0);
    setPhase("idle");
  }, []);

  const startScan = useCallback(async () => {
    if (!items.length || phase === "uploading") return;
    if (!guardSetup()) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setErrorMessage(null);
    setPhase("uploading");
    setUploadProgress(0);

    try {
      const response = await submitScanImages(
        items.map((item) => item.file),
        {
          signal: controller.signal,
          onUploadProgress: setUploadProgress,
          storeId,
          shelfLabel,
          category,
          subCategory: isOtherCategory ? "others" : subCategory || undefined,
          subCategoryLabel: lockedByAssignment
            ? assignmentSubLabel || undefined
            : isOtherCategory
              ? "Others"
              : selectedSub?.label,
          subCategoryCustom:
            needsCustom && !lockedByAssignment ? subCategoryCustom.trim() : undefined,
          ...(assignment
            ? { assignmentId: assignment.assignment_id, orgId: assignment.org_id }
            : planogramRows.length
              ? {
                  planogramItems: planogramRows.map(({ key: _key, ...row }) => ({
                    ...row,
                    aisle: row.location,
                  })),
                }
              : {}),
        },
      );

      navigate({
        to: "/processing",
        search: { scan: response.scan_id },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setPhase("idle");
        return;
      }
      const limit = toLimitDialogState(error);
      if (limit) {
        setLimitDialog(limit);
        setPhase("idle");
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "The scan could not be started.");
      setPhase("error");
    } finally {
      abortRef.current = null;
    }
  }, [
    items,
    navigate,
    phase,
    guardSetup,
    storeId,
    shelfLabel,
    category,
    isOtherCategory,
    subCategory,
    selectedSub,
    needsCustom,
    subCategoryCustom,
    lockedByAssignment,
    assignment,
    assignmentSubLabel,
  ]);

  const cancelUpload = useCallback(() => {
    abortRef.current?.abort();
    setPhase("idle");
  }, []);

  const busy = phase === "uploading";
  const fieldError = (key: string) => (showSetupErrors ? setupErrors[key] : undefined);

  return (
    <AppShell
      title="Scan"
      description="Set store, location, category and subcategory, then capture or upload shelf photos."
      actions={
        items.length && !busy ? (
          <Button variant="subtle" size="sm" className="rounded-xl" onClick={reset}>
            <Trash2 className="size-4" /> Clear
          </Button>
        ) : undefined
      }
    >
      <input
        ref={cameraInput}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          acceptFiles(e.target.files);
          e.currentTarget.value = "";
        }}
      />
      <input
        ref={fileInput}
        type="file"
        multiple
        accept="image/jpeg,image/jpg,image/png"
        className="sr-only"
        onChange={(e) => {
          acceptFiles(e.target.files);
          e.currentTarget.value = "";
        }}
      />

      {loadingAssignment ? (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading your assigned scan…
        </div>
      ) : (
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {assignment && (
            <section className="rounded-2xl border border-brand/30 bg-brand-soft/50 p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand">
                Assigned scan
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                Store · {assignment.store_name}
                {assignment.location ? ` — ${assignment.location}` : ""}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {[assignment.category, assignment.sub_category].filter(Boolean).join(" · ")} ·{" "}
                {assignment.expected_count} expected products · assigned by{" "}
                {assignment.assigner_name}
              </p>
              {assignment.instructions && (
                <p className="mt-2 rounded-xl bg-card px-3 py-2 text-xs text-muted-foreground">
                  {assignment.instructions}
                </p>
              )}
            </section>
          )}

          {/* STEP 1 — setup */}
          <section className="card-surface p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                <MapPin className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold tracking-tight">Step 1 · Scan setup</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Required before you can add shelf images.
                </p>
              </div>
              {setupComplete && (
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-accent-green-soft px-2.5 py-1 text-xs font-medium text-accent-green">
                  <Check className="size-3.5" /> Ready
                </span>
              )}
            </div>

            {assignment && (
              <p className="mt-4 rounded-xl bg-surface px-3 py-2 text-xs text-muted-foreground">
                Set by your manager for this assignment.
              </p>
            )}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="scan-store">Store *</Label>
                {assignment ? (
                  <Input
                    id="scan-store"
                    className="rounded-xl"
                    value={assignment.store_name}
                    readOnly
                    disabled
                  />
                ) : (
                  <Select value={storeId} onValueChange={setStoreId} disabled={busy}>
                    <SelectTrigger id="scan-store" className="rounded-xl">
                      <SelectValue
                        placeholder={
                          storesQuery.isLoading
                            ? "Loading stores…"
                            : stores.length
                              ? "Select a store"
                              : "No stores yet — add one in Stores"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name}
                          {store.city ? ` — ${store.city}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {fieldError("store") && (
                  <p className="text-xs text-destructive">{fieldError("store")}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="scan-location">Location *</Label>
                <Input
                  id="scan-location"
                  className="rounded-xl"
                  placeholder="e.g. Aisle 4 · Beverages · left bay"
                  value={shelfLocation}
                  disabled={busy || lockedByAssignment}
                  readOnly={lockedByAssignment}
                  onChange={(e) => setShelfLocation(e.target.value)}
                />
                {fieldError("location") && (
                  <p className="text-xs text-destructive">{fieldError("location")}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="scan-category">Category *</Label>
                {assignment ? (
                  <Input
                    id="scan-category"
                    className="rounded-xl"
                    value={assignment.category || "—"}
                    readOnly
                    disabled
                  />
                ) : (
                  <Select
                    value={category}
                    onValueChange={(value) => {
                      setCategory(value);
                      setSubCategory("");
                      setSubCategoryCustom("");
                    }}
                    disabled={busy}
                  >
                    <SelectTrigger id="scan-category" className="rounded-xl">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[320px]">
                      {categories.map((item) => (
                        <SelectItem key={item.name} value={item.name} className="py-2">
                          <span className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium">{item.name}</span>
                            {item.examples ? (
                              <span className="text-xs text-muted-foreground">{item.examples}</span>
                            ) : null}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {fieldError("category") && (
                  <p className="text-xs text-destructive">{fieldError("category")}</p>
                )}
              </div>

              {assignment && assignment.sub_category && (
                <div className="space-y-1.5">
                  <Label htmlFor="scan-subcategory-locked">Sub-category</Label>
                  <Input
                    id="scan-subcategory-locked"
                    className="rounded-xl"
                    value={assignment.sub_category}
                    readOnly
                    disabled
                  />
                </div>
              )}

              {showSubcategory && (
                <div className="space-y-1.5">
                  <Label htmlFor="scan-subcategory">Subcategory *</Label>
                  <Select
                    value={subCategory}
                    onValueChange={(value) => {
                      setSubCategory(value);
                      if (value !== "others") setSubCategoryCustom("");
                    }}
                    disabled={busy || lockedByAssignment}
                  >
                    <SelectTrigger id="scan-subcategory" className="rounded-xl">
                      <SelectValue placeholder="Select a subcategory" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[320px]">
                      {subcategories.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Narrows detection to this shelf type (e.g. hides shampoo on a soap shelf).
                  </p>
                  {fieldError("subcategory") && (
                    <p className="text-xs text-destructive">{fieldError("subcategory")}</p>
                  )}
                </div>
              )}


              {category && needsCustom && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="scan-subcategory-custom">Describe shelf type *</Label>
                  <Input
                    id="scan-subcategory-custom"
                    className="rounded-xl"
                    placeholder="e.g. Imported chocolates end-cap"
                    value={subCategoryCustom}
                    disabled={busy || lockedByAssignment}
                    onChange={(e) => setSubCategoryCustom(e.target.value)}
                  />
                  {fieldError("custom") && (
                    <p className="text-xs text-destructive">{fieldError("custom")}</p>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* OPTIONAL — expected shelf planogram */}
          {!lockedByAssignment && (
            <section className="card-surface p-4 sm:p-6">
              <button
                type="button"
                className="flex w-full items-start gap-3 text-left"
                aria-expanded={planogramOpen}
                onClick={() => setPlanogramOpen((open) => !open)}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                  <ClipboardList className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold tracking-tight">
                      Expected shelf planogram (optional)
                    </span>
                    {planogramRows.length > 0 && (
                      <Badge variant="secondary" className="rounded-lg">
                        {planogramRows.length} expected product
                        {planogramRows.length === 1 ? "" : "s"}
                      </Badge>
                    )}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Add what should be on this shelf to get an Expected vs Actual compliance report.
                    You can start the scan without it.
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
                    planogramOpen && "rotate-180",
                  )}
                />
              </button>

              {planogramOpen && (
                <div className="mt-5 space-y-4">
                  {storeId && (
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        variant="subtle"
                        size="sm"
                        className="rounded-xl"
                        disabled={planogramLoading}
                        onClick={async () => {
                          setPlanogramLoading(true);
                          setPlanogramNotice(null);
                          try {
                            const active = await fetchActivePlanogram(storeId);
                            if (!active) {
                              setPlanogramNotice(
                                "This store has no active planogram yet. Add expected products below or create one from the Planogram page.",
                              );
                              return;
                            }
                            const rows = await fetchPlanogramItems(active.id);
                            setPlanogramRows(rows);
                            setPlanogramNotice(
                              `Loaded ${rows.length} product${rows.length === 1 ? "" : "s"} from the active store planogram.`,
                            );
                          } catch (error) {
                            setPlanogramNotice(toUserMessage(error));
                          } finally {
                            setPlanogramLoading(false);
                          }
                        }}
                      >
                        {planogramLoading && <Loader2 className="size-4 animate-spin" />}
                        Use active store planogram instead
                      </Button>
                      {planogramNotice && (
                        <p className="text-xs text-muted-foreground">{planogramNotice}</p>
                      )}
                    </div>
                  )}
                  <PlanogramBuilder
                    rows={planogramRows}
                    onRowsChange={setPlanogramRows}
                    categories={categories}
                    tableTitle="Expected products for this scan"
                  />
                </div>
              )}
            </section>
          )}

          {/* STEP 2 — images */}
          <section className={cn("card-surface p-4 sm:p-6", !setupComplete && "opacity-70")}>
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                <ImageIcon className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold tracking-tight">Step 2 · Shelf images</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Capture with the camera or upload up to {MAX_SCAN_IMAGES} photos.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={openCamera}
                disabled={busy}
                className="group flex flex-col items-start gap-3 rounded-2xl border border-border bg-surface p-5 text-left transition-all hover:border-brand/45 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-gradient-brand text-brand-foreground transition-transform group-hover:scale-105">
                  <Camera className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">Take photo</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Opens the rear camera on mobile devices
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={openFiles}
                disabled={busy}
                className="group flex flex-col items-start gap-3 rounded-2xl border border-border bg-surface p-5 text-left transition-all hover:border-brand/45 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand transition-transform group-hover:scale-105">
                  <UploadCloud className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">Upload images</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Select up to {MAX_SCAN_IMAGES} shelf photos
                  </span>
                </span>
              </button>
            </div>

            {items.length === 0 && (
              <div
                role="button"
                tabIndex={0}
                onClick={openFiles}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") openFiles();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  if (guardSetup()) acceptFiles(e.dataTransfer.files);
                }}
                className={cn(
                  "mt-3 hidden cursor-pointer place-items-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors sm:grid",
                  dragging
                    ? "border-brand bg-brand-soft/60"
                    : "border-border bg-surface hover:border-brand/50 hover:bg-brand-soft/35",
                )}
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
                  <ImageIcon className="size-5" />
                </span>
                <p className="mt-4 text-sm font-medium">Drag and drop shelf images here</p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  JPG, JPEG or PNG · up to 10 MB each · up to {MAX_SCAN_IMAGES} per scan
                </p>
              </div>
            )}

            {fileError && (
              <div
                role="alert"
                className="mt-3 flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{fileError}</p>
              </div>
            )}
          </section>

          {items.length > 0 && (
            <div className="card-surface overflow-hidden">
              <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
                {items.map((item, index) => (
                  <figure
                    key={item.id}
                    className="relative overflow-hidden rounded-2xl border border-border bg-muted"
                  >
                    <img
                      src={item.url}
                      alt={`Preview of shelf image ${index + 1}: ${item.file.name}`}
                      className="h-44 w-full animate-fade-in object-cover"
                    />
                    {!busy && (
                      <Button
                        variant="subtle"
                        size="icon"
                        className="absolute right-2 top-2 rounded-xl"
                        onClick={() => removeItem(item.id)}
                      >
                        <X className="size-4" />
                        <span className="sr-only">Remove {item.file.name}</span>
                      </Button>
                    )}
                    <figcaption className="flex items-center gap-2 border-t border-border bg-surface px-3 py-2">
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-green-soft text-accent-green">
                        <Check className="size-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium">{item.file.name}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {formatBytes(item.file.size)}
                        </span>
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>

              <div className="flex flex-col gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-sm text-muted-foreground">
                  {items.length} of {MAX_SCAN_IMAGES} images ready to scan
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="subtle"
                    size="sm"
                    className="rounded-xl"
                    disabled={busy || items.length >= MAX_SCAN_IMAGES}
                    onClick={openFiles}
                  >
                    <Plus className="size-4" /> Add image
                  </Button>
                  <Button
                    variant="brand"
                    size="sm"
                    className="rounded-xl"
                    onClick={startScan}
                    disabled={busy}
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ScanLine className="size-4" />
                    )}
                    {busy ? "Uploading…" : "Start scan"}
                    {!busy && planogramRows.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="ml-1 rounded-lg text-[11px] font-medium"
                      >
                        {planogramRows.length} expected
                      </Badge>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {phase === "error" && (
            <div
              role="alert"
              className="card-surface flex flex-col gap-4 border-destructive/25 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
                  <AlertTriangle className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Scan could not be started</p>
                  <p className="mt-1 text-sm text-muted-foreground">{errorMessage}</p>
                </div>
              </div>
              <Button variant="brand" size="sm" className="rounded-xl" onClick={startScan}>
                <ScanLine className="size-4" /> Retry
              </Button>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card-surface p-5 sm:p-6">
            <h2 className="text-sm font-semibold tracking-tight">How it works</h2>
            <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li>1. Set store, location, category and subcategory.</li>
              <li>2. Capture or upload your shelf photos.</li>
              <li>3. AI detects products, brands and stock gaps.</li>
              <li>4. View results, CSV, and PDF report.</li>
            </ol>
          </div>

          <div className="card-surface p-5 sm:p-6">
            <h2 className="text-sm font-semibold tracking-tight">Capture tips</h2>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li>Frame the full shelf height in one shot.</li>
              <li>Stand 1.5–2 m back and hold the phone level.</li>
              <li>Avoid glare, shadows and motion blur.</li>
            </ul>
          </div>
        </aside>
      </div>
      )}


      {busy && (
        <div
          role="dialog"
          aria-modal="true"
          aria-busy="true"
          aria-label="Upload in progress"
          className="fixed inset-0 z-50 animate-fade-in overflow-y-auto bg-background/98 backdrop-blur-sm"
        >
          <div className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-center px-5 py-10 text-center">
            <div className="relative mx-auto grid size-24 place-items-center">
              <span className="absolute inset-0 animate-pulse rounded-full bg-brand-soft" />
              <span className="relative grid size-20 place-items-center rounded-full bg-gradient-brand">
                <Loader2 className="size-7 animate-spin text-brand-foreground" />
              </span>
            </div>
            <h2 className="mt-6 text-lg font-semibold tracking-tight sm:text-xl">
              Uploading shelf image
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{uploadProgress}% uploaded</p>
            <div className="mt-9 flex justify-center">
              <Button variant="subtle" size="sm" className="rounded-xl" onClick={cancelUpload}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
      <LimitReachedDialog limit={limitDialog} onClose={() => setLimitDialog(null)} />
    </AppShell>
  );
}
