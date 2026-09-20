import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { fetchStores } from "@/lib/account";
import { createScanAssignment, fetchAssignableMembers } from "@/lib/assignments";
import { fetchAuditTemplate, fetchAuditTemplates } from "@/lib/audit-templates";
import { hydrateFromSavedTemplate } from "@/lib/audit-builder/load-saved-template-audit";
import {
  mergeTemplateMinimum,
  policyForLevel,
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
  submitAuthenticatedAiAuditScan,
} from "@/lib/ai-audit/run-ai-audit-scan";
import { buildAiPlanogramPreviewSummary } from "@/lib/new-audit/ai-vision-context";
import {
  demoPlanogramDraftRows,
  isPlanogramRelatedTemplate,
  type NewAuditPlanogramChoice,
} from "@/lib/new-audit/planogram-setup";
import { DEMO_ORAL_CARE_META } from "@/lib/demo-oral-care-planogram";
import { EMPTY_SCAN_CONTEXT, type ScanContextState } from "@/lib/scan-context";
import { SimpleTemplatePicker } from "@/components/new-audit/SimpleTemplatePicker";
import { recordRecentTemplate } from "@/lib/new-audit/recent-templates";
import { NewAuditStepNav } from "@/components/new-audit/NewAuditStepNav";
import { NewAuditStep1Details } from "@/components/new-audit/steps/NewAuditStep1Details";
import { NewAuditStep2StartMethod } from "@/components/new-audit/steps/NewAuditStep2StartMethod";
import { NewAuditStep3AuditMode } from "@/components/new-audit/steps/NewAuditStep3AuditMode";
import { NewAuditStep4Assignment } from "@/components/new-audit/steps/NewAuditStep4Assignment";
import { NewAuditStep5Scheduling } from "@/components/new-audit/steps/NewAuditStep5Scheduling";
import { NewAuditStep6Evidence } from "@/components/new-audit/steps/NewAuditStep6Evidence";
import {
  NewAuditStep7Preview,
  formatScheduleSummary,
} from "@/components/new-audit/steps/NewAuditStep7Preview";
import { NewAuditStep7Capture } from "@/components/new-audit/steps/NewAuditStep7Capture";
import {
  isAiStep3Ready,
  scrollToNewAuditStep,
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
  type AssignmentMode,
  type AssignmentPlan,
  type DistributionStrategy,
  type DueConfig,
  type LocationScope,
  type RecurrenceRule,
  type TeamScope,
} from "@/lib/assignment-engine";
import { fetchOrgAssignments } from "@/lib/assignments";

export const Route = createFileRoute("/new-audit")({
  head: () => ({ meta: [{ title: "New Audit — Aislix" }] }),
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
  const [templateChoice, setTemplateChoice] = useState<TemplateChoice>(() => {
    if (initialSystemKey) return `system:${initialSystemKey}`;
    if (initialTemplateId) return initialTemplateId;
    return "general";
  });
  const [storeId, setStoreId] = useState("");
  const [location, setLocation] = useState("Main shelf");
  const [category, setCategory] = useState("");
  const [sku, setSku] = useState("");
  const [dataset, setDataset] = useState<AuditInputDataset>(createManualAuditDataset);
  const [inputSchema, setInputSchema] = useState<InputSchema>(() =>
    buildInputSchema(createManualAuditDataset()),
  );
  const [dataInputMode, setDataInputMode] = useState<AuditDataInputMode>("upload_csv");
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
  const [locationScope, setLocationScope] = useState<LocationScope>({ storeIds: [], stores: [] });
  const [teamScope, setTeamScope] = useState<TeamScope>({ assigneeIds: [] });
  const [distributionStrategy, setDistributionStrategy] =
    useState<DistributionStrategy>("equal");
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
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [aiPlanogramChoice, setAiPlanogramChoice] = useState<NewAuditPlanogramChoice | null>(
    null,
  );
  const [demoScanContext, setDemoScanContext] = useState<ScanContextState>(EMPTY_SCAN_CONTEXT);
  const [captureFile, setCaptureFile] = useState<File | null>(null);
  const [capturePreviewUrl, setCapturePreviewUrl] = useState<string | null>(null);
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
    const recommended = getRecommendedTemplates(operatingModel, auditPurpose);
    const first = recommended[0];
    if (first) setTemplateChoice(`system:${first.key}`);
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
    aiPlanogramChoice === "with_demo" &&
    demoScanContext.planogramRows.length > 0;
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
    if (hydration.inputSchema) setInputSchema(hydration.inputSchema);
    if (hydration.dataset) setDataset(hydration.dataset);
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

  useEffect(() => {
    if (selectedTemplate?.audit_purpose) setAuditPurpose(selectedTemplate.audit_purpose);
    if (systemTemplateSpec?.purpose) setAuditPurpose(systemTemplateSpec.purpose);
  }, [selectedTemplate?.id, systemTemplateSpec?.key]);

  useEffect(() => {
    const firstStoreId = locationScope.storeIds[0];
    if (firstStoreId && storeId !== firstStoreId) setStoreId(firstStoreId);
  }, [locationScope.storeIds, storeId]);
  const effectivePolicy = useMemo(
    () =>
      mergeTemplateMinimum(
        evidencePolicy,
        selectedTemplate?.evidence_config || systemTemplateDefinition?.evidence
          ? {
              requiredProof:
                selectedTemplate?.evidence_required ||
                systemTemplateDefinition?.evidence?.photoRequired
                  ? ["context_photo" as EvidenceProof]
                  : [],
            }
          : null,
      ),
    [evidencePolicy, selectedTemplate, systemTemplateDefinition],
  );
  const datasetError = validateAuditDataset(dataset, { manualColumnLimit: 10 });
  const auditMode = mapCaptureMethodToAuditMode(method);
  const dataDefinitionError = validateDataDefinition({
    mode: dataInputMode,
    method: auditMode,
    datasetError,
    hasTemplate,
    inputSchema,
    rowCount: dataset.rows.length,
  });

  const hasLocations =
    locationScope.storeIds.length > 0 ||
    (locationScope.hierarchyNodeIds?.length ?? 0) > 0;

  /** IA phase: card selection only — CSV/scratch deep config comes in later iterations. */
  const startReady = useMemo(() => {
    if (!startChoice) return false;
    if (startChoice === "template") {
      return hasTemplate && templateChoice !== "general";
    }
    return true;
  }, [startChoice, hasTemplate, templateChoice]);

  useEffect(() => {
    const stores = storesQuery.data;
    if (!stores?.length || locationScope.storeIds.length > 0) return;
    const store = stores[0];
    setLocationScope({
      storeIds: [store.id],
      stores: [{ id: store.id, name: store.name, city: store.city, country: store.country }],
    });
    setStoreId(store.id);
  }, [storesQuery.data, locationScope.storeIds.length]);

  useEffect(() => {
    if (storeId && !locationScope.storeIds.includes(storeId)) {
      const store = storesQuery.data?.find((s) => s.id === storeId);
      if (store) {
        setLocationScope({
          storeIds: [store.id],
          stores: [
            { id: store.id, name: store.name, city: store.city, country: store.country },
          ],
        });
      }
    }
  }, [storeId, storesQuery.data, locationScope.storeIds]);

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
        manualMapping,
      }));
      setDistributionStrategy("manual");
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

  const assignmentPlan = useMemo((): AssignmentPlan | null => {
    const storeIds =
      locationScope.storeIds.length > 0 ? locationScope.storeIds : storeId ? [storeId] : [];
    const assignees = assignToSelf
      ? [{ user_id: "self", name: "Me", role: "member", email: "", status: "active" }]
      : resolveSelectedAssignees(teamScope, membersQuery.data ?? []);
    if (!storeIds.length || !assignees.length) return null;

    const distribution = distributeAssignments({
      storeIds,
      assignees,
      strategy: distributionStrategy,
      manualMapping: teamScope.manualMapping,
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
        ...(auditName.trim() ? { audit_name: auditName.trim() } : {}),
        ...(auditDescription.trim() ? { audit_description: auditDescription.trim() } : {}),
      },
      locationScope: { ...locationScope, storeIds },
      teamScope,
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
    storeId,
    assignToSelf,
    teamScope,
    membersQuery.data,
    distributionStrategy,
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
    demoScanContext,
    assignToSelf,
    teamScope,
    assigneeId,
    assignmentMode,
    publishAt,
    evidenceLevel,
    evidencePolicy: effectivePolicy,
    reviewerId,
    hasBlockingConflicts: hasBlockingConflicts(assignmentPreview?.conflicts ?? []),
    captureReady: Boolean(captureFile),
  });

  const stepErrors = {
    name: !auditName.trim() ? "Audit name is required." : null,
    start:
      method === "digital" && !startReady
        ? startChoice === "template"
          ? "Choose a template to continue."
          : "Choose how you want to start this audit."
        : null,
    method: !method ? "Choose how the audit will be performed." : null,
    planogram:
      method === "ai" && !aiPlanogramChoice
        ? "Select with or without a planogram to continue."
        : method === "ai" &&
            aiPlanogramChoice &&
            !isAiStep3Ready(aiPlanogramChoice, demoScanContext)
          ? aiPlanogramChoice === "with_demo"
            ? "Complete role, category, sub-category, and planogram upload."
            : "Complete role, category, and sub-category."
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
      effectivePolicy.reviewMode === "independent" && !reviewerId
        ? "An independent reviewer is required for this evidence level."
        : null,
  };

  const assigneeSummary = assignToSelf
    ? "Assign to myself and start now"
    : teamScope.assigneeIds
        .map(
          (id) =>
            membersQuery.data?.find((m) => m.user_id === id)?.name ?? "Team member",
        )
        .join(", ") || "—";

  const evidenceSummary =
    evidenceLevel === "high"
      ? "High assurance"
      : evidenceLevel.charAt(0).toUpperCase() + evidenceLevel.slice(1);

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
    if (next !== "ai") {
      setAiPlanogramChoice(null);
      setDemoScanContext(EMPTY_SCAN_CONTEXT);
      setCaptureFile(null);
      setCapturePreviewUrl(null);
      setAiAuditLaunched(false);
    } else {
      scrollToNewAuditStep("step-3-start");
    }
  }

  function handleCaptureChange(file: File | null, previewUrl: string | null) {
    setCaptureFile(file);
    setCapturePreviewUrl(previewUrl);
    setAiAuditLaunched(false);
  }

  useEffect(() => {
    if (!assignToSelf) {
      setCaptureFile(null);
      setCapturePreviewUrl(null);
      setAiAuditLaunched(false);
    }
  }, [assignToSelf]);

  function handleAiPlanogramChange(choice: NewAuditPlanogramChoice) {
    setAiPlanogramChoice(choice);
    setDemoScanContext(EMPTY_SCAN_CONTEXT);
  }

  function handleAiPlanogramReset() {
    setAiPlanogramChoice(null);
    setDemoScanContext(EMPTY_SCAN_CONTEXT);
  }

  function handleTemplateSelect(
    choice: string,
    meta?: { name: string; systemKey?: string },
  ) {
    setTemplateChoice(choice);
    setStartChoice("template");
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
        const attemptId = await createExpiryAssignment({
          storeId,
          title: `Expiry inspection — ${sku || category || location}`,
          auditorId: assignee.id,
          reviewerId: reviewerId || undefined,
          dueAt: resolvedDueAt || undefined,
          sku: sku || undefined,
          assuranceLevel: effectivePolicy.level === "high" ? "high" : "standard",
          instructions: instructions || undefined,
        });
        return {
          assignmentId: attemptId,
          self: assignToSelf,
          expiry: true,
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

      const assignmentRows =
        auditMode === "digital" && hasInputData && !datasetError
          ? datasetToDraftRows(dataset, { location, category })
          : [];

      const storeIds =
        locationScope.storeIds.length > 0 ? locationScope.storeIds : storeId ? [storeId] : [];
      const primaryStoreId = storeIds[0] ?? storeId;

      let planogramVersionId: string | null = null;
      if (assignmentRows.length && primaryStoreId) {
        planogramVersionId = await createAssignmentPlanogramVersion({
          storeId: primaryStoreId,
          rows: assignmentRows,
          sourceType: dataset.source === "csv" ? "csv" : "manual",
          sourceFilename: dataset.filename,
        });
      } else if (usesAiCustomPlanogram && primaryStoreId) {
        planogramVersionId = await createAssignmentPlanogramVersion({
          storeId: primaryStoreId,
          rows: demoScanContext.planogramRows.map((row) => toDraftRow(row)),
          sourceType: "manual",
          sourceFilename: "New Audit Planogram",
        });
      } else if (usesTemplateDemoPlanogram && primaryStoreId) {
        planogramVersionId = await createAssignmentPlanogramVersion({
          storeId: primaryStoreId,
          rows: demoPlanogramDraftRows(),
          sourceType: "manual",
          sourceFilename: "Aislix Demo Planogram",
        });
      }

      let templateSnapshot: Record<string, unknown>;

      if (templateForAssignment && hasInputData) {
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

      if (usesAiCustomPlanogram) {
        templateSnapshot = {
          ...templateSnapshot,
          planogram_mode: "custom",
          audit_role: demoScanContext.auditRole,
          scan_category:
            demoScanContext.planogramMeta?.category ?? DEMO_ORAL_CARE_META.category,
          scan_sub_category:
            demoScanContext.planogramMeta?.sub_category ?? DEMO_ORAL_CARE_META.sub_category,
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
              : resolveSelectedAssignees(teamScope, membersQuery.data ?? []),
            strategy: distributionStrategy,
          }),
        };
        const result = await publishAssignmentPlan(plan);
        if (assignToSelf && result.assignmentIds[0]) {
          await startAssignment(result.assignmentIds[0]);
        }
        return {
          assignmentId: result.assignmentIds[0] ?? result.scheduleId ?? "",
          self: assignToSelf,
          expiry: false,
          bulk: result.assignmentIds.length,
          scheduled: Boolean(result.scheduleId),
          skipNavigation: options?.skipNavigation,
        };
      }

      const assignmentId = await createScanAssignment({
        storeId: storeIds[0] ?? storeId,
        scopeType:
          assignmentRows.length || templateChoice === "planogram"
            ? "planogram"
            : location
              ? "location"
              : "category",
        scopeValues: {
          location,
          category,
          product_count: assignmentRows.length,
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
        skipNavigation: options?.skipNavigation,
      };
    },
    onSuccess: ({ assignmentId, self, expiry, bulk, scheduled, skipNavigation }) => {
      if (skipNavigation) return;
      if (scheduled) toast.success("Audit schedule created.");
      else if (bulk && bulk > 1) toast.success(`${bulk} assignments created.`);
      else toast.success(self ? "Audit created and started." : "Audit assigned successfully.");
      if (expiry && self) {
        void navigate({
          to: "/expiry-control/inspect/$attemptId",
          params: { attemptId: assignmentId },
        });
        return;
      }
      if (!self) {
        void navigate({ to: "/audits", search: { tab: "reviews" } });
      } else if (selectedTemplate || systemTemplateKey) {
        void navigate({
          to: "/audit/$assignmentId",
          params: { assignmentId },
        });
      } else if (auditMode === "digital") {
        void navigate({ to: "/digital-audit", search: { assignmentId } });
      } else {
        void navigate({ to: "/audits", search: { tab: "reviews" } });
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
      if (!captureFile) throw new Error("Add a shelf photo before running the AI audit.");
      setUploadProgress(0);
      const created = await createMutation.mutateAsync({ skipNavigation: true });
      const uploaded = await submitAuthenticatedAiAuditScan({
        files: [captureFile],
        assignmentId: created.assignmentId,
        storeId: storeId || undefined,
        scanContext: demoScanContext,
        notes: [auditDescription.trim(), instructions.trim()].filter(Boolean).join("\n\n"),
        onUploadProgress: setUploadProgress,
      });
      return { assignmentId: created.assignmentId, scanId: uploaded.scan_id };
    },
    onSuccess: ({ scanId }) => {
      setAiAuditLaunched(true);
      setUploadProgress(100);
      toast.success("Photo uploaded — starting analysis…");
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
  const isAiSelf = method === "ai" && assignToSelf;
  const previewReady = method === "ai" ? stepStatus[6] : stepStatus[7];
  const canSubmit = previewReady && Boolean(assignmentPlan) && !isAiSelf;
  const canRunAiAudit =
    isAiSelf && Boolean(captureFile) && stepStatus[6] && !aiAuditLaunched;
  const footerBusy = createMutation.isPending || aiSelfAuditMutation.isPending;

  function handleSubmit() {
    if (!canSubmit && !canRunAiAudit) {
      toast.error(
        stepErrors.name ??
          stepErrors.method ??
          stepErrors.start ??
          stepErrors.planogram ??
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
          ? "Run AI Audit"
          : "Submit";

  return (
    <AppShell title="" hidePageHeader>
      <div className="play-canvas mx-auto max-w-4xl space-y-6 pb-36">
        <PageHeader
          title="New Audit"
          description="Set up your audit, choose how it will be performed, assign your team and schedule it."
        />

        <NewAuditStepNav stepStatus={stepStatus} method={method} assignToSelf={assignToSelf} />

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
            complete={stepStatus[2]}
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
            onAiPlanogramReset={handleAiPlanogramReset}
            demoScanContext={demoScanContext}
            onScanContextChange={setDemoScanContext}
            onOpenTemplatePicker={() => setTemplatePickerOpen(true)}
            onStartChoiceChange={(choice) => {
              setStartChoice(choice);
              if (choice === "csv") {
                setDataInputMode(hasTemplate ? "template_plus_csv" : "upload_csv");
              } else if (choice === "custom") {
                setTemplateChoice("general");
                setDataInputMode("manual");
              }
            }}
          />

          {showAssignmentSteps ? (
            <>
              <NewAuditStep4Assignment
                members={membersQuery.data ?? []}
                teamScope={teamScope}
                assignToSelf={assignToSelf}
                onTeamChange={setTeamScope}
                onAssignToSelfChange={setAssignToSelf}
                complete={stepStatus[4]}
                error={stepErrors.assign}
              />

              <NewAuditStep5Scheduling
                assignmentMode={assignmentMode}
                publishAt={publishAt}
                dueConfig={dueConfig}
                recurrence={recurrence}
                instructions={instructions}
                onAssignmentModeChange={setAssignmentMode}
                onPublishAtChange={setPublishAt}
                onDueConfigChange={setDueConfig}
                onRecurrenceChange={setRecurrence}
                onInstructionsChange={setInstructions}
                complete={stepStatus[5]}
                error={stepErrors.schedule}
              />

              {method !== "ai" ? (
                <NewAuditStep6Evidence
                  evidenceLevel={evidenceLevel}
                  evidencePolicy={effectivePolicy}
                  requireRca={requireRca}
                  onEvidenceLevelChange={selectEvidenceLevel}
                  onToggleProof={toggleProof}
                  onEvidencePolicyChange={(patch) =>
                    setEvidencePolicy((current) => ({ ...current, ...patch }))
                  }
                  onRequireRcaChange={setRequireRca}
                  complete={stepStatus[6]}
                  error={stepErrors.evidence}
                />
              ) : null}

              <NewAuditStep7Preview
                auditName={auditName}
                auditDescription={auditDescription}
                startChoice={startChoice}
                templateName={activeTemplateName}
                operatingModelLabel={operatingModelLabel}
                method={method}
                stepNumber={method === "ai" ? 6 : 7}
                sectionId={method === "ai" ? "step-6-preview" : "step-7-preview"}
                planogramSummary={
                  method === "ai"
                    ? buildAiPlanogramPreviewSummary(aiPlanogramChoice, demoScanContext)
                    : templateIsPlanogram
                      ? buildAiPlanogramPreviewSummary("with_demo", demoScanContext)
                      : undefined
                }
                assigneeSummary={assigneeSummary}
                scheduleSummary={formatScheduleSummary(assignmentMode, publishAt)}
                evidenceSummary={evidenceSummary}
                showEvidence={method !== "ai"}
                assignToSelf={assignToSelf}
                complete={method === "ai" ? stepStatus[6] : stepStatus[7]}
              />

              {isAiSelf ? (
                <>
                  <NewAuditStep7Capture
                    captureFile={captureFile}
                    capturePreviewUrl={capturePreviewUrl}
                    onCaptureChange={handleCaptureChange}
                    disabled={footerBusy || aiAuditLaunched}
                    complete={stepStatus[7] || aiAuditLaunched}
                    uploading={aiSelfAuditMutation.isPending}
                    uploadProgress={uploadProgress}
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

        <SimpleTemplatePicker
          open={templatePickerOpen}
          onOpenChange={setTemplatePickerOpen}
          operatingModel={operatingModel}
          auditPurpose={auditPurpose}
          templateChoice={templateChoice}
          userId={userId}
          publishedTemplates={filteredPublishedTemplates}
          myTemplates={myTemplates}
          onSelect={handleTemplateSelect}
        />

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
                Save Draft
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
