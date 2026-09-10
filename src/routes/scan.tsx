import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Camera,
  Check,
  ImageIcon,
  Loader2,
  Info,
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
import { ClipboardList } from "lucide-react";
import { fetchActivePlanogram, fetchPlanogramItems, type DraftRow } from "@/lib/planogram";
import { toUserMessage } from "@/lib/api/errors";
import { CategorySubcategoryPicker } from "@/components/scan/CategorySubcategoryPicker";
import { ScanContextPanel } from "@/components/scan/ScanContextPanel";
import {
  loadStoredScanContext,
  saveStoredScanContext,
  type ScanContextState,
} from "@/lib/scan-context";
import { trackEvent } from "@/lib/analytics";
import { networkErrorMessage } from "@/lib/api-errors";
import {
  dedupeSelections,
  formatCategorySelections,
  selectionKey,
  selectionsFromLegacy,
  selectionsFromPlanogramRows,
  type CategorySelection,
} from "@/lib/category-selections";



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
          "Set store, location and shelf types, then capture or upload shelf photos for an AI audit.",
      },
      { property: "og:title", content: "Scan a shelf — Aislix" },
      {
        property: "og:description",
        content:
          "Set store, location and shelf types, then capture or upload shelf photos.",
      },

      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScanPage,
});

const CATEGORY_QUERY_KEY = ["shelf-categories"] as const;

type Phase = "idle" | "uploading" | "error";

/** Option 1 = free scan, Option 2 = compliance scan against expected products. */
type ScanMode = "free" | "with_planogram";

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
  const [scanMode, setScanMode] = useState<ScanMode>("free");
  const [planogramRows, setPlanogramRows] = useState<DraftRow[]>([]);
  const [planogramLoading, setPlanogramLoading] = useState(false);
  const [planogramNotice, setPlanogramNotice] = useState<string | null>(null);
  const [shelfLocation, setShelfLocation] = useState("");
  const [selections, setSelections] = useState<CategorySelection[]>([]);
  const [notes, setNotes] = useState("");
  const [showSetupErrors, setShowSetupErrors] = useState(false);
  const [categorySyncNotice, setCategorySyncNotice] = useState<string | null>(null);
  const [scanContext, setScanContext] = useState<ScanContextState>(() => loadStoredScanContext());

  const withPlanogram = scanMode === "with_planogram";



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
    setSelections(
      assignment.category_selections?.length
        ? assignment.category_selections
        : selectionsFromLegacy(categories, assignment.category, assignment.sub_category),
    );
  }, [assignment, categories]);


  // The member has effectively started the task as soon as the form is open.
  const startedRef = useRef(false);
  useEffect(() => {
    if (!assignment || startedRef.current) return;
    if (assignment.status !== "pending") return;
    startedRef.current = true;
    void startAssignment(assignment.assignment_id).catch(() => undefined);
  }, [assignment]);

  /* -------- shelf types (multi category · subcategory) -------- */
  const primary = selections[0] ?? null;
  const category = primary?.category_name ?? "";
  const subCategory = primary?.sub_category_id ?? "";
  const subCategoryCustom = primary?.sub_category_custom ?? "";
  const selectedSub = primary
    ? { label: primary.sub_category_custom || primary.sub_category_label }
    : undefined;

  /* -------- planogram → shelf types merge -------- */
  const planogramSelections = useMemo(
    () => (planogramRows.length ? selectionsFromPlanogramRows(categories, planogramRows) : []),
    [planogramRows, categories],
  );

  // Shelf types the user explicitly removed — never auto-added back on re-parse.
  const [dismissedSelectionKeys, setDismissedSelectionKeys] = useState<string[]>([]);

  const handleSelectionsChange = useCallback(
    (next: CategorySelection[]) => {
      const nextKeys = new Set(next.map(selectionKey));
      const removed = selections.map(selectionKey).filter((key) => !nextKeys.has(key));
      if (removed.length) {
        setDismissedSelectionKeys((current) => [...new Set([...current, ...removed])]);
      }
      setSelections(next);
    },
    [selections],
  );

  const missingPlanogramSelections = useMemo(() => {
    if (lockedByAssignment) return [];
    const known = new Set(selections.map(selectionKey));
    const dismissed = new Set(dismissedSelectionKeys);
    return planogramSelections.filter(
      (item) => !known.has(selectionKey(item)) && !dismissed.has(selectionKey(item)),
    );
  }, [planogramSelections, selections, lockedByAssignment, dismissedSelectionKeys]);

  const mergePlanogramSelections = useCallback(() => {
    if (!missingPlanogramSelections.length) return;
    const added = missingPlanogramSelections;
    setSelections((current) => dedupeSelections([...current, ...added]));
    setCategorySyncNotice(
      `Added shelf types from your planogram: ${formatCategorySelections(added, 3)}`,
    );
  }, [missingPlanogramSelections]);

  // Clearing the planogram clears the sync notice.
  useEffect(() => {
    if (planogramRows.length) return;
    setCategorySyncNotice(null);
  }, [planogramRows.length]);


  /** Most frequent non-empty location across planogram rows. */
  const dominantRowLocation = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of planogramRows) {
      const value = row.location?.trim();
      if (!value) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const [value, count] of counts) {
      if (count > bestCount) {
        best = value;
        bestCount = count;
      }
    }
    return best;
  }, [planogramRows]);

  // Planogram rows may carry the shelf code the user has not typed yet.
  useEffect(() => {
    if (lockedByAssignment || shelfLocation.trim() || !dominantRowLocation) return;
    setShelfLocation(dominantRowLocation);
  }, [dominantRowLocation, shelfLocation, lockedByAssignment]);

  // Keep every planogram row on the shelf location the user selected.
  useEffect(() => {
    const location = shelfLocation.trim();
    if (!withPlanogram || !location || !planogramRows.length) return;
    if (planogramRows.every((row) => row.location.trim() === location)) return;
    setPlanogramRows((rows) => rows.map((row) => ({ ...row, location })));
  }, [shelfLocation, withPlanogram, planogramRows]);

  // Switching mode starts a clean planogram but keeps the store selection.
  useEffect(() => {
    if (withPlanogram) return;
    setPlanogramRows([]);
    setPlanogramNotice(null);
  }, [withPlanogram]);

  const assignmentSubLabel = assignment?.sub_category ?? "";
  const effectiveLocation = shelfLocation.trim() || dominantRowLocation || "";
  const validPlanogramRows = useMemo(
    () => planogramRows.filter((row) => row.brand.trim() && row.product_name.trim()),
    [planogramRows],
  );

  const setupErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (lockedByAssignment) return errors;
    if (!storeId) errors.store = "Select the store for this scan.";
    if (!effectiveLocation) errors.location = "Location is required.";
    if (!selections.length) {
      errors.selections = "Add at least one shelf type (category · subcategory).";
    }
    if (selections.some((item) => item.sub_category_id === "others" && !item.sub_category_custom)) {
      errors.selections = "Describe every shelf type you marked as Others.";
    }
    if (withPlanogram && !validPlanogramRows.length) {
      errors.planogram = "Add at least one expected product.";
    }
    return errors;
  }, [
    lockedByAssignment,
    storeId,
    effectiveLocation,
    selections,
    withPlanogram,
    validPlanogramRows,
  ]);

  const setupComplete = Object.keys(setupErrors).length === 0;

  const shelfLabel = effectiveLocation;

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
      withPlanogram
        ? "Select store, location, shelf types, and add at least one expected product."
        : "Select store, location and shelf types to continue.",
    );
    return false;
  }, [setupComplete, withPlanogram]);


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
    trackEvent("scan_started", { images: items.length, with_planogram: withPlanogram });

    try {
      const response = await submitScanImages(
        items.map((item) => item.file),
        {
          signal: controller.signal,
          onUploadProgress: setUploadProgress,
          storeId,
          shelfLabel,
          category,
          subCategory: subCategory || undefined,
          subCategoryLabel: lockedByAssignment
            ? assignmentSubLabel || undefined
            : primary?.sub_category_label || undefined,
          subCategoryCustom: primary?.sub_category_custom?.trim() || undefined,
          categorySelections: selections,

          notes: !lockedByAssignment && !withPlanogram ? notes.trim() || undefined : undefined,
          ...(assignment
            ? { assignmentId: assignment.assignment_id, orgId: assignment.org_id }
            : withPlanogram && validPlanogramRows.length
              ? {
                  planogramItems: validPlanogramRows.map(({ key: _key, ...row }) => ({
                    ...row,
                    location: shelfLabel || row.location,
                    aisle: shelfLabel || row.location,
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
      setErrorMessage(networkErrorMessage(error));
      setPhase("error");
    } finally {
      abortRef.current = null;
    }
  }, [
    items,
    validPlanogramRows,
    withPlanogram,
    notes,
    navigate,
    phase,
    guardSetup,
    storeId,
    shelfLabel,
    category,
    subCategory,
    primary,
    selections,

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
      description="Set store, location and shelf types, then capture or upload shelf photos."
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

            {/* STORE — always first, applies to the scan and every planogram row */}
            <section className="card-surface p-4 sm:p-6">
              <div className="space-y-1.5">
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
                <p className="text-xs text-muted-foreground">
                  Applies to this scan and all planogram rows.
                </p>
                {fieldError("store") && (
                  <p className="text-xs text-destructive">{fieldError("store")}</p>
                )}
              </div>
            </section>

            {/* SCAN MODE */}
            {!lockedByAssignment && (
              <section className="card-surface p-4 sm:p-6">
                <h2 className="text-sm font-semibold tracking-tight">
                  How are you scanning this shelf?
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      {
                        value: "free" as ScanMode,
                        title: "Without planogram",
                        description: "Detect products only, no compliance %",
                      },
                      {
                        value: "with_planogram" as ScanMode,
                        title: "With planogram",
                        description: "Compare shelf to expected products",
                      },
                    ] as const
                  ).map((option) => {
                    const active = scanMode === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={busy}
                        onClick={() => setScanMode(option.value)}
                        className={cn(
                          "flex items-start gap-3 rounded-2xl border p-4 text-left transition-all",
                          active
                            ? "border-brand bg-brand-soft/50 shadow-card"
                            : "border-border bg-surface hover:border-brand/40",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                            active ? "border-brand" : "border-muted-foreground/50",
                          )}
                        >
                          {active && <span className="size-2 rounded-full bg-brand" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{option.title}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            <ScanContextPanel
              value={scanContext}
              onChange={(next) => {
                setScanContext(next);
                saveStoredScanContext(next);
              }}
              defaultLocation={shelfLocation}
              className="card-surface"
            />

            {/* STEP 1 — scan context (shared by both modes) */}
            <section className="card-surface p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                  <MapPin className="size-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold tracking-tight">
                    Step 1 · {withPlanogram ? "Shelf context" : "Shelf setup"}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {withPlanogram
                      ? "Applies to this scan and every expected product below."
                      : "Required before you can add shelf images."}
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
                <div className="space-y-1.5">
                  <Label htmlFor="scan-location">Location *</Label>
                  <Input
                    id="scan-location"
                    className="rounded-xl"
                    placeholder="Shelf / aisle code, e.g. A-1-S"
                    value={shelfLocation}
                    disabled={busy || lockedByAssignment}
                    readOnly={lockedByAssignment}
                    onChange={(e) => setShelfLocation(e.target.value)}
                  />
                  {fieldError("location") && (
                    <p className="text-xs text-destructive">{fieldError("location")}</p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <CategorySubcategoryPicker
                    value={selections}
                    onChange={handleSelectionsChange}
                    categories={categories}
                    disabled={busy}
                    readOnly={lockedByAssignment}
                    {...(fieldError("selections")
                      ? { error: fieldError("selections") as string }
                      : {})}
                    {...(lockedByAssignment
                      ? {
                          label: "Shelf types assigned",
                          helper: "Your manager set the shelf types for this task.",
                        }
                      : {})}
                  />
                </div>


                {!withPlanogram && !lockedByAssignment && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="scan-notes">Notes</Label>
                    <Input
                      id="scan-notes"
                      className="rounded-xl"
                      placeholder="Optional context for this scan"
                      value={notes}
                      disabled={busy}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </section>

            {categorySyncNotice && (
              <div
                role="status"
                className="flex flex-wrap items-start gap-2.5 rounded-2xl border border-brand/25 bg-brand-soft/60 px-4 py-3"
              >
                <Info className="mt-0.5 size-4 shrink-0 text-brand" />
                <p className="flex-1 text-sm text-foreground">{categorySyncNotice}</p>
                <button
                  type="button"
                  className="text-sm font-medium text-brand underline-offset-2 hover:underline"
                  onClick={() => setCategorySyncNotice(null)}
                >
                  Dismiss
                </button>
              </div>
            )}

            {!lockedByAssignment && missingPlanogramSelections.length > 0 && (
              <div
                role="alert"
                className="rounded-2xl border border-warning/40 bg-warning/10 px-4 py-4"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      Planogram rows outside your shelf types
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Your planogram includes{" "}
                      {formatCategorySelections(missingPlanogramSelections, 3)}. Add them so the AI
                      audits those products too.
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="brand"
                    size="sm"
                    className="rounded-xl"
                    onClick={mergePlanogramSelections}
                  >
                    Sync shelf types from planogram
                  </Button>
                  <Button
                    variant="subtle"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => {
                      setPlanogramRows([]);
                      setPlanogramNotice(null);
                    }}
                  >
                    Clear planogram
                  </Button>
                </div>
              </div>
            )}


            {/* OPTION 2 — expected shelf planogram */}
            {withPlanogram && !lockedByAssignment && (
              <section className="card-surface p-4 sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                    <ClipboardList className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold tracking-tight">Expected products</h2>
                      {planogramRows.length > 0 && (
                        <Badge variant="secondary" className="rounded-lg">
                          {planogramRows.length} expected product
                          {planogramRows.length === 1 ? "" : "s"}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Upload a CSV or add products — location and shelf type come from the shelf
                      context above.
                    </p>
                  </div>
                </div>

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
                            const all = await fetchPlanogramItems(active.id);
                            const filter = shelfLocation.trim().toLowerCase();
                            const rows = filter
                              ? (all.filter(
                                  (row) => row.location.trim().toLowerCase() === filter,
                                ).length
                                  ? all.filter(
                                      (row) => row.location.trim().toLowerCase() === filter,
                                    )
                                  : all)
                              : all;
                            setCategorySyncNotice(null);

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
                    context={{
                      location: shelfLocation.trim(),
                      category,
                      subCategoryLabel: selectedSub?.label ?? "",
                    }}
                  />
                </div>
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

              {!setupComplete && (
                <p className="mt-4 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
                  {withPlanogram
                    ? "Select store, location, shelf types, and add at least one expected product."
                    : "Select store, location and shelf types to continue."}
                </p>
              )}



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
                          <span className="block truncate text-xs font-medium">
                            {item.file.name}
                          </span>
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
                      disabled={busy || !setupComplete}
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ScanLine className="size-4" />
                      )}
                      {busy ? "Uploading…" : "Start scan"}
                      {!busy && (
                        <Badge
                          variant="secondary"
                          className="ml-1 rounded-lg text-[11px] font-medium"
                        >
                          {withPlanogram
                            ? `Compliance scan · ${planogramRows.length} expected product${planogramRows.length === 1 ? "" : "s"}`
                            : "Free scan"}
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
                <li>1. Set store, location and shelf types.</li>
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
