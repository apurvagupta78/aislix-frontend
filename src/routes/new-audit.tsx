import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Columns3,
  FileSpreadsheet,
  Rows3,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
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
import { Badge } from "@/components/ui/badge";
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
  AUDIT_DATA_TYPES,
  createAuditColumn,
  createAuditRow,
  createManualAuditDataset,
  datasetToDraftRows,
  parseAuditCsv,
  validateAuditDataset,
  type AuditDataType,
  type AuditInputDataset,
} from "@/lib/audit-input-dataset";
import type { AuditPurpose, AuditSubjectType, OperatingModel } from "@/lib/audit-builder/types";
import { ColumnConfigurationPanel } from "@/components/audit-builder/ColumnConfigurationPanel";
import type { InputSchema } from "@/lib/audit-builder/field-roles";
import { buildDefaultColumnMappings, buildInputSchema } from "@/lib/audit-builder/input-schema";
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
  { id: 2, label: "Scope", icon: FileSpreadsheet },
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

  async function parseCsv(file: File) {
    try {
      const parsed = parseAuditCsv(await file.text(), file.name);
      const schema = buildInputSchema(parsed);
      setDataset({ ...parsed, inputSchema: schema });
      setInputSchema(schema);
      setInputError(null);
    } catch (error) {
      setInputError(error instanceof Error ? error.message : "Could not read this CSV.");
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

      if (method === "digital" && !templateForAssignment && datasetError) {
        throw new Error(datasetError);
      }

      const assignmentRows =
        method === "digital" && !datasetError
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

      const templateSnapshot = {
        ...(templateForAssignment
          ? (templateForAssignment as unknown as Record<string, unknown>)
          : {
              predefined_type: templateChoice,
              evidence_policy: effectivePolicy,
            }),
        ...(assignmentRows.length || inputSchema.columnMappings.length
          ? {
              input_dataset: {
                source: dataset.source,
                filename: dataset.filename,
                columns: dataset.columns,
                rows: dataset.rows,
                inputSchema,
              },
              purpose_config: {
                ...(templateForAssignment?.purpose_config ?? {}),
                inputSchema,
                input_dataset: {
                  source: dataset.source,
                  filename: dataset.filename,
                  columns: dataset.columns,
                  rows: dataset.rows,
                  inputSchema,
                },
              },
            }
          : {}),
      };

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
        inputSource: assignmentRows.length
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

  const hasTemplate =
    templateChoice !== "general" &&
    (templateChoice.startsWith("system:") || Boolean(selectedTemplate));

  const canNext =
    step === 1
      ? Boolean(operatingModel && auditPurpose && method && hasTemplate)
      : step === 2
        ? Boolean(
            storeId &&
            location &&
            (method === "ai" ||
              !datasetError ||
              selectedTemplate ||
              systemTemplateKey ||
              templateChoice === "expiry"),
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

            {method === "digital" ? (
              <DatasetEditor
                dataset={dataset}
                inputSchema={inputSchema}
                error={inputError}
                onChange={(next) => {
                  updateDataset(next);
                  setInputError(null);
                }}
                onInputSchemaChange={setInputSchema}
                onUpload={parseCsv}
              />
            ) : (
              <Alert>
                <Sparkles className="size-4" />
                <AlertDescription>
                  The auditor will capture shelf photos or use the camera. Evidence requirements are
                  selected next.
                </AlertDescription>
              </Alert>
            )}
            {!storeId ||
            !location.trim() ||
            (method === "digital" &&
              !selectedTemplate &&
              templateChoice !== "expiry" &&
              datasetError) ? (
              <Alert>
                <AlertTriangle className="size-4" />
                <AlertDescription>
                  {!storeId
                    ? "Select a store to continue."
                    : !location.trim()
                      ? "Enter the audit location to continue."
                      : datasetError}
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

function DatasetEditor({
  dataset,
  inputSchema,
  error,
  onChange,
  onInputSchemaChange,
  onUpload,
}: {
  dataset: AuditInputDataset;
  inputSchema: InputSchema;
  error: string | null;
  onChange: (dataset: AuditInputDataset) => void;
  onInputSchemaChange: (schema: InputSchema) => void;
  onUpload: (file: File) => Promise<void>;
}) {
  const updateColumn = (
    columnId: string,
    patch: Partial<{ name: string; type: AuditDataType }>,
  ) => {
    onChange({
      ...dataset,
      columns: dataset.columns.map((column) =>
        column.id === columnId ? { ...column, ...patch } : column,
      ),
    });
  };

  const removeColumn = (columnId: string) => {
    if (dataset.columns.length === 1) return;
    onChange({
      ...dataset,
      columns: dataset.columns.filter((column) => column.id !== columnId),
      rows: dataset.rows.map((row) => {
        const values = { ...row.values };
        delete values[columnId];
        return { ...row, values };
      }),
    });
  };

  const addColumn = () => {
    if (dataset.source !== "manual" || dataset.columns.length >= 10) return;
    const column = createAuditColumn(dataset.columns.length + 1);
    onChange({
      ...dataset,
      columns: [...dataset.columns, column],
      rows: dataset.rows.map((row) => ({
        ...row,
        values: { ...row.values, [column.id]: "" },
      })),
    });
  };

  const updateCell = (rowId: string, columnId: string, value: string) => {
    onChange({
      ...dataset,
      rows: dataset.rows.map((row) =>
        row.id === rowId ? { ...row, values: { ...row.values, [columnId]: value } } : row,
      ),
    });
  };

  return (
    <div className="rounded-xl border border-dashed p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">Audit input data</p>
          <p className="text-sm text-muted-foreground">
            Upload any CSV or define your own columns and data types.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="secondary">{dataset.columns.length} columns</Badge>
            <Badge variant="secondary">{dataset.rows.length} rows</Badge>
            <Badge variant="outline">{dataset.source === "csv" ? "CSV upload" : "Manual"}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {dataset.source === "csv" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onChange(createManualAuditDataset())}
            >
              Clear & enter manually
            </Button>
          ) : null}
          <Button variant="outline" asChild>
            <label>
              <Upload className="size-4" />{" "}
              {dataset.source === "csv" ? "Replace CSV" : "Upload CSV"}
              <input
                className="hidden"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void onUpload(file);
                  event.target.value = "";
                }}
              />
            </label>
          </Button>
        </div>
      </div>

      {dataset.filename ? (
        <p className="mt-3 text-sm">
          <strong>{dataset.filename}</strong> · all {dataset.columns.length} headings and{" "}
          {dataset.rows.length} data rows captured
        </p>
      ) : null}
      {error ? (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-4 max-h-[420px] overflow-auto rounded-xl border">
        <table
          className="text-left text-xs"
          style={{ minWidth: Math.max(640, dataset.columns.length * 220 + 64) }}
        >
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              <th className="w-14 border-r p-2 text-center">#</th>
              {dataset.columns.map((column, index) => (
                <th key={column.id} className="min-w-[220px] border-r p-2 align-top">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Input
                        value={column.name}
                        onChange={(event) => updateColumn(column.id, { name: event.target.value })}
                        placeholder={`Column ${index + 1} name`}
                        aria-label={`Column ${index + 1} name`}
                        className="h-8 bg-background"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8 shrink-0"
                        disabled={dataset.columns.length === 1}
                        aria-label={`Remove ${column.name || `column ${index + 1}`}`}
                        onClick={() => removeColumn(column.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    <Select
                      value={column.type}
                      onValueChange={(value) =>
                        updateColumn(column.id, { type: value as AuditDataType })
                      }
                    >
                      <SelectTrigger className="h-8 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AUDIT_DATA_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataset.rows.map((row, rowIndex) => (
              <tr key={row.id} className="border-t">
                <td className="border-r p-2 text-center align-middle">
                  <div className="flex flex-col items-center gap-1">
                    <span>{rowIndex + 1}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      disabled={dataset.rows.length === 1}
                      aria-label={`Remove row ${rowIndex + 1}`}
                      onClick={() =>
                        onChange({
                          ...dataset,
                          rows: dataset.rows.filter((item) => item.id !== row.id),
                        })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </td>
                {dataset.columns.map((column) => (
                  <td key={column.id} className="border-r p-2">
                    <DatasetCell
                      columnType={column.type}
                      value={row.values[column.id] ?? ""}
                      label={`${column.name || "Column"} row ${rowIndex + 1}`}
                      onChange={(value) => updateCell(row.id, column.id, value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {dataset.source === "manual" ? (
          <Button
            type="button"
            variant="outline"
            disabled={dataset.columns.length >= 10}
            onClick={addColumn}
          >
            <Columns3 className="size-4" /> Add column ({dataset.columns.length}/10)
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange({ ...dataset, rows: [...dataset.rows, createAuditRow(dataset.columns)] })
          }
        >
          <Rows3 className="size-4" /> Add row
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        CSV uploads retain every heading and cell. Column names and inferred data types can be
        corrected before assignment.
      </p>

      {dataset.columns.length > 0 ? (
        <div className="mt-6">
          <ColumnConfigurationPanel
            columnMappings={inputSchema.columnMappings}
            subjectType={inputSchema.subjectType}
            onChange={(mappings) =>
              onInputSchemaChange({ ...inputSchema, columnMappings: mappings })
            }
            onSubjectTypeChange={(subjectType: AuditSubjectType) =>
              onInputSchemaChange({ ...inputSchema, subjectType })
            }
          />
        </div>
      ) : null}
    </div>
  );
}

function DatasetCell({
  columnType,
  value,
  label,
  onChange,
}: {
  columnType: AuditDataType;
  value: string;
  label: string;
  onChange: (value: string) => void;
}) {
  if (columnType === "boolean") {
    return (
      <Select
        value={value || "__empty"}
        onValueChange={(next) => onChange(next === "__empty" ? "" : next)}
      >
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__empty">Not set</SelectItem>
          <SelectItem value="true">True</SelectItem>
          <SelectItem value="false">False</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  const inputType =
    columnType === "date"
      ? "date"
      : columnType === "datetime"
        ? "datetime-local"
        : columnType === "integer" || columnType === "number"
          ? "number"
          : "text";

  return (
    <Input
      type={inputType}
      step={columnType === "integer" ? 1 : columnType === "number" ? "any" : undefined}
      value={value}
      aria-label={label}
      onChange={(event) => onChange(event.target.value)}
    />
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
