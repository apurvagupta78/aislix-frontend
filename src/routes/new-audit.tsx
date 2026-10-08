import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { fetchStores } from "@/lib/account";
import {
  createScanAssignment,
  fetchAssignableMembers,
  fetchMemberStoreCoverage,
} from "@/lib/assignments";
import { fetchAuditTemplate, fetchAuditTemplates, templateToDefinition } from "@/lib/audit-templates";
import { hydrateFromSavedTemplate } from "@/lib/audit-builder/load-saved-template-audit";
import {
  EVIDENCE_PROOF_OPTIONS,
  mergeTemplateMinimum,
  policyForLevel,
  policyNeedsBarcodeColumn,
  policyNeedsShelfColumn,
  policyUsesShelfColumn,
  rowEvidenceFromPolicy,
  type AuditEvidencePolicy,
  type EvidenceLevel,
  type EvidenceProof,
} from "@/lib/audit-evidence-policy";
import { createAssignmentPlanogramVersion, toDraftRow } from "@/lib/planogram";
import { toUserMessage } from "@/lib/api/errors";
import { requireUserId } from "@/lib/db/context";
import { startAssignment } from "@/lib/assignments";
import { createAssignment as createExpiryAssignment } from "@/lib/expiry-control";
import {
  createManualAuditDataset,
  datasetToDraftRows,
  validateAuditDataset,
  type AuditInputDataset,
} from "@/lib/audit-input-dataset";
import { DigitalAuditUploadPanel } from "@/components/new-audit/DigitalAuditUploadPanel";
import { createDigitalCsvAuditTemplate } from "@/lib/audit-builder/save-custom-template";
import { buildDigitalInputSchema, syncDigitalMappings } from "@/lib/new-audit/digital-columns";
import { AdvancedSettingsPanel } from "@/components/new-audit/AdvancedSettingsPanel";
import { suggestBarcodeColumn, suggestShelfColumn } from "@/lib/audit-engine/grid-evidence";
import type { AuditPurpose, OperatingModel } from "@/lib/audit-builder/types";
import type { InputSchema } from "@/lib/audit-builder/field-roles";
import {
  defaultDataInputMode,
  validateDataDefinition,
  type AuditDataInputMode,
} from "@/lib/audit-builder/audit-data-modes";
import {
  buildInputSchema,
  buildTemplateFromInputSchema,
  mergeInputSchemaIntoSnapshot,
} from "@/lib/audit-builder/input-schema";
import { buildMergedTemplateSnapshot } from "@/lib/audit-builder/template-csv-merge";
import { definitionToPatch } from "@/lib/audit-templates";
import { fetchHierarchyProfiles } from "@/lib/hierarchy";
import { buildHierarchyDistribution, resolveHierarchyOutlets } from "@/lib/hierarchy/routing";
import {
  getPurposesForModel,
  OPERATING_MODEL_CARDS,
} from "@/lib/audit-engine/operating-model-catalog";
import {
  aiAuditCategorySelections,
  submitAuthenticatedAiAuditScan,
} from "@/lib/ai-audit/run-ai-audit-scan";
import {
  aiAnalysisReady,
  aiAnalysisSummary,
  buildAiAnalysisRequest,
  type AiAnalysisCheck,
} from "@/lib/ai-audit/ai-analysis";
import { buildAiPlanogramPreviewSummary } from "@/lib/new-audit/ai-vision-context";
import {
  referencePayloadFromContext,
  referenceScope,
  withReferencePlanogramRows,
} from "@/lib/new-audit/reference-context";
import {
  demoPlanogramDraftRows,
  isPlanogramRelatedTemplate,
  type NewAuditPlanogramChoice,
} from "@/lib/new-audit/planogram-setup";
import { DEMO_ORAL_CARE_META } from "@/lib/demo-oral-care-planogram";
import { EMPTY_SCAN_CONTEXT, type ScanContextState } from "@/lib/scan-context";
import { EMPTY_PLANOGRAM_META } from "@/lib/planogram-meta";
import { TemplateChecklistPreview } from "@/components/new-audit/TemplateChecklistPreview";
import { buildTemplateDataset, isTemplateColumn, templateHasLines } from "@/lib/new-audit/template-dataset";
import { recordRecentTemplate } from "@/lib/new-audit/recent-templates";
import { NewAuditStepNav } from "@/components/new-audit/NewAuditStepNav";
import { NewAuditStep1Details } from "@/components/new-audit/steps/NewAuditStep1Details";
import { NewAuditStep2StartMethod } from "@/components/new-audit/steps/NewAuditStep2StartMethod";
import { NewAuditStep3AuditMode } from "@/components/new-audit/steps/NewAuditStep3AuditMode";
import { NewAuditStep4Assignment } from "@/components/new-audit/steps/NewAuditStep4Assignment";
import { NewAuditStep4Stores } from "@/components/new-audit/steps/NewAuditStep4Stores";
import { storeSelection } from "@/lib/new-audit/store-selection";
import { NewAuditStep5Scheduling } from "@/components/new-audit/steps/NewAuditStep5Scheduling";
import {
  NewAuditStep7Preview,
  formatScheduleSummary,
} from "@/components/new-audit/steps/NewAuditStep7Preview";
import { NewAuditStep7Capture } from "@/components/new-audit/steps/NewAuditStep7Capture";
import type { SweepCaptureMeta } from "@/lib/guided-capture";
import {
  aiStep3Error,
  scrollToNewAuditStep,
  displayStepStatus,
  validateNewAuditSteps,
} from "@/lib/new-audit/step-validation";
import {
  mapCaptureMethodToAuditMode,
  type CaptureMethod,
  type StartChoice,
} from "@/lib/new-audit/summary";
import { ensureSystemTemplate } from "@/lib/audit-engine/seed-templates";
import { getRecommendedTemplates, getSystemTemplateSpec } from "@/lib/audit-engine/template-factory";
import {
  buildAssignmentPreview,
  detectAssignmentConflicts,
  distributeAssignments,
  hasBlockingConflicts,
  publishAssignmentPlan,
  DueDateResolutionError,
  resolveAssignmentDueAt,
  resolveSelectedAssignees,
  saveAssignmentDraft,
  storeAssigneeMapping,
  type AssignmentMode,
  type AssignmentPlan,
  type DistributionStrategy,
  type DueConfig,
  type LocationScope,
  type RecurrenceRule,
  type TeamScope,
} from "@/lib/assignment-engine";
import { fetchOrgAssignments } from "@/lib/assignments";

/** No preset category: document audits take it from the document, shelf audits from the picker. */
const NEW_AUDIT_SCAN_CONTEXT: ScanContextState = {
  ...EMPTY_SCAN_CONTEXT,
  planogramMeta: { ...EMPTY_PLANOGRAM_META, category: "" },
};

export const Route = createFileRoute("/new-audit")({
  head: () => ({ meta: [{ title: "New audit — Aislix" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    templateId: typeof search.templateId === "string" ? search.templateId : undefined,
    systemKey: typeof search.systemKey === "string" ? search.systemKey : undefined,
    assign:
      search.assign === true ||
      search.assign === "true" ||
      search.assign === "1" ||
      search.assign === 1,
  }),
  component: NewAuditPage,
});

type TemplateChoice = "general" | "fnv" | "expiry" | "planogram" | string;

function NewAuditPage() {
  const navigate = useNavigate();
  const {
    templateId: initialTemplateId,
    systemKey: initialSystemKey,
    assign: initialAssign,
  } = Route.useSearch();
  const [auditName, setAuditName] = useState("");
  const [auditDescription, setAuditDescription] = useState("");
  const [startChoice, setStartChoice] = useState<StartChoice>(() =>
    initialTemplateId || initialSystemKey ? "template" : null,
  );
  const [operatingModel, setOperatingModel] = useState<OperatingModel>(() => {
    if (initialSystemKey) {
      return getSystemTemplateSpec(initialSystemKey)?.operatingModel ?? "local_store";
    }
    return "local_store";
  });
  const [auditPurpose, setAuditPurpose] = useState<AuditPurpose>(() => {
    if (initialSystemKey) {
      return getSystemTemplateSpec(initialSystemKey)?.purpose ?? "inventory";
    }
    return "inventory";
  });
  const [method, setMethod] = useState<CaptureMethod>("digital");
  const [methodTouched, setMethodTouched] = useState(false);
  const [templateChoice, setTemplateChoice] = useState<TemplateChoice>(() => {
    if (initialSystemKey) return `system:${initialSystemKey}`;
    if (initialTemplateId) return initialTemplateId;
    return "general";
  });
  const [location, setLocation] = useState("Main shelf");
  const [category, setCategory] = useState("");
  const [sku, setSku] = useState("");
  const [dataset, setDataset] = useState<AuditInputDataset>(createManualAuditDataset);
  const [inputSchema, setInputSchema] = useState<InputSchema>(() =>
    buildInputSchema(createManualAuditDataset()),
  );
  const [dataInputMode, setDataInputMode] = useState<AuditDataInputMode>("upload_csv");
  const [csvSaved, setCsvSaved] = useState(true);
  const [shelfColumnId, setShelfColumnId] = useState<string | null>(null);
  const [barcodeColumnId, setBarcodeColumnId] = useState<string | null>(null);
  const [evidenceLevel, setEvidenceLevel] = useState<EvidenceLevel>("standard");
  const [evidencePolicy, setEvidencePolicy] = useState<AuditEvidencePolicy>(
    policyForLevel("standard"),
  );
  const [requireRca, setRequireRca] = useState(true);
  const [assigneeId, setAssigneeId] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [instructions, setInstructions] = useState("");
  const [assignToSelf, setAssignToSelf] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("assign_now");
  const [scheduleTouched, setScheduleTouched] = useState(false);
  const [locationScope, setLocationScope] = useState<LocationScope>({ storeIds: [], stores: [] });
  const storeId = locationScope.storeIds[0] ?? "";
  const [teamScope, setTeamScope] = useState<TeamScope>({ assigneeIds: [] });
  /** Per-store person picked in Who; stores without a pick follow the equal split. */
  const [storeAssigneeOverrides, setStoreAssigneeOverrides] = useState<Record<string, string>>({});
  const [campaignName, setCampaignName] = useState("");
  const [publishAt, setPublishAt] = useState("");
  const [dueConfig, setDueConfig] = useState<DueConfig>({});
  const [recurrence, setRecurrence] = useState<RecurrenceRule>({
    frequency: "weekly",
    interval: 1,
    daysOfWeek: [1],
    startDate: new Date().toISOString().slice(0, 10),
    startTime: "09:00",
    timezone: "Asia/Kolkata",
  });
  const [templateHydrated, setTemplateHydrated] = useState(false);
  /** Template the lines table was last built from, so edits survive re-renders. */
  const templateDatasetFor = useRef<string | null>(null);
  const [aiPlanogramChoice, setAiPlanogramChoice] = useState<NewAuditPlanogramChoice | null>(
    null,
  );
  const [demoScanContext, setDemoScanContext] = useState<ScanContextState>(NEW_AUDIT_SCAN_CONTEXT);
  /** Scan context sent to the AI audit — reference document lines become the expected products. */
  const aiScanContext = useMemo(
    () =>
      aiPlanogramChoice === "reference"
        ? withReferencePlanogramRows(demoScanContext)
        : { ...demoScanContext, reference: undefined },
    [aiPlanogramChoice, demoScanContext],
  );
  const aiShelfScope = useMemo(() => {
    if (method !== "ai") return {};
    const selections = aiAuditCategorySelections(demoScanContext);
    const primary = selections[0];
    if (!primary) return {};
    return {
      category: primary.category_name,
      sub_category: primary.sub_category_label || primary.sub_category_id,
      category_selections: selections,
    };
  }, [method, demoScanContext]);
  const [aiChecks, setAiChecks] = useState<AiAnalysisCheck[]>([]);
  const [aiQuestion, setAiQuestion] = useState("");
  const aiReferenceRows = aiPlanogramChoice === "reference" ? (demoScanContext.reference?.rows ?? []) : null;
  const aiAnalysisRequest = useMemo(
    () => buildAiAnalysisRequest(aiChecks, aiQuestion, aiReferenceRows),
    [aiChecks, aiQuestion, aiReferenceRows],
  );
  const [captureFiles, setCaptureFiles] = useState<File[]>([]);
  const [captureMeta, setCaptureMeta] = useState<SweepCaptureMeta | null>(null);
  const [aiAuditLaunched, setAiAuditLaunched] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const userQuery = useQuery({
    queryKey: ["current-user-id", "new-audit"],
    queryFn: requireUserId,
  });

  const storesQuery = useQuery({
    queryKey: ["stores", "new-audit"],
    queryFn: () => fetchStores().then((r) => r.items),
  });
  const membersQuery = useQuery({
    queryKey: ["assignable-members", "new-audit"],
    queryFn: fetchAssignableMembers,
  });
  const coverageQuery = useQuery({
    queryKey: ["member-store-coverage"],
    queryFn: fetchMemberStoreCoverage,
    retry: false,
  });
  const templatesQuery = useQuery({
    queryKey: ["audit-templates", "new-audit", "all"],
    queryFn: () => fetchAuditTemplates({ status: "all", activeOnly: false }),
  });
  const initialTemplateQuery = useQuery({
    queryKey: ["audit-template", "new-audit", initialTemplateId],
    queryFn: () => fetchAuditTemplate(initialTemplateId!),
    enabled: Boolean(initialTemplateId),
  });

  const userId = userQuery.data;
  const allTemplates = templatesQuery.data ?? [];
  const myTemplates = useMemo(
    () =>
      allTemplates.filter(
        (t) =>
          !t.is_system_template &&
          t.visibility === "private" &&
          (!userId || t.owner_user_id === userId),
      ),
    [allTemplates, userId],
  );
  const filteredPublishedTemplates = allTemplates.filter(
    (t) =>
      (t.status === "published" || t.published) &&
      (!t.operating_model || t.operating_model === operatingModel) &&
      (t.is_system_template ||
        t.visibility === "organization" ||
        (t.visibility === "private" && t.owner_user_id === userId)),
  );

  useEffect(() => {
    if (initialSystemKey || initialTemplateId) return;
    if (method === "digital" && startChoice === "template") return;
    const recommended = getRecommendedTemplates(operatingModel, auditPurpose);
    const first = recommended[0];
    if (first) setTemplateChoice(`system:${first.key}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operatingModel, auditPurpose, initialSystemKey, initialTemplateId]);

  const systemTemplateKey = templateChoice.startsWith("system:")
    ? templateChoice.slice("system:".length)
    : null;
  const systemTemplateSpec = systemTemplateKey
    ? getSystemTemplateSpec(systemTemplateKey)
    : null;
  const selectedTemplate = useMemo(() => {
    if (templateChoice.startsWith("system:")) return null;
    if (templateChoice === "fnv") {
      return (
        filteredPublishedTemplates.find(
          (t) => t.template_type === "fnv_qc_audit" || t.name.toLowerCase().includes("fnv"),
        ) ?? null
      );
    }
    if (templateChoice === "planogram") {
      return filteredPublishedTemplates.find((t) => t.name.toLowerCase().includes("planogram")) ?? null;
    }
    const fromPublished = filteredPublishedTemplates.find((t) => t.id === templateChoice);
    if (fromPublished) return fromPublished;
    if (initialTemplateQuery.data?.id === templateChoice) return initialTemplateQuery.data;
    return null;
  }, [
    templateChoice,
    filteredPublishedTemplates,
    initialTemplateQuery.data,
  ]);
  const systemTemplateDefinition = useMemo(
    () => (systemTemplateSpec ? systemTemplateSpec.build() : null),
    [systemTemplateSpec],
  );
  const activeTemplateName =
    selectedTemplate?.name ?? systemTemplateSpec?.name ?? undefined;
  const templateIsPlanogram = isPlanogramRelatedTemplate({
    templateChoice,
    systemTemplateSpec,
    selectedTemplate,
  });
  const usesAiCustomPlanogram =
    method === "ai" &&
    (aiPlanogramChoice === "with_demo" || aiPlanogramChoice === "reference") &&
    aiScanContext.planogramRows.length > 0;
  const usesTemplateDemoPlanogram =
    startChoice === "template" && templateIsPlanogram;
  const operatingModelLabel =
    OPERATING_MODEL_CARDS.find((c) => c.id === operatingModel)?.title ?? operatingModel;
  const hasTemplate =
    templateChoice !== "general" &&
    (templateChoice.startsWith("system:") ||
      Boolean(selectedTemplate) ||
      (Boolean(initialTemplateId) &&
        templateChoice === initialTemplateId &&
        Boolean(initialTemplateQuery.data)));

  useEffect(() => {
    const template = initialTemplateQuery.data;
    if (!template || template.id !== initialTemplateId || templateHydrated) return;

    const hydration = hydrateFromSavedTemplate(template);
    if (hydration.operatingModel) setOperatingModel(hydration.operatingModel);
    if (hydration.auditPurpose) setAuditPurpose(hydration.auditPurpose);
    setMethod(hydration.method);
    setMethodTouched(true);
    if (hydration.inputSchema) setInputSchema(hydration.inputSchema);
    if (hydration.dataset) {
      setDataset(hydration.dataset);
      templateDatasetFor.current = template.id;
    }
    if (hydration.dataInputMode) setDataInputMode(hydration.dataInputMode);
    if (template.instructions) setInstructions(template.instructions);
    setTemplateHydrated(true);

    if (initialAssign) {
      setStartChoice("template");
      toast.success(`Loaded "${template.name}" — choose locations and assign.`);
    }
  }, [initialTemplateQuery.data, initialTemplateId, initialAssign, templateHydrated]);

  useEffect(() => {
    if (!initialAssign || initialTemplateId || !initialSystemKey || templateHydrated) return;
    setStartChoice("template");
    setTemplateHydrated(true);
    const spec = getSystemTemplateSpec(initialSystemKey);
    if (spec) toast.success(`Loaded "${spec.name}" — choose locations and assign.`);
  }, [initialAssign, initialSystemKey, initialTemplateId, templateHydrated]);

  useEffect(() => {
    if (startChoice === "csv") setDataInputMode("upload_csv");
    else if (startChoice === "custom") setDataInputMode("manual");
    else if (startChoice === "template") setDataInputMode(defaultDataInputMode(hasTemplate));
  }, [startChoice, hasTemplate]);

  const activeTemplateDefinition = useMemo(
    () => systemTemplateDefinition ?? (selectedTemplate ? templateToDefinition(selectedTemplate) : null),
    [systemTemplateDefinition, selectedTemplate],
  );
  const templateUsesLines = activeTemplateDefinition ? templateHasLines(activeTemplateDefinition) : false;
  const savedTemplatesForModel = useMemo(
    () =>
      [...filteredPublishedTemplates, ...myTemplates].filter(
        (t, i, arr) =>
          arr.findIndex((x) => x.id === t.id) === i &&
          (!t.operating_model || t.operating_model === operatingModel),
      ),
    [filteredPublishedTemplates, myTemplates, operatingModel],
  );

  useEffect(() => {
    if (method !== "digital" || startChoice !== "template" || !hasTemplate || !activeTemplateDefinition) return;
    if (templateDatasetFor.current === templateChoice) return;
    templateDatasetFor.current = templateChoice;
    if (!templateHasLines(activeTemplateDefinition)) {
      setDataset({ source: "manual", filename: null, columns: [], rows: [] });
      setInputSchema(buildInputSchema({ source: "manual", filename: null, columns: [], rows: [] }));
      setCsvSaved(true);
      return;
    }
    const built = buildTemplateDataset(activeTemplateDefinition, activeTemplateName ?? "Template");
    setDataset(built.dataset);
    setInputSchema(buildDigitalInputSchema(built.dataset, built.mappings));
    setCsvSaved(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, startChoice, hasTemplate, templateChoice, activeTemplateDefinition]);

  useEffect(() => {
    if (selectedTemplate?.audit_purpose) setAuditPurpose(selectedTemplate.audit_purpose);
    if (systemTemplateSpec?.purpose) setAuditPurpose(systemTemplateSpec.purpose);
  }, [selectedTemplate?.id, systemTemplateSpec?.key]);

  const isExpiryTemplate =
    startChoice === "template" &&
    templateUsesLines &&
    (selectedTemplate?.audit_purpose === "expiry" ||
      selectedTemplate?.template_type === "expiry_audit" ||
      systemTemplateSpec?.purpose === "expiry");
  const effectivePolicy = useMemo(() => {
    const photo =
      selectedTemplate?.evidence_required || systemTemplateDefinition?.evidence?.photoRequired
        ? ["context_photo" as EvidenceProof]
        : [];
    const minimum: EvidenceProof[] = [
      ...(selectedTemplate?.evidence_config || systemTemplateDefinition?.evidence ? photo : []),
      ...(isExpiryTemplate ? ["expiry_date" as EvidenceProof] : []),
    ];
    return mergeTemplateMinimum(evidencePolicy, minimum.length ? { requiredProof: minimum } : null);
  }, [evidencePolicy, selectedTemplate, systemTemplateDefinition, isExpiryTemplate]);
  const isScratch = method === "digital" && startChoice === "custom";
  const datasetError = validateAuditDataset(
    dataset,
    isScratch ? { manualColumnLimit: Number.POSITIVE_INFINITY, rowsOptional: true } : { manualColumnLimit: 10 },
  );
  const auditMode = mapCaptureMethodToAuditMode(method);
  const dataDefinitionError = validateDataDefinition({
    mode: dataInputMode,
    method: auditMode,
    datasetError,
    hasTemplate,
    inputSchema,
    rowCount: dataset.rows.length,
    rowsOptional: isScratch,
  });

  const hasLocations =
    locationScope.storeIds.length > 0 ||
    (locationScope.hierarchyNodeIds?.length ?? 0) > 0;

  const csvUploaded = dataset.source === "csv" && dataset.rows.length > 0;
  const startReady = useMemo(() => {
    if (!startChoice) return false;
    if (startChoice === "template") {
      if (!hasTemplate || templateChoice === "general") return false;
      if (method !== "digital" || !templateUsesLines) return true;
      return csvSaved && (dataset.rows.length === 0 || !datasetError);
    }
    if (startChoice === "csv") return csvUploaded && csvSaved && !datasetError;
    if (isScratch) return csvSaved && !datasetError;
    return true;
  }, [
    startChoice,
    isScratch,
    hasTemplate,
    templateChoice,
    method,
    templateUsesLines,
    dataset.rows.length,
    csvUploaded,
    csvSaved,
    datasetError,
  ]);

  const digitalUploadValue = useMemo(
    () => ({
      dataset,
      mappings:
        dataset.source === "csv" || isScratch ? syncDigitalMappings(dataset, inputSchema.columnMappings) : [],
      saved: csvSaved,
    }),
    [dataset, inputSchema.columnMappings, csvSaved, isScratch],
  );

  const evidenceDataset =
    ((startChoice === "csv" && dataset.source === "csv") || isScratch) && dataset.columns.length ? dataset : null;
  const hasColumn = (id: string | null) => Boolean(id && evidenceDataset?.columns.some((c) => c.id === id));
  const activeShelfColumnId =
    hasColumn(shelfColumnId) && policyUsesShelfColumn(effectivePolicy) ? shelfColumnId : null;
  const activeBarcodeColumnId =
    hasColumn(barcodeColumnId) && policyNeedsBarcodeColumn(effectivePolicy) ? barcodeColumnId : null;

  useEffect(() => {
    if (!evidenceDataset) return;
    if (policyUsesShelfColumn(effectivePolicy) && !hasColumn(shelfColumnId)) {
      setShelfColumnId(suggestShelfColumn(evidenceDataset));
    }
    if (policyNeedsBarcodeColumn(effectivePolicy) && !hasColumn(barcodeColumnId)) {
      setBarcodeColumnId(suggestBarcodeColumn(evidenceDataset));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evidenceDataset?.columns, effectivePolicy.requiredProof]);

  const evidenceColumnError =
    evidenceDataset && policyNeedsShelfColumn(effectivePolicy) && !activeShelfColumnId
      ? "Choose the shelf / location column for Evidence per shelf."
      : null;

  const singleStorePreselected = useRef(false);
  useEffect(() => {
    const stores = storesQuery.data ?? [];
    const only = stores.length === 1 ? stores[0] : undefined;
    if (singleStorePreselected.current || !only) return;
    singleStorePreselected.current = true;
    if (!locationScope.storeIds.length) setLocationScope(storeSelection(stores, [only.id]));
  }, [storesQuery.data, locationScope.storeIds.length]);

  useEffect(() => {
    if (assignToSelf && assigneeId) return;
    if (assigneeId && !teamScope.assigneeIds.includes(assigneeId)) {
      setTeamScope({ assigneeIds: [assigneeId] });
    }
  }, [assigneeId, assignToSelf, teamScope.assigneeIds]);

  useEffect(() => {
    if (assignToSelf) return;
    const primary = teamScope.assigneeIds[0];
    if (primary && primary !== assigneeId) {
      setAssigneeId(primary);
    }
  }, [assignToSelf, teamScope.assigneeIds, assigneeId]);

  const hierarchyProfileQuery = useQuery({
    queryKey: ["hierarchy-profiles", operatingModel],
    queryFn: () => fetchHierarchyProfiles(operatingModel),
    enabled: operatingModel === "fmcg_distributor",
  });

  useEffect(() => {
    const nodeId = locationScope.hierarchyNodeIds?.[0];
    const profileId = hierarchyProfileQuery.data?.[0]?.id;
    if (
      operatingModel !== "fmcg_distributor" ||
      !nodeId ||
      !profileId ||
      !(membersQuery.data ?? []).length
    ) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const outlets = await resolveHierarchyOutlets(profileId, nodeId);
      if (cancelled || !outlets.length) return;
      const { manualMapping, storeIds, distribution } = buildHierarchyDistribution({
        outlets,
        assignees: membersQuery.data ?? [],
      });
      if (!storeIds.length || !distribution.length) return;
      setLocationScope((prev) => ({
        ...prev,
        storeIds,
        stores: outlets.map((o) => ({ id: o.storeId, name: o.nodeName })),
      }));
      setTeamScope((prev) => ({
        ...prev,
        assigneeIds: [...new Set(Object.values(manualMapping))],
      }));
      setStoreAssigneeOverrides(manualMapping);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    locationScope.hierarchyNodeIds,
    hierarchyProfileQuery.data,
    operatingModel,
    membersQuery.data,
  ]);

  const existingAssignmentsQuery = useQuery({
    queryKey: ["org-assignments", "conflicts"],
    queryFn: fetchOrgAssignments,
    enabled: true,
  });

  const selectedAssignees = useMemo(
    () => resolveSelectedAssignees(teamScope, membersQuery.data ?? []),
    [teamScope, membersQuery.data],
  );
  const storeAssignees = useMemo(
    () => storeAssigneeMapping(
        locationScope.storeIds,
        selectedAssignees,
        storeAssigneeOverrides,
        coverageQuery.data,
      ),
    [locationScope.storeIds, selectedAssignees, storeAssigneeOverrides, coverageQuery.data],
  );
  const distributionStrategy: DistributionStrategy = assignToSelf ? "equal" : "manual";
  const teamScopeForPlan = useMemo<TeamScope>(
    () => (assignToSelf ? teamScope : { ...teamScope, manualMapping: storeAssignees }),
    [assignToSelf, teamScope, storeAssignees],
  );

  const assignmentPlan = useMemo((): AssignmentPlan | null => {
    const storeIds = locationScope.storeIds;
    const assignees = assignToSelf
      ? [{ user_id: "self", name: "Me", role: "member", email: "", status: "active" }]
      : selectedAssignees;
    if (!storeIds.length || !assignees.length) return null;

    const distribution = distributeAssignments({
      storeIds,
      assignees,
      strategy: distributionStrategy,
      manualMapping: teamScopeForPlan.manualMapping,
      storeNames: Object.fromEntries(
        (locationScope.stores ?? []).map((s) => [s.id, s.name]),
      ),
    });

    return {
      mode: assignmentMode,
      operatingModel,
      purpose: auditPurpose,
      templateId: selectedTemplate?.id ?? null,
      templateVersion: selectedTemplate?.version ?? null,
      templateName: selectedTemplate?.name ?? systemTemplateSpec?.name ?? String(templateChoice),
      auditMode,
      scopeType:
        auditMode === "digital" && dataset.rows.length
          ? "planogram"
          : location
            ? "location"
            : "category",
      scopeValues: {
        location,
        category,
        product_count: dataset.rows.length,
        ...aiShelfScope,
        ...(auditName.trim() ? { audit_name: auditName.trim() } : {}),
        ...(auditDescription.trim() ? { audit_description: auditDescription.trim() } : {}),
      },
      locationScope,
      teamScope: teamScopeForPlan,
      distributionStrategy,
      distribution,
      recurrence: assignmentMode === "recurring" ? recurrence : undefined,
      dueConfig: {
        dueDate: dueConfig.dueDate ?? dueAt?.slice(0, 10),
        dueTime: dueConfig.dueTime ?? dueAt?.slice(11, 16),
        dueOffsetHours: dueConfig.dueOffsetHours,
      },
      publishAt: assignmentMode === "schedule_once" ? publishAt : null,
      evidencePolicy: effectivePolicy,
      requireRca,
      reviewerId: reviewerId || null,
      instructions,
      campaignName: auditName.trim() || campaignName || null,
      inputSource: dataset.rows.length ? "csv_upload" : "template",
      creationSource: "unified_new_audit",
      planogramVersionId:
        method === "ai" && aiPlanogramChoice === "without" ? null : undefined,
    };
  }, [
    locationScope,
    assignToSelf,
    selectedAssignees,
    distributionStrategy,
    teamScopeForPlan,
    assignmentMode,
    operatingModel,
    auditPurpose,
    selectedTemplate,
    systemTemplateSpec,
    templateChoice,
    auditMode,
    dataset.rows.length,
    location,
    category,
    aiShelfScope,
    recurrence,
    dueConfig,
    dueAt,
    publishAt,
    effectivePolicy,
    requireRca,
    reviewerId,
    instructions,
    campaignName,
    auditName,
    auditDescription,
    method,
    aiPlanogramChoice,
  ]);

  const assignmentPreview = useMemo(() => {
    if (!assignmentPlan) return null;
    const conflicts = detectAssignmentConflicts({
      plan: assignmentPlan,
      existingAssignments: existingAssignmentsQuery.data ?? [],
    });
    return buildAssignmentPreview(assignmentPlan, conflicts);
  }, [assignmentPlan, existingAssignmentsQuery.data]);

  const stepStatus = validateNewAuditSteps({
    auditName,
    startChoice,
    startReady,
    method,
    aiPlanogramChoice,
    demoScanContext: aiScanContext,
    locationCount: hasLocations ? Math.max(1, locationScope.storeIds.length) : 0,
    assignToSelf,
    teamScope,
    assigneeId,
    assignmentMode,
    publishAt,
    evidenceLevel,
    evidencePolicy: effectivePolicy,
    reviewerId,
    evidenceError: evidenceColumnError,
    hasBlockingConflicts: hasBlockingConflicts(assignmentPreview?.conflicts ?? []),
    captureReady: captureFiles.length > 0,
    aiAnalysisReady: method !== "ai" || aiAnalysisReady(aiAnalysisRequest),
  });
  const shownSteps = displayStepStatus(stepStatus, { method: methodTouched, schedule: scheduleTouched });
  function touchSchedule<T>(set: (value: T) => void) {
    return (value: T) => {
      setScheduleTouched(true);
      set(value);
    };
  }

  const stepErrors = {
    name: !auditName.trim() ? "Audit name is required." : null,
    start:
      method === "digital" && !startReady
        ? startChoice === "template"
          ? !hasTemplate || templateChoice === "general"
            ? "Choose a template to continue."
            : !csvSaved
              ? "Save your template lines to continue."
              : datasetError
          : startChoice === "csv"
            ? !csvUploaded
              ? "Upload your file to continue."
              : !csvSaved
                ? "Save your audit data to continue."
                : datasetError
            : startChoice === "custom"
              ? !csvSaved
                ? "Save your audit to continue."
                : datasetError
              : "Choose how you want to start this audit."
        : null,
    method: !method ? "Choose how the audit will be performed." : null,
    planogram:
      method === "ai"
        ? aiStep3Error(aiPlanogramChoice, aiScanContext, aiAnalysisReady(aiAnalysisRequest))
        : null,
    where: !hasLocations
      ? storesQuery.data && !storesQuery.data.length && operatingModel !== "fmcg_distributor"
        ? "Add a store before creating an audit."
        : "Choose at least one store."
      : null,
    assign: !(assignToSelf || teamScope.assigneeIds.length > 0 || assigneeId)
      ? "Choose at least one team member or assign to yourself."
      : null,
    schedule:
      assignmentMode === "schedule_once" && !publishAt
        ? "Choose a publish date and time for the scheduled audit."
        : hasBlockingConflicts(assignmentPreview?.conflicts ?? [])
          ? "Resolve scheduling conflicts before submitting."
          : null,
    evidence:
      method !== "digital"
        ? null
        : effectivePolicy.reviewMode === "independent" && !reviewerId
          ? "Choose the independent reviewer for this audit."
          : evidenceColumnError,
  };

  const storeCount = locationScope.storeIds.length;
  const assigneeSummary = assignToSelf
    ? storeCount > 1
      ? `Me · all ${storeCount} stores`
      : "Assign to myself and start now"
    : storeCount > 1 || selectedAssignees.length > 1
      ? selectedAssignees
          .map((m) => ({
            name: m.name,
            stores: locationScope.storeIds.filter((id) => storeAssignees[id] === m.user_id).length,
          }))
          .filter((m) => m.stores > 0)
          .map((m) => `${m.name} · ${m.stores} ${m.stores === 1 ? "store" : "stores"}`)
          .join("\n") || "—"
      : teamScope.assigneeIds
          .map(
            (id) =>
              membersQuery.data?.find((m) => m.user_id === id)?.name ?? "Team member",
          )
          .join(", ") || "—";

  const evidenceLevelLabel =
    evidenceLevel === "high"
      ? "High assurance"
      : evidenceLevel.charAt(0).toUpperCase() + evidenceLevel.slice(1);
  const columnName = (id: string | null) => evidenceDataset?.columns.find((c) => c.id === id)?.name;
  const evidenceSummary = [
    evidenceLevelLabel,
    ...EVIDENCE_PROOF_OPTIONS.filter((o) => effectivePolicy.requiredProof.includes(o.value)).map((o) =>
      o.value === "shelf_photo" && activeShelfColumnId
        ? `${o.label} (by ${columnName(activeShelfColumnId)})`
        : o.value === "barcode" && activeBarcodeColumnId
          ? `${o.label} (${columnName(activeBarcodeColumnId)})`
          : o.label,
    ),
    ...(requireRca ? ["Explanation for every variance"] : []),
  ].join(" · ");

  function selectEvidenceLevel(level: EvidenceLevel) {
    setEvidenceLevel(level);
    setEvidencePolicy(policyForLevel(level));
  }

  function toggleProof(proof: EvidenceProof, checked: boolean) {
    setEvidenceLevel("custom");
    setEvidencePolicy((current) => ({
      ...current,
      level: "custom",
      requiredProof: checked
        ? [...new Set([...current.requiredProof, proof])]
        : current.requiredProof.filter((item) => item !== proof),
    }));
  }

  function handleOperatingModelChange(model: OperatingModel) {
    setOperatingModel(model);
    const purposes = getPurposesForModel(model);
    setAuditPurpose(purposes[0]?.value ?? "custom");
    setTemplateChoice("general");
    setStartChoice((current) => (current === "template" ? "template" : current));
  }

  function handleMethodChange(next: CaptureMethod) {
    setMethod(next);
    setMethodTouched(true);
    if (next !== "ai") {
      setAiPlanogramChoice(null);
      setDemoScanContext(NEW_AUDIT_SCAN_CONTEXT);
      setAiChecks([]);
      setAiQuestion("");
      setCaptureFiles([]);
      setAiAuditLaunched(false);
    } else {
      setAiPlanogramChoice((current) => current ?? "reference");
      scrollToNewAuditStep("step-3-start");
    }
  }

  function handleCaptureChange(files: File[], meta?: SweepCaptureMeta | null) {
    setCaptureFiles(files);
    if (meta !== undefined) setCaptureMeta(meta);
    else if (!files.length) setCaptureMeta(null);
    setAiAuditLaunched(false);
  }

  useEffect(() => {
    if (method === "ai" && !aiPlanogramChoice) setAiPlanogramChoice("reference");
  }, [method, aiPlanogramChoice]);

  useEffect(() => {
    if (!assignToSelf) {
      setCaptureFiles([]);
      setAiAuditLaunched(false);
    }
  }, [assignToSelf]);

  function handleAiPlanogramChange(choice: NewAuditPlanogramChoice) {
    setAiPlanogramChoice(choice);
  }

  function handleTemplateSelect(
    choice: string,
    meta?: { name: string; systemKey?: string },
  ) {
    setTemplateChoice(choice);
    setStartChoice("template");
    window.setTimeout(() => scrollToNewAuditStep("step-3-template-fields"), 150);
    if (userId && meta?.name) {
      recordRecentTemplate(userId, {
        id: choice.startsWith("system:") ? choice : choice,
        name: meta.name,
        systemKey: meta.systemKey,
        operatingModel,
      });
    }
  }

  const createMutation = useMutation({
    mutationFn: async (options?: { skipNavigation?: boolean }) => {
      const userId = await requireUserId();
      const resolvedAssigneeId = assignToSelf
        ? userId
        : assigneeId || teamScope.assigneeIds[0] || "";
      const assignee = assignToSelf
        ? { id: userId, name: "Me" }
        : {
            id: resolvedAssigneeId,
            name:
              membersQuery.data?.find((m) => m.user_id === resolvedAssigneeId)?.name ??
              "Auditor",
          };
      if (!assignee.id) {
        throw new Error(
          "Choose an auditor or assign the audit to yourself before publishing.",
        );
      }

      const assignmentTimezone = recurrence.timezone || "Asia/Kolkata";
      const resolvedDueAt = resolveAssignmentDueAt({
        dueConfig,
        legacyDueAt: dueAt || undefined,
        timezone: assignmentTimezone,
        publishAt: new Date(),
      });

      if (templateChoice === "expiry") {
        if (!locationScope.storeIds.length) throw new Error("Choose at least one store.");
        const attemptIds: string[] = [];
        for (const expiryStoreId of locationScope.storeIds) {
          attemptIds.push(
            await createExpiryAssignment({
              storeId: expiryStoreId,
              title: `Expiry inspection — ${sku || category || location}`,
              auditorId: assignToSelf ? assignee.id : (storeAssignees[expiryStoreId] ?? assignee.id),
              reviewerId: reviewerId || undefined,
              dueAt: resolvedDueAt || undefined,
              sku: sku || undefined,
              assuranceLevel: effectivePolicy.level === "high" ? "high" : "standard",
              instructions: instructions || undefined,
            }),
          );
        }
        return {
          assignmentId: attemptIds[0]!,
          self: assignToSelf,
          expiry: true,
          bulk: attemptIds.length,
          mode: assignmentMode,
          skipNavigation: options?.skipNavigation,
        };
      }

      let templateForAssignment = selectedTemplate;
      if (systemTemplateKey) {
        const ensured = await ensureSystemTemplate(systemTemplateKey);
        if (!ensured) throw new Error("Could not load the selected system template.");
        templateForAssignment = ensured;
      }

      if (auditMode === "digital" && dataDefinitionError) {
        throw new Error(dataDefinitionError);
      }

      const hasInputData =
        dataInputMode !== "template_only" &&
        dataInputMode !== "master_data" &&
        dataset.rows.length > 0;

      const isDigitalCsvAudit =
        auditMode === "digital" &&
        !templateForAssignment &&
        ((startChoice === "csv" && hasInputData && dataset.source === "csv") ||
          (isScratch && dataset.columns.length > 0));

      let digitalCsvTemplate: Awaited<ReturnType<typeof createDigitalCsvAuditTemplate>> | null = null;
      if (isDigitalCsvAudit) {
        if (!csvSaved) throw new Error("Save your audit data to continue.");
        if (datasetError) throw new Error(datasetError);
        digitalCsvTemplate = await createDigitalCsvAuditTemplate({
          name: auditName.trim() || campaignName || `Digital Audit ${new Date().toLocaleDateString()}`,
          inputSchema: buildDigitalInputSchema(dataset, syncDigitalMappings(dataset, inputSchema.columnMappings)),
          dataset,
          operatingModel,
          rowEvidence: rowEvidenceFromPolicy(effectivePolicy),
          shelfColumnId: activeShelfColumnId,
          barcodeColumnId: activeBarcodeColumnId,
        });
        templateForAssignment = digitalCsvTemplate;
      }

      const assignmentRows =
        auditMode === "digital" && hasInputData && !datasetError && !isDigitalCsvAudit
          ? datasetToDraftRows(dataset, { location, category })
          : [];

      const storeIds = locationScope.storeIds;
      const primaryStoreId = storeIds[0];
      if (!primaryStoreId) throw new Error("Choose at least one store.");

      let planogramVersionId: string | null = null;
      let ownPlanogramRows = 0;
      if (assignmentRows.length && primaryStoreId) {
        ownPlanogramRows = assignmentRows.length;
        planogramVersionId = await createAssignmentPlanogramVersion({
          storeId: primaryStoreId,
          rows: assignmentRows,
          sourceType: dataset.source === "csv" ? "csv" : "manual",
          sourceFilename: dataset.filename,
        });
      } else if (usesAiCustomPlanogram && primaryStoreId) {
        const referenceMeta = aiScanContext.reference?.meta;
        ownPlanogramRows = aiScanContext.planogramRows.length;
        planogramVersionId = await createAssignmentPlanogramVersion({
          storeId: primaryStoreId,
          rows: aiScanContext.planogramRows.map((row) => toDraftRow(row)),
          sourceType: referenceMeta?.source === "csv" ? "csv" : "manual",
          sourceFilename: referenceMeta
            ? referenceMeta.filename || "Reference document"
            : "New Audit Planogram",
        });
      } else if (usesTemplateDemoPlanogram && primaryStoreId) {
        const demoRows = demoPlanogramDraftRows();
        ownPlanogramRows = demoRows.length;
        planogramVersionId = await createAssignmentPlanogramVersion({
          storeId: primaryStoreId,
          rows: demoRows,
          sourceType: "manual",
          sourceFilename: "Aislix Demo Planogram",
        });
      }

      let templateSnapshot: Record<string, unknown>;

      if (digitalCsvTemplate) {
        templateSnapshot = {
          ...(digitalCsvTemplate as unknown as Record<string, unknown>),
          evidence_policy: effectivePolicy,
        };
      } else if (
        templateForAssignment &&
        (hasInputData ||
          (startChoice === "template" &&
            templateUsesLines &&
            dataset.source === "csv" &&
            dataset.columns.some((c) => !isTemplateColumn(c.id))))
      ) {
        templateSnapshot = buildMergedTemplateSnapshot({
          template: templateForAssignment,
          inputSchema,
          dataset,
          dataInputMode,
        });
      } else if (templateForAssignment) {
        templateSnapshot = templateForAssignment as unknown as Record<string, unknown>;
      } else if (hasInputData || inputSchema.columnMappings.length) {
        const csvDef = buildTemplateFromInputSchema(inputSchema, dataset, {
          name: auditName.trim() || campaignName || `Custom Audit ${new Date().toLocaleDateString()}`,
          operatingModel,
        });
        templateSnapshot = mergeInputSchemaIntoSnapshot(
          {
            ...definitionToPatch(csvDef),
            predefined_type: templateChoice,
            evidence_policy: effectivePolicy,
            name: csvDef.sections[0]?.label ?? "Custom CSV Audit",
          } as Record<string, unknown>,
          inputSchema,
          dataset,
        );
      } else {
        templateSnapshot = {
          predefined_type: templateChoice,
          evidence_policy: effectivePolicy,
        };
      }

      const reference =
        aiPlanogramChoice === "reference" ? referencePayloadFromContext(aiScanContext) : null;
      if (usesAiCustomPlanogram) {
        templateSnapshot = {
          ...templateSnapshot,
          planogram_mode: reference ? "reference" : "custom",
          ...(reference ? { reference } : {}),
          audit_role: demoScanContext.auditRole,
          scan_category: reference
            ? referenceScope(aiScanContext).category
            : (demoScanContext.planogramMeta?.category ?? DEMO_ORAL_CARE_META.category),
          scan_sub_category: reference
            ? referenceScope(aiScanContext).subCategory
            : (demoScanContext.planogramMeta?.sub_category ?? DEMO_ORAL_CARE_META.sub_category),
        };
      } else if (usesTemplateDemoPlanogram) {
        templateSnapshot = {
          ...templateSnapshot,
          demo_oral_care: true,
          planogram_mode: "demo",
          scan_category: DEMO_ORAL_CARE_META.category,
          scan_sub_category: DEMO_ORAL_CARE_META.sub_category,
        };
      } else if (method === "ai" && aiPlanogramChoice === "without") {
        templateSnapshot = {
          ...templateSnapshot,
          planogram_mode: "none",
          audit_role: demoScanContext.auditRole,
        };
      }
      if (method === "ai" && aiAnalysisReady(aiAnalysisRequest)) {
        templateSnapshot = { ...templateSnapshot, ai_analysis: aiAnalysisRequest };
      }

      const useUniversalEngine =
        storeIds.length > 1 ||
        teamScope.assigneeIds.length > 1 ||
        assignmentMode !== "assign_now";

      if (useUniversalEngine && assignmentPlan) {
        if (hasBlockingConflicts(assignmentPreview?.conflicts ?? [])) {
          throw new Error("Resolve blocking scheduling conflicts before publishing.");
        }
        const plan: AssignmentPlan = {
          ...assignmentPlan,
          ...(ownPlanogramRows
            ? {
                scopeType: "planogram" as const,
                scopeValues: { ...assignmentPlan.scopeValues, product_count: ownPlanogramRows },
              }
            : {}),
          templateId: templateForAssignment?.id ?? null,
          templateVersion: templateForAssignment?.version ?? null,
          templateSnapshot,
          planogramVersionId,
          teamScope: assignToSelf
            ? { assigneeIds: [userId] }
            : assignmentPlan.teamScope,
          distribution: distributeAssignments({
            storeIds,
            assignees: assignToSelf
              ? [
                  {
                    user_id: userId,
                    name: "Me",
                    role: "member",
                    email: "",
                    status: "active",
                  },
                ]
              : selectedAssignees,
            strategy: distributionStrategy,
            manualMapping: teamScopeForPlan.manualMapping,
          }),
        };
        const result = await publishAssignmentPlan(plan);
        if (
          assignToSelf &&
          assignmentMode === "assign_now" &&
          result.assignmentIds[0]
        ) {
          await startAssignment(result.assignmentIds[0]);
        }
        return {
          assignmentId: result.assignmentIds[0] ?? result.scheduleId ?? "",
          self: assignToSelf,
          expiry: false,
          bulk: result.assignmentIds.length,
          // Only recurring stays on /audit-schedules; schedule_once mints rows → assigned-scans.
          scheduled: result.mode === "recurring",
          mode: assignmentMode,
          skipNavigation: options?.skipNavigation,
        };
      }

      const assignmentId = await createScanAssignment({
        storeId: primaryStoreId,
        // An assignment-owned version holds exactly this audit's lines; a
        // location/category scope would filter them out by shelf name.
        scopeType:
          ownPlanogramRows || templateChoice === "planogram"
            ? "planogram"
            : location
              ? "location"
              : "category",
        scopeValues: {
          location,
          category,
          product_count: ownPlanogramRows,
          ...aiShelfScope,
          ...(auditName.trim() ? { audit_name: auditName.trim() } : {}),
          ...(auditDescription.trim() ? { audit_description: auditDescription.trim() } : {}),
        },
        assigneeId: assignee.id,
        assigneeName: assignee.name,
        dueAt: resolvedDueAt,
        instructions: instructions.trim(),
        // Explicit null for AI shelf-only so createScanAssignment does not
        // fall back to the store's active planogram CSV.
        planogramVersionId:
          method === "ai" && aiPlanogramChoice === "without" ? null : planogramVersionId,        auditMode,
        templateId: templateForAssignment?.id ?? null,
        templateVersion: templateForAssignment?.version ?? null,
        templateSnapshot,
        reviewerId: reviewerId || null,
        evidencePolicy: effectivePolicy,
        requireRca,
        creationSource: "unified_new_audit",
        inputSource: hasInputData
          ? dataset.source === "csv"
            ? "csv_upload"
            : "manual_rows"
          : templateForAssignment
            ? "template"
            : auditMode === "ai"
              ? "camera"
              : "manual_rows",
      });

      if (assignToSelf) await startAssignment(assignmentId);
      return {
        assignmentId,
        self: assignToSelf,
        expiry: false,
        bulk: 1,
        scheduled: false,
        mode: assignmentMode,
        skipNavigation: options?.skipNavigation,
      };
    },
    onSuccess: ({ assignmentId, self, expiry, bulk, scheduled, mode, skipNavigation }) => {
      if (skipNavigation) return;
      if (scheduled || mode === "recurring") {
        // Recurring only — schedule_once mints assignments and is not flagged scheduled.
        toast.success("Recurring audit schedule created.");
        void navigate({ to: "/audit-schedules" });
        return;
      }
      // Schedule Once always lands on Assignments — never jump into audit execution.
      if (mode === "schedule_once") {
        toast.success(self ? "Scheduled audit created." : "Audit scheduled successfully.");
        void navigate({ to: "/assigned-scans" });
        return;
      }
      if (bulk && bulk > 1) toast.success(`${bulk} assignments created.`);
      else toast.success(self ? "Audit created and started." : "Audit assigned successfully.");
      if (expiry && self) {
        void navigate({
          to: "/expiry-control/inspect/$attemptId",
          params: { attemptId: assignmentId },
        });
        return;
      }
      if (!self) {
        void navigate({ to: "/assigned-scans" });
      } else if (
        selectedTemplate ||
        systemTemplateKey ||
        (auditMode === "digital" && (startChoice === "csv" || startChoice === "custom"))
      ) {
        void navigate({
          to: "/audit/$assignmentId",
          params: { assignmentId },
        });
      } else if (auditMode === "digital") {
        void navigate({ to: "/digital-audit", search: { assignmentId } });
      } else {
        void navigate({ to: "/assigned-scans" });
      }
    },
    onError: (error) => {
      console.error("[new-audit] assignment creation failed:", error);
      if (error instanceof DueDateResolutionError) {
        toast.error(error.message);
        return;
      }
      toast.error(
        toUserMessage(error) ||
          "Could not create the assignment. Please check the assignment setup or permissions.",
      );
    },
  });

  const aiSelfAuditMutation = useMutation({
    mutationFn: async () => {
      if (!captureFiles.length) throw new Error("Add a shelf photo before running the AI audit.");
      setUploadProgress(0);
      const created = await createMutation.mutateAsync({ skipNavigation: true });
      const uploaded = await submitAuthenticatedAiAuditScan({
        files: captureFiles,
        assignmentId: created.assignmentId,
        storeId: storeId || undefined,
        scanContext: aiScanContext,
        notes: [auditDescription.trim(), instructions.trim()].filter(Boolean).join("\n\n"),
        onUploadProgress: setUploadProgress,
        captureMeta,
      });
      return { assignmentId: created.assignmentId, scanId: uploaded.scan_id };
    },
    onSuccess: ({ scanId }) => {
      setAiAuditLaunched(true);
      setUploadProgress(100);
      toast.success(
        captureFiles.length > 1
          ? `${captureFiles.length} photos uploaded — starting analysis…`
          : "Photo uploaded — starting analysis…",
      );
      void navigate({ to: "/processing", search: { scan: scanId } });
    },
    onError: (error) => {
      setUploadProgress(null);
      console.error("[new-audit] AI audit failed:", error);
      toast.error(
        toUserMessage(error) || "Could not complete the AI audit. Please try again.",
      );
    },
  });

  const showAssignmentSteps = method !== "ai" || aiPlanogramChoice !== null;
  /** Immediate self-run needs photo capture; schedule/recurring still creates an assignment. */
  const isAiSelfImmediate =
    method === "ai" && assignToSelf && assignmentMode === "assign_now";
  const previewReady = stepStatus[7];
  const canSubmit = previewReady && Boolean(assignmentPlan) && !isAiSelfImmediate;
  const canRunAiAudit =
    isAiSelfImmediate && captureFiles.length > 0 && stepStatus[7] && !aiAuditLaunched;
  const footerBusy = createMutation.isPending || aiSelfAuditMutation.isPending;

  function handleSubmit() {
    if (!canSubmit && !canRunAiAudit) {
      toast.error(
        stepErrors.name ??
          stepErrors.method ??
          stepErrors.start ??
          stepErrors.planogram ??
          stepErrors.where ??
          stepErrors.assign ??
          stepErrors.schedule ??
          stepErrors.evidence ??
          "Complete all required steps before submitting.",
      );
      return;
    }
    if (canRunAiAudit) {
      aiSelfAuditMutation.mutate();
      return;
    }
    createMutation.mutate(undefined);
  }

  const primaryLabel = aiSelfAuditMutation.isPending
    ? uploadProgress != null
      ? `Uploading ${uploadProgress}%…`
      : "Uploading…"
    : createMutation.isPending
      ? "Submitting…"
      : aiAuditLaunched
        ? "Audit started"
        : canRunAiAudit
          ? "Run AI audit"
          : "Submit";

  return (
    <AppShell title="" hidePageHeader>
      <div className="play-canvas mx-auto max-w-4xl space-y-6 pb-36">
        <PageHeader
          title="New audit"
          description="Set up your audit, choose how it will be performed, assign your team and schedule it."
        />

        <NewAuditStepNav
          stepStatus={shownSteps}
          method={method}
          assignToSelf={assignToSelf}
          assignmentMode={assignmentMode}
        />

        <div className="space-y-6">
          <NewAuditStep1Details
            auditName={auditName}
            auditDescription={auditDescription}
            onAuditNameChange={setAuditName}
            onAuditDescriptionChange={setAuditDescription}
            complete={stepStatus[1]}
            error={stepErrors.name}
          />

          <NewAuditStep3AuditMode
            method={method}
            onMethodChange={handleMethodChange}
            complete={shownSteps[2]}
            error={stepErrors.method}
          />

          <NewAuditStep2StartMethod
            method={method}
            startChoice={startChoice}
            operatingModel={operatingModel}
            selectedTemplateName={activeTemplateName}
            templateIsPlanogram={templateIsPlanogram}
            aiPlanogramChoice={aiPlanogramChoice}
            complete={stepStatus[3]}
            error={method === "digital" ? stepErrors.start : null}
            planogramError={method === "ai" ? stepErrors.planogram : null}
            onOperatingModelChange={handleOperatingModelChange}
            onAiPlanogramChange={handleAiPlanogramChange}
            aiChecks={aiChecks}
            aiQuestion={aiQuestion}
            onAiChecksChange={setAiChecks}
            onAiQuestionChange={setAiQuestion}
            demoScanContext={demoScanContext}
            onScanContextChange={setDemoScanContext}
            templateChoice={templateChoice}
            savedTemplates={savedTemplatesForModel}
            onTemplateSelect={handleTemplateSelect}
            templateSetup={
              method === "digital" && activeTemplateDefinition && activeTemplateName ? (
                templateUsesLines ? (
                  <DigitalAuditUploadPanel
                    templateName={activeTemplateName}
                    value={digitalUploadValue}
                    error={csvSaved && dataset.rows.length ? datasetError : null}
                    onChange={(next) => {
                      setDataset(next.dataset);
                      setInputSchema(buildDigitalInputSchema(next.dataset, next.mappings));
                      setCsvSaved(next.saved);
                    }}
                  />
                ) : (
                  <TemplateChecklistPreview definition={activeTemplateDefinition} templateName={activeTemplateName} />
                )
              ) : null
            }
            csvUpload={
              <DigitalAuditUploadPanel
                value={digitalUploadValue}
                error={csvUploaded && csvSaved ? datasetError : null}
                onChange={(next) => {
                  setDataset(next.dataset);
                  setInputSchema(buildDigitalInputSchema(next.dataset, next.mappings));
                  setCsvSaved(next.saved);
                }}
              />
            }
            evidenceSettings={
              method === "digital" ? (
                <AdvancedSettingsPanel
                  evidenceLevel={evidenceLevel}
                  evidencePolicy={effectivePolicy}
                  requireRca={requireRca}
                  onEvidenceLevelChange={selectEvidenceLevel}
                  onToggleProof={toggleProof}
                  onEvidencePolicyChange={(patch) => {
                    const photoRules =
                      "captureSource" in patch || "maximumEvidenceAgeMinutes" in patch || "qualityChecks" in patch;
                    if (photoRules) setEvidenceLevel("custom");
                    setEvidencePolicy((current) => ({ ...current, ...patch, ...(photoRules ? { level: "custom" } : {}) }));
                  }}
                  onRequireRcaChange={setRequireRca}
                  dataset={evidenceDataset}
                  shelfColumnId={activeShelfColumnId ?? shelfColumnId}
                  barcodeColumnId={activeBarcodeColumnId ?? barcodeColumnId}
                  onShelfColumnChange={setShelfColumnId}
                  onBarcodeColumnChange={setBarcodeColumnId}
                  members={[
                    ...(userId ? [{ user_id: userId, name: "Me" }] : []),
                    ...(membersQuery.data ?? [])
                      .filter((m) => m.status === "active" && ["owner", "admin", "manager"].includes(m.role.toLowerCase()))
                      .map((m) => ({ user_id: m.user_id, name: m.name })),
                  ]}
                  reviewerId={reviewerId}
                  onReviewerChange={setReviewerId}
                />
              ) : undefined
            }
            evidenceError={method === "digital" ? stepErrors.evidence : null}
            scratchBuilder={
              <DigitalAuditUploadPanel
                scratch
                value={digitalUploadValue}
                error={csvSaved && dataset.columns.length ? datasetError : null}
                onChange={(next) => {
                  setDataset(next.dataset);
                  setInputSchema(buildDigitalInputSchema(next.dataset, next.mappings));
                  setCsvSaved(next.saved);
                }}
              />
            }
            onStartChoiceChange={(choice) => {
              setStartChoice(choice);
              if (choice !== "template" && templateDatasetFor.current) {
                templateDatasetFor.current = null;
                const manual = createManualAuditDataset();
                setDataset(manual);
                setInputSchema(buildInputSchema(manual));
                setCsvSaved(true);
              }
              if (choice === "template" && !initialTemplateId && !initialSystemKey && startChoice !== "template") {
                setTemplateChoice("general");
              }
              if (choice === "csv") {
                setTemplateChoice("general");
                setDataInputMode("upload_csv");
              } else if (choice === "custom") {
                setTemplateChoice("general");
                setDataInputMode("manual");
                if (startChoice !== "custom") {
                  const empty: AuditInputDataset = { source: "manual", filename: null, columns: [], rows: [] };
                  setDataset(empty);
                  setInputSchema(buildDigitalInputSchema(empty, []));
                  setCsvSaved(true);
                }
              }
            }}
          />

          {showAssignmentSteps ? (
            <>
              <NewAuditStep4Stores
                operatingModel={operatingModel}
                stores={storesQuery.data ?? []}
                loading={storesQuery.isLoading}
                loadFailed={storesQuery.isError}
                value={locationScope}
                onChange={setLocationScope}
                note={
                  isAiSelfImmediate && storeCount > 1
                    ? `Your photo below is for ${locationScope.stores?.[0]?.name ?? "the first store"}. The other ${storeCount - 1} ${storeCount === 2 ? "audit goes" : "audits go"} to your audit list.`
                    : null
                }
                complete={stepStatus[4]}
                error={stepErrors.where}
              />

              <NewAuditStep4Assignment
                members={membersQuery.data ?? []}
                teamScope={teamScope}
                assignToSelf={assignToSelf}
                onTeamChange={setTeamScope}
                onAssignToSelfChange={setAssignToSelf}
                stores={locationScope.stores ?? []}
                storeAssignees={storeAssignees}
                coverage={coverageQuery.data}
                onStoreAssigneeChange={(id, userId) =>
                  setStoreAssigneeOverrides((current) => ({ ...current, [id]: userId }))
                }
                complete={stepStatus[5]}
                error={stepErrors.assign}
              />

              <NewAuditStep5Scheduling
                assignmentMode={assignmentMode}
                publishAt={publishAt}
                dueConfig={dueConfig}
                recurrence={recurrence}
                instructions={instructions}
                onAssignmentModeChange={touchSchedule(setAssignmentMode)}
                onPublishAtChange={touchSchedule(setPublishAt)}
                onDueConfigChange={touchSchedule(setDueConfig)}
                onRecurrenceChange={touchSchedule(setRecurrence)}
                onInstructionsChange={setInstructions}
                complete={shownSteps[6]}
                error={stepErrors.schedule}
              />

              <NewAuditStep7Preview
                auditName={auditName}
                auditDescription={auditDescription}
                startChoice={startChoice}
                templateName={activeTemplateName}
                operatingModelLabel={operatingModelLabel}
                method={method}
                storeNames={(locationScope.stores ?? []).map((s) => s.name)}
                planogramSummary={
                  method === "ai"
                    ? buildAiPlanogramPreviewSummary(aiPlanogramChoice, aiScanContext)
                    : templateIsPlanogram
                      ? buildAiPlanogramPreviewSummary("with_demo", demoScanContext)
                      : undefined
                }
                aiAnalysisSummary={method === "ai" ? aiAnalysisSummary(aiAnalysisRequest) : undefined}
                assigneeSummary={assigneeSummary}
                scheduleSummary={formatScheduleSummary(assignmentMode, publishAt)}
                evidenceSummary={evidenceSummary}
                showEvidence={method !== "ai"}
                assignToSelf={assignToSelf}
                complete={stepStatus[7]}
              />

              {isAiSelfImmediate ? (
                <>
                  <NewAuditStep7Capture
                    captureFiles={captureFiles}
                    onCaptureChange={handleCaptureChange}
                    role={aiScanContext.auditRole}
                    disabled={footerBusy || aiAuditLaunched}
                    complete={stepStatus[8] || aiAuditLaunched}
                    uploading={aiSelfAuditMutation.isPending}
                    uploadProgress={uploadProgress}
                    hasDocument={usesAiCustomPlanogram}
                  />
                  {aiAuditLaunched ? (
                    <p className="rounded-xl border border-[var(--aislix-border)] bg-[var(--aislix-surface)]/50 px-4 py-3 text-sm text-[var(--aislix-secondary)]">
                      Analysis is running on this page. When complete, results open automatically
                      and appear in{" "}
                      <Link to="/history" className="font-semibold text-[var(--aislix-primary)] underline">
                        audit history
                      </Link>
                      .
                    </p>
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--aislix-border)] bg-white/95 px-4 py-3 backdrop-blur md:px-6">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => void navigate({ to: "/audits" })}>
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={!assignmentPlan || createMutation.isPending}
                onClick={async () => {
                  if (!assignmentPlan) return;
                  try {
                    await saveAssignmentDraft(assignmentPlan);
                    toast.success("Draft saved.");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not save draft.");
                  }
                }}
              >
                Save draft
              </Button>
              <Button
                variant="brand"
                disabled={
                  footerBusy || aiAuditLaunched || (!canSubmit && !canRunAiAudit)
                }
                onClick={handleSubmit}
              >
                <CheckCircle2 className="size-4" />
                {primaryLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
