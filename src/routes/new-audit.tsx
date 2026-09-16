import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { createAssignmentPlanogramVersion } from "@/lib/planogram";
import { toUserMessage } from "@/lib/api/errors";
import { requireUserId } from "@/lib/db/context";
import { startAssignment } from "@/lib/assignments";
import { createAssignment as createExpiryAssignment } from "@/lib/expiry-control";
import {
  createManualAuditDataset,
  datasetToDraftRows,
  parseAuditSpreadsheet,
  validateAuditDataset,
  type AuditInputDataset,
} from "@/lib/audit-input-dataset";
import type { AuditPurpose, OperatingModel } from "@/lib/audit-builder/types";
import { AuditDataDefinitionStep } from "@/components/audit-builder/AuditDataDefinitionStep";
import type { InputSchema } from "@/lib/audit-builder/field-roles";
import {
  defaultDataInputMode,
  validateDataDefinition,
  type AuditDataInputMode,
} from "@/lib/audit-builder/audit-data-modes";
import {
  buildDefaultColumnMappings,
  buildInputSchema,
  buildTemplateFromInputSchema,
  mergeInputSchemaIntoSnapshot,
} from "@/lib/audit-builder/input-schema";
import { buildMergedTemplateSnapshot } from "@/lib/audit-builder/template-csv-merge";
import { definitionToPatch, templateToDefinition } from "@/lib/audit-templates";
import { fetchHierarchyProfiles } from "@/lib/hierarchy";
import { buildHierarchyDistribution, resolveHierarchyOutlets } from "@/lib/hierarchy/routing";
import { getPurposesForModel } from "@/lib/audit-engine/operating-model-catalog";
import { AdvancedSettingsPanel } from "@/components/new-audit/AdvancedSettingsPanel";
import { SimpleCsvUploadStep } from "@/components/new-audit/SimpleCsvUploadStep";
import { SimpleScratchBuilder } from "@/components/new-audit/SimpleScratchBuilder";
import { SimpleTemplatePicker } from "@/components/new-audit/SimpleTemplatePicker";
import { recordRecentTemplate } from "@/lib/new-audit/recent-templates";
import { AuditMethodCards } from "@/components/new-audit/AuditMethodCards";
import { AuditorFillPills } from "@/components/new-audit/AuditorFillPills";
import { NewAuditProgress } from "@/components/new-audit/NewAuditProgress";
import { OperatingModelCards } from "@/components/new-audit/OperatingModelCards";
import { SetupSummaryPanel, MobileSetupSummary } from "@/components/new-audit/SetupSummaryPanel";
import { SimpleAssignmentPanel } from "@/components/new-audit/SimpleAssignmentPanel";
import { SimpleLocationStep } from "@/components/new-audit/SimpleLocationStep";
import { StartChoiceCards } from "@/components/new-audit/StartChoiceCards";
import {
  mapCaptureMethodToAuditMode,
  resolveAuditorFillItems,
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
type Phase = "setup" | "configure" | "assign";

function NewAuditPage() {
  const navigate = useNavigate();
  const {
    templateId: initialTemplateId,
    systemKey: initialSystemKey,
    assign: initialAssign,
  } = Route.useSearch();
  const [phase, setPhase] = useState<Phase>("setup");
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
  const [inputError, setInputError] = useState<string | null>(null);
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
  const activeTemplateDefinition = useMemo(() => {
    if (selectedTemplate) return templateToDefinition(selectedTemplate);
    return systemTemplateDefinition;
  }, [selectedTemplate, systemTemplateDefinition]);
  const activeTemplateName =
    selectedTemplate?.name ?? systemTemplateSpec?.name ?? undefined;
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

  const startReady = useMemo(() => {
    if (!startChoice) return false;
    if (startChoice === "template") {
      return hasTemplate && templateChoice !== "general";
    }
    if (startChoice === "csv") {
      if (auditMode === "ai") return true;
      return dataset.columns.length > 0 && !dataDefinitionError;
    }
    if (startChoice === "custom") {
      return inputSchema.columnMappings.length > 0 && !dataDefinitionError;
    }
    return false;
  }, [
    startChoice,
    hasTemplate,
    templateChoice,
    auditMode,
    dataset.columns.length,
    dataDefinitionError,
    inputSchema.columnMappings.length,
  ]);

  const setupCompletedThrough = useMemo(() => {
    let completed = 0;
    if (operatingModel) completed = 1;
    if (hasLocations) completed = 2;
    if (method) completed = 3;
    if (startReady) completed = 4;
    return completed;
  }, [operatingModel, hasLocations, method, startReady]);

  const setupErrors = {
    model: !operatingModel ? "Choose where you are auditing." : null,
    location: !hasLocations ? "Select at least one location." : null,
    method: !method ? "Choose how the audit will be performed." : null,
    start: !startReady ? "Choose a template, upload data, or build a custom audit." : null,
  };

  const auditorFillItems = useMemo(
    () =>
      resolveAuditorFillItems({
        inputSchema,
        templateDefinition: activeTemplateDefinition,
      }),
    [inputSchema, activeTemplateDefinition],
  );

  const locationPreview = (locationScope.stores ?? [])
    .slice(0, 2)
    .map((s) => s.name)
    .join(", ");
  const locationOverflow =
    (locationScope.stores?.length ?? locationScope.storeIds.length) > 2
      ? ` +${(locationScope.stores?.length ?? locationScope.storeIds.length) - 2}`
      : "";

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
    enabled: operatingModel === "fmcg_distributor" && phase === "assign",
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
    phase,
  ]);

  const existingAssignmentsQuery = useQuery({
    queryKey: ["org-assignments", "conflicts"],
    queryFn: fetchOrgAssignments,
    enabled: phase === "assign",
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
      scopeValues: { location, category, product_count: dataset.rows.length },
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
      campaignName: campaignName || null,
      inputSource: dataset.rows.length ? "csv_upload" : "template",
      creationSource: "unified_new_audit",
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
  ]);

  const assignmentPreview = useMemo(() => {
    if (!assignmentPlan) return null;
    const conflicts = detectAssignmentConflicts({
      plan: assignmentPlan,
      existingAssignments: existingAssignmentsQuery.data ?? [],
    });
    return buildAssignmentPreview(assignmentPlan, conflicts);
  }, [assignmentPlan, existingAssignmentsQuery.data]);

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

  async function parseSpreadsheet(file: File) {
    try {
      const parsed = await parseAuditSpreadsheet(file);
      const schema = buildInputSchema(parsed);
      setDataset({ ...parsed, inputSchema: schema });
      setInputSchema(schema);
      setInputError(null);
      if (hasTemplate) setDataInputMode("template_plus_csv");
      else setDataInputMode("upload_csv");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not read this file.";
      if (message.toLowerCase().includes("xlsx") || message.toLowerCase().includes("csv")) {
        setInputError(message);
      } else if (message.toLowerCase().includes("empty")) {
        setInputError("Could not read the spreadsheet — the file appears empty.");
      } else {
        setInputError(message);
      }
    }
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

  function updateDataset(next: AuditInputDataset) {
    setDataset(next);
    setInputSchema((current) => {
      const mappings = current.columnMappings.filter((m) =>
        next.columns.some((c) => c.id === m.columnId),
      );
      const existingIds = new Set(mappings.map((m) => m.columnId));
      const added = next.columns
        .filter((c) => !existingIds.has(c.id))
        .map((col) => buildDefaultColumnMappings({ ...next, columns: [col] })[0]!);
      return buildInputSchema(next, current.subjectType, [...mappings, ...added]);
    });
  }

  const createMutation = useMutation({
    mutationFn: async () => {
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
        return { assignmentId: attemptId, self: assignToSelf, expiry: true };
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

      let planogramVersionId: string | null = null;
      if (assignmentRows.length) {
        planogramVersionId = await createAssignmentPlanogramVersion({
          storeId,
          rows: assignmentRows,
          sourceType: dataset.source === "csv" ? "csv" : "manual",
          sourceFilename: dataset.filename,
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
          name: campaignName || `Custom Audit ${new Date().toLocaleDateString()}`,
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

      if (method === "ai_assisted") {
        templateSnapshot = {
          ...templateSnapshot,
          ai_assisted: true,
          capture_method: "ai_assisted",
        };
      }

      const storeIds =
        locationScope.storeIds.length > 0 ? locationScope.storeIds : storeId ? [storeId] : [];
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
        },
        assigneeId: assignee.id,
        assigneeName: assignee.name,
        dueAt: resolvedDueAt,
        instructions,
        planogramVersionId,
        auditMode,
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
      return { assignmentId, self: assignToSelf, expiry: false, bulk: 1, scheduled: false };
    },
    onSuccess: ({ assignmentId, self, expiry, bulk, scheduled }) => {
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
        void navigate({ to: "/scan", search: { assignmentId } });
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

  const setupValid = setupCompletedThrough === 4;
  const configuredOnSetup =
    (startChoice === "csv" && dataset.columns.length > 0 && !dataDefinitionError) ||
    (startChoice === "custom" && inputSchema.columnMappings.length > 0 && !dataDefinitionError);
  const skipsConfigure =
    auditMode === "ai" ||
    configuredOnSetup ||
    (startChoice === "template" && dataInputMode === "template_only" && !dataDefinitionError);
  const configureValid = Boolean(
    hasLocations && (auditMode === "ai" || templateChoice === "expiry" || !dataDefinitionError),
  );
  const assignValid = Boolean(
    (assignToSelf || teamScope.assigneeIds.length > 0 || assigneeId) &&
      hasLocations &&
      (effectivePolicy.reviewMode !== "independent" || reviewerId) &&
      (assignmentMode !== "schedule_once" || publishAt) &&
      !hasBlockingConflicts(assignmentPreview?.conflicts ?? []),
  );

  function handleContinue() {
    if (phase === "setup") {
      if (!setupValid) {
        toast.error(
          setupErrors.start ??
            setupErrors.location ??
            setupErrors.method ??
            "Complete all four choices before continuing.",
        );
        return;
      }
      setPhase(skipsConfigure ? "assign" : "configure");
      return;
    }
    if (phase === "configure") {
      if (!configureValid) return;
      setPhase("assign");
    }
  }

  function handleBack() {
    if (phase === "assign") setPhase(skipsConfigure ? "setup" : "configure");
    else if (phase === "configure") setPhase("setup");
  }

  const canContinue =
    phase === "setup" ? setupValid : phase === "configure" ? configureValid : assignValid;

  return (
    <AppShell title="New Audit">
      <div className="play-canvas mx-auto max-w-6xl space-y-6 pb-24">
        <PageHeader
          title="New Audit"
          description="Create and assign an audit in minutes."
        />
        <NewAuditProgress completedThrough={setupCompletedThrough} phase={phase} />
        <MobileSetupSummary
          operatingModel={operatingModel}
          locationCount={locationScope.storeIds.length}
          method={method}
          templateName={activeTemplateName}
        />

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-10">
            {phase === "setup" ? (
              <>
                <OperatingModelCards
                  value={operatingModel}
                  onChange={(model) => {
                    setOperatingModel(model);
                    const purposes = getPurposesForModel(model);
                    setAuditPurpose(purposes[0]?.value ?? "custom");
                    setTemplateChoice("general");
                    setStartChoice(null);
                  }}
                  error={setupErrors.model}
                />
                <SimpleLocationStep
                  operatingModel={operatingModel}
                  value={locationScope}
                  onChange={setLocationScope}
                  error={setupErrors.location}
                />
                <AuditMethodCards
                  value={method}
                  onChange={setMethod}
                  error={setupErrors.method}
                />
                <StartChoiceCards
                  value={startChoice}
                  onChange={(choice) => {
                    setStartChoice(choice);
                    if (choice === "csv") {
                      setDataInputMode(hasTemplate ? "template_plus_csv" : "upload_csv");
                    } else if (choice === "custom") {
                      setTemplateChoice("general");
                      setDataInputMode("manual");
                    }
                  }}
                  selectedTemplateName={activeTemplateName}
                  error={setupErrors.start}
                  onOpenTemplatePicker={() => setTemplatePickerOpen(true)}
                >
                  {startChoice === "csv" ? (
                    <SimpleCsvUploadStep
                      dataset={dataset}
                      inputSchema={inputSchema}
                      templateName={activeTemplateName}
                      templateDefinition={activeTemplateDefinition}
                      error={inputError ?? dataDefinitionError}
                      onUpload={parseSpreadsheet}
                    />
                  ) : null}
                  {startChoice === "custom" ? (
                    <SimpleScratchBuilder
                      dataset={dataset}
                      inputSchema={inputSchema}
                      onDatasetChange={updateDataset}
                      onInputSchemaChange={setInputSchema}
                    />
                  ) : null}
                </StartChoiceCards>
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
              </>
            ) : null}

            {phase === "configure" ? (
              <section className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold">Configure your audit data</h2>
                  <p className="text-sm text-muted-foreground">
                    Upload or review the data your team will work from.
                  </p>
                </div>
                {auditMode === "digital" && templateChoice !== "expiry" ? (
                  <AuditDataDefinitionStep
                    dataInputMode={dataInputMode}
                    onDataInputModeChange={setDataInputMode}
                    hasTemplate={hasTemplate}
                    templateName={activeTemplateName}
                    templateDefinition={activeTemplateDefinition}
                    dataset={dataset}
                    inputSchema={inputSchema}
                    operatingModel={operatingModel}
                    error={inputError ?? dataDefinitionError}
                    onDatasetChange={(next) => {
                      updateDataset(next);
                      setInputError(null);
                    }}
                    onInputSchemaChange={setInputSchema}
                    onUpload={parseSpreadsheet}
                  />
                ) : (
                  <Alert>
                    <Sparkles className="size-4" />
                    <AlertDescription>
                      AI audits use photos and on-site capture. You can fine-tune evidence in
                      advanced settings on the next step.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <p className="mb-3 text-sm font-semibold">What your auditor will fill</p>
                  <AuditorFillPills items={auditorFillItems} />
                </div>
                {dataDefinitionError ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="size-4" />
                    <AlertDescription>{dataDefinitionError}</AlertDescription>
                  </Alert>
                ) : null}
              </section>
            ) : null}

            {phase === "assign" ? (
              <section className="space-y-6">
                <SimpleAssignmentPanel
                  locationCount={locationScope.storeIds.length}
                  members={membersQuery.data ?? []}
                  teamScope={teamScope}
                  distributionStrategy={distributionStrategy}
                  assignToSelf={assignToSelf}
                  assignmentMode={assignmentMode}
                  publishAt={publishAt}
                  dueConfig={dueConfig}
                  recurrence={recurrence}
                  reviewerId={reviewerId}
                  instructions={instructions}
                  campaignName={campaignName}
                  preview={assignmentPreview}
                  onTeamChange={setTeamScope}
                  onStrategyChange={setDistributionStrategy}
                  onAssignToSelfChange={setAssignToSelf}
                  onAssignmentModeChange={setAssignmentMode}
                  onPublishAtChange={setPublishAt}
                  onDueConfigChange={setDueConfig}
                  onRecurrenceChange={setRecurrence}
                  onReviewerChange={setReviewerId}
                  onInstructionsChange={setInstructions}
                  onCampaignNameChange={setCampaignName}
                />
                <AdvancedSettingsPanel
                  evidenceLevel={evidenceLevel}
                  evidencePolicy={effectivePolicy}
                  requireRca={requireRca}
                  onEvidenceLevelChange={selectEvidenceLevel}
                  onToggleProof={toggleProof}
                  onEvidencePolicyChange={(patch) =>
                    setEvidencePolicy((current) => ({ ...current, ...patch }))
                  }
                  onRequireRcaChange={setRequireRca}
                />
              </section>
            ) : null}
          </div>

          <SetupSummaryPanel
            className="hidden lg:block"
            operatingModel={operatingModel}
            locationCount={locationScope.storeIds.length}
            locationPreview={
              locationPreview ? `${locationPreview}${locationOverflow}` : undefined
            }
            method={method}
            startChoice={startChoice}
            templateName={activeTemplateName}
            auditorItems={auditorFillItems}
            evidenceCount={effectivePolicy.requiredProof.length}
            onEdit={() => setPhase("setup")}
          />
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:px-6">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={() => void navigate({ to: "/audits" })}
            >
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              {phase !== "setup" ? (
                <Button variant="outline" onClick={handleBack}>
                  Back
                </Button>
              ) : null}
              {phase === "assign" ? (
                <>
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
                    disabled={!canContinue || createMutation.isPending}
                    onClick={() => createMutation.mutate()}
                  >
                    <CheckCircle2 className="size-4" />
                    {assignmentMode === "assign_now"
                      ? assignToSelf
                        ? "Create & start"
                        : "Assign Now"
                      : assignmentMode === "schedule_once"
                        ? "Schedule"
                        : "Create Schedule"}
                  </Button>
                </>
              ) : (
                <Button disabled={!canContinue} onClick={handleContinue}>
                  Continue <ArrowRight className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
