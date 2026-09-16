import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fetchStores } from "@/lib/account";
import { createScanAssignment, fetchAssignableMembers } from "@/lib/assignments";
import { fetchAuditTemplates } from "@/lib/audit-templates";
import {
  EVIDENCE_PROOF_OPTIONS,
  mergeTemplateMinimum,
  policyForLevel,
  type AuditEvidencePolicy,
  type EvidenceLevel,
  type EvidenceProof,
} from "@/lib/audit-evidence-policy";
import { createAssignmentPlanogramVersion } from "@/lib/planogram";
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
import {
  getFmcgDimensions,
  getOperatingModelCard,
  getPurposesForModel,
  getTerminology,
  OPERATING_MODEL_CARDS,
} from "@/lib/audit-engine/operating-model-catalog";
import { NewAuditTemplatePicker } from "@/components/audit-engine/NewAuditTemplatePicker";
import { ensureSystemTemplate } from "@/lib/audit-engine/seed-templates";
import { getRecommendedTemplates, getSystemTemplateSpec } from "@/lib/audit-engine/template-factory";
import { AssignmentPreviewPanel } from "@/components/assignment-engine/AssignmentPreviewPanel";
import { AssignmentSchedulePanel } from "@/components/assignment-engine/AssignmentSchedulePanel";
import { LocationScopePicker } from "@/components/assignment-engine/LocationScopePicker";
import { TeamAssignmentPanel } from "@/components/assignment-engine/TeamAssignmentPanel";
import {
  buildAssignmentPreview,
  detectAssignmentConflicts,
  distributeAssignments,
  hasBlockingConflicts,
  publishAssignmentPlan,
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
  }),
  component: NewAuditPage,
});

type Method = "digital" | "ai";
type TemplateChoice = "general" | "fnv" | "expiry" | "planogram" | string;

const steps = [
  { id: 1, label: "What are you auditing?", icon: Sparkles },
  { id: 2, label: "Define the audit data", icon: FileSpreadsheet },
  { id: 3, label: "Verification", icon: ShieldCheck },
  { id: 4, label: "Assign & Review", icon: Users },
];

function NewAuditPage() {
  const navigate = useNavigate();
  const { templateId: initialTemplateId, systemKey: initialSystemKey } = Route.useSearch();
  const [step, setStep] = useState(1);
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
  const [method, setMethod] = useState<Method>("digital");
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

  const storesQuery = useQuery({
    queryKey: ["stores", "new-audit"],
    queryFn: () => fetchStores().then((r) => r.items),
  });
  const membersQuery = useQuery({
    queryKey: ["assignable-members", "new-audit"],
    queryFn: fetchAssignableMembers,
  });
  const templatesQuery = useQuery({
    queryKey: ["audit-templates", "new-audit"],
    queryFn: () => fetchAuditTemplates({ status: "published", activeOnly: true }),
  });

  const purposeOptions = getPurposesForModel(operatingModel);
  const terminology = getTerminology(operatingModel);
  const filteredPublishedTemplates = (templatesQuery.data ?? []).filter(
    (t) => !t.operating_model || t.operating_model === operatingModel,
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
  const selectedTemplate =
    templateChoice === "fnv"
      ? filteredPublishedTemplates.find(
          (t) => t.template_type === "fnv_qc_audit" || t.name.toLowerCase().includes("fnv"),
        )
      : templateChoice === "planogram"
        ? filteredPublishedTemplates.find((t) => t.name.toLowerCase().includes("planogram"))
        : templateChoice.startsWith("system:")
          ? null
          : filteredPublishedTemplates.find((t) => t.id === templateChoice);
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
    (templateChoice.startsWith("system:") || Boolean(selectedTemplate));

  useEffect(() => {
    setDataInputMode(defaultDataInputMode(hasTemplate));
  }, [hasTemplate, templateChoice]);
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
  const dataDefinitionError = validateDataDefinition({
    mode: dataInputMode,
    method,
    datasetError,
    hasTemplate,
    inputSchema,
    rowCount: dataset.rows.length,
  });

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

  const hierarchyProfileQuery = useQuery({
    queryKey: ["hierarchy-profiles", operatingModel],
    queryFn: () => fetchHierarchyProfiles(operatingModel),
    enabled: operatingModel === "fmcg_distributor" && step === 4,
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
    step,
  ]);

  const existingAssignmentsQuery = useQuery({
    queryKey: ["org-assignments", "conflicts"],
    queryFn: fetchOrgAssignments,
    enabled: step === 4,
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
      auditMode: method,
      scopeType:
        method === "digital" && dataset.rows.length ? "planogram" : location ? "location" : "category",
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
    method,
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
    } catch (error) {
      setInputError(error instanceof Error ? error.message : "Could not read this file.");
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
      const assignee = assignToSelf
        ? { id: userId, name: "Me" }
        : {
            id: assigneeId,
            name: membersQuery.data?.find((m) => m.user_id === assigneeId)?.name ?? "Auditor",
          };
      if (!assignee.id) throw new Error("Choose an auditor or assign the audit to yourself.");

      if (templateChoice === "expiry") {
        const attemptId = await createExpiryAssignment({
          storeId,
          title: `Expiry inspection — ${sku || category || location}`,
          auditorId: assignee.id,
          reviewerId: reviewerId || undefined,
          dueAt: dueAt || undefined,
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

      if (method === "digital" && dataDefinitionError) {
        throw new Error(dataDefinitionError);
      }

      const hasInputData =
        dataInputMode !== "template_only" &&
        dataInputMode !== "master_data" &&
        dataset.rows.length > 0;

      const assignmentRows =
        method === "digital" && hasInputData && !datasetError
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
        dueAt: dueAt || null,
        instructions,
        planogramVersionId,
        auditMode: method,
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
            : method === "ai"
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
      } else if (method === "digital") {
        void navigate({ to: "/digital-audit", search: { assignmentId } });
      } else {
        void navigate({ to: "/scan", search: { assignmentId } });
      }
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not create audit."),
  });

  const canNext =
    step === 1
      ? Boolean(
          operatingModel &&
            auditPurpose &&
            method &&
            (hasTemplate || templateChoice === "general"),
        )
      : step === 2
        ? Boolean(
            storeId &&
            location.trim() &&
            (method === "ai" || templateChoice === "expiry" || !dataDefinitionError),
          )
        : step === 3
          ? effectivePolicy.requiredProof.length > 0
          : Boolean(
              (assignToSelf || teamScope.assigneeIds.length > 0 || assigneeId) &&
              (locationScope.storeIds.length > 0 || storeId) &&
              (effectivePolicy.reviewMode !== "independent" || reviewerId) &&
              (assignmentMode !== "schedule_once" || publishAt) &&
              !hasBlockingConflicts(assignmentPreview?.conflicts ?? []),
            );

  return (
    <AppShell
      title="New Audit"
      description="One place to configure evidence, upload expected data and assign Digital, AI-assisted or template audits."
    >
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {steps.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => item.id <= step && setStep(item.id)}
                className={`rounded-xl border p-3 text-left ${
                  step === item.id ? "border-brand bg-brand-soft/40" : "border-border"
                }`}
              >
                <Icon className="mb-2 size-4" />
                <p className="text-xs font-semibold">
                  {item.id}. {item.label}
                </p>
              </button>
            );
          })}
        </div>

        {step === 1 ? (
          <section className="card-surface space-y-6 p-6">
            <div>
              <h2 className="font-semibold">What are you auditing?</h2>
              <p className="text-sm text-muted-foreground">
                Choose operating model, purpose, template and capture method.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Operating model</Label>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {OPERATING_MODEL_CARDS.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => {
                      setOperatingModel(card.id);
                      const purposes = getPurposesForModel(card.id);
                      setAuditPurpose(purposes[0]?.value ?? "custom");
                      setTemplateChoice("general");
                    }}
                    className={`rounded-xl border p-4 text-left transition ${
                      operatingModel === card.id
                        ? "border-brand bg-brand-soft/40"
                        : "border-border hover:border-brand/40"
                    }`}
                  >
                    <p className="font-semibold">{card.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{card.description}</p>
                  </button>
                ))}
              </div>
            </div>
            {operatingModel === "fmcg_distributor" && (
              <p className="text-xs text-muted-foreground">
                FMCG dimensions: {getFmcgDimensions(operatingModel).join(" · ")}
              </p>
            )}
            <div className="space-y-2">
              <Label>Audit purpose</Label>
              <Select
                value={auditPurpose}
                onValueChange={(v) => setAuditPurpose(v as AuditPurpose)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {purposeOptions.map((purpose) => (
                    <SelectItem key={purpose.value} value={purpose.value}>
                      {purpose.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <NewAuditTemplatePicker
              operatingModel={operatingModel}
              auditPurpose={auditPurpose}
              templateChoice={templateChoice}
              onTemplateChoice={setTemplateChoice}
              publishedTemplates={filteredPublishedTemplates}
            />
            <div className="space-y-2">
              <Label>Method</Label>
              <RadioGroup
                value={method}
                onValueChange={(v) => setMethod(v as Method)}
                className="grid gap-3 md:grid-cols-2"
              >
                <MethodCard
                  value="digital"
                  title="Digital"
                  description="Auditor records data in the app or via CSV import."
                />
                <MethodCard
                  value="ai"
                  title="AI-assisted"
                  description="Camera and AI assist the auditor; human confirmation required."
                />
              </RadioGroup>
            </div>
            <p className="text-xs text-muted-foreground">
              Context: {getOperatingModelCard(operatingModel)?.title} uses{" "}
              <strong>{terminology.location}</strong> and <strong>{terminology.subLocation}</strong>{" "}
              terminology.
            </p>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="card-surface space-y-5 p-6">
            <div
              className={`grid gap-4 ${
                method === "ai" || templateChoice === "expiry" ? "md:grid-cols-4" : "md:grid-cols-3"
              }`}
            >
              <Field label="Store">
                <Select value={storeId} onValueChange={setStoreId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent>
                    {(storesQuery.data ?? []).map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Location">
                <Input value={location} onChange={(e) => setLocation(e.target.value)} />
              </Field>
              <Field label="Category">
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Optional"
                />
              </Field>
              {method === "ai" || templateChoice === "expiry" ? (
                <Field label="Scope SKU / barcode">
                  <Input
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="Optional"
                  />
                </Field>
              ) : null}
            </div>

            {method === "digital" && templateChoice !== "expiry" ? (
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
            ) : method === "ai" ? (
              <Alert>
                <Sparkles className="size-4" />
                <AlertDescription>
                  The auditor will capture shelf photos or use the camera. Evidence requirements are
                  selected next.
                </AlertDescription>
              </Alert>
            ) : null}
            {!storeId || !location.trim() || (method === "digital" && dataDefinitionError) ? (
              <Alert>
                <AlertTriangle className="size-4" />
                <AlertDescription>
                  {!storeId
                    ? "Select a store to continue."
                    : !location.trim()
                      ? "Enter the audit location to continue."
                      : dataDefinitionError}
                </AlertDescription>
              </Alert>
            ) : null}
          </section>
        ) : null}

        {step === 3 ? (
          <section className="card-surface space-y-6 p-6">
            <div>
              <h2 className="font-semibold">Evidence and RCA controls</h2>
              <p className="text-sm text-muted-foreground">
                CSV quantities alone are not evidence. These requirements are snapshotted with the
                assignment.
              </p>
            </div>
            <RadioGroup
              value={evidenceLevel}
              onValueChange={(v) => selectEvidenceLevel(v as EvidenceLevel)}
              className="grid grid-cols-2 gap-2 md:grid-cols-4"
            >
              {(["basic", "standard", "high", "custom"] as EvidenceLevel[]).map((level) => (
                <Label
                  key={level}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border p-3 capitalize"
                >
                  <RadioGroupItem value={level} /> {level === "high" ? "High assurance" : level}
                </Label>
              ))}
            </RadioGroup>
            <div className="grid gap-2 md:grid-cols-2">
              {EVIDENCE_PROOF_OPTIONS.map((proof) => {
                const checked = effectivePolicy.requiredProof.includes(proof.value);
                return (
                  <Label
                    key={proof.value}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border p-3"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => toggleProof(proof.value, value === true)}
                    />
                    <span>
                      <span className="block text-sm font-medium">{proof.label}</span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        {proof.description}
                      </span>
                    </span>
                  </Label>
                );
              })}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Minimum photos per SKU/finding">
                <Select
                  value={String(evidencePolicy.minimumPhotos)}
                  onValueChange={(v) =>
                    setEvidencePolicy((p) => ({ ...p, minimumPhotos: Number(v) }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Capture source">
                <Select
                  value={evidencePolicy.captureSource}
                  onValueChange={(v) =>
                    setEvidencePolicy((p) => ({
                      ...p,
                      captureSource: v as AuditEvidencePolicy["captureSource"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_app_only">In-app capture only</SelectItem>
                    <SelectItem value="import_allowed">Imported files allowed</SelectItem>
                    <SelectItem value="either">Either</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Review requirement">
                <Select
                  value={evidencePolicy.reviewMode}
                  onValueChange={(v) =>
                    setEvidencePolicy((p) => ({
                      ...p,
                      reviewMode: v as AuditEvidencePolicy["reviewMode"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Manager review</SelectItem>
                    <SelectItem value="independent">Independent reviewer</SelectItem>
                    <SelectItem value="supervisor_receipt">Supervisor receipt</SelectItem>
                    <SelectItem value="none">No additional review</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Label className="flex items-start gap-3 rounded-xl border border-brand/30 bg-brand-soft/30 p-4">
              <Checkbox checked={requireRca} onCheckedChange={(v) => setRequireRca(v === true)} />
              <span>
                <span className="block text-sm font-semibold">
                  Require RCA for every non-zero variance
                </span>
                <span className="block text-xs font-normal text-muted-foreground">
                  Auditor cannot successfully submit unexplained shortage or excess quantities.
                </span>
              </span>
            </Label>
          </section>
        ) : null}

        {step === 4 ? (
          <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              <AssignmentSchedulePanel
                mode={assignmentMode}
                onModeChange={setAssignmentMode}
                publishAt={publishAt}
                onPublishAtChange={setPublishAt}
                dueConfig={dueConfig}
                onDueConfigChange={setDueConfig}
                recurrence={recurrence}
                onRecurrenceChange={setRecurrence}
              />
              <LocationScopePicker
                operatingModel={operatingModel}
                value={locationScope}
                onChange={setLocationScope}
                singleStore={locationScope.storeIds.length <= 1 && operatingModel === "local_store"}
              />
              <TeamAssignmentPanel
                members={membersQuery.data ?? []}
                teamScope={teamScope}
                distributionStrategy={distributionStrategy}
                onTeamChange={setTeamScope}
                onStrategyChange={setDistributionStrategy}
                singleAssignee={assignToSelf}
              />
              <div className="card-surface space-y-4 p-6">
                <Label className="flex items-center gap-2">
                  <Checkbox
                    checked={assignToSelf}
                    onCheckedChange={(v) => setAssignToSelf(v === true)}
                  />
                  Assign to myself and start now
                </Label>
                <Field label="Campaign name (optional)">
                  <Input
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g. September 2026 FMCG Outlet Audit — North India"
                  />
                </Field>
                <Field label="Reviewer">
                  <Select value={reviewerId} onValueChange={setReviewerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Optional reviewer" />
                    </SelectTrigger>
                    <SelectContent>
                      {(membersQuery.data ?? []).map((member) => (
                        <SelectItem key={member.user_id} value={member.user_id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Instructions">
                  <Textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                  />
                </Field>
              </div>
            </div>
            <aside className="space-y-4">
              {assignmentPreview ? (
                <AssignmentPreviewPanel preview={assignmentPreview} />
              ) : (
                <div className="card-surface p-5 text-sm text-muted-foreground">
                  Select at least one location and one auditor to preview assignments.
                </div>
              )}
              <div className="card-surface space-y-3 p-5">
                <Summary label="Method" value={method === "digital" ? "Digital" : "AI-assisted"} />
                <Summary
                  label="Template"
                  value={selectedTemplate?.name ?? systemTemplateSpec?.name ?? String(templateChoice)}
                />
                <Summary
                  label="Evidence"
                  value={`${effectivePolicy.level} · ${effectivePolicy.requiredProof.length} required proof types`}
                />
              </div>
            </aside>
          </section>
        ) : null}

        <div className="sticky bottom-3 flex items-center justify-between rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur">
          <Button variant="outline" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
          {step < 4 ? (
            <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              Continue <ArrowRight className="size-4" />
            </Button>
          ) : (
            <div className="flex gap-2">
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
                disabled={!canNext || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                <CheckCircle2 className="size-4" />
                {assignmentMode === "assign_now"
                  ? assignToSelf
                    ? "Create & start audit"
                    : "Assign Now"
                  : assignmentMode === "schedule_once"
                    ? "Schedule"
                    : "Create Recurring Schedule"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function MethodCard({
  value,
  title,
  description,
}: {
  value: Method;
  title: string;
  description: string;
}) {
  return (
    <Label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4">
      <RadioGroupItem value={value} />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm font-normal text-muted-foreground">{description}</span>
      </span>
    </Label>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium capitalize">{value}</span>
    </div>
  );
}
