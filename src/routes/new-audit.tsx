import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  ShieldCheck,
  Sparkles,
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
import {
  createAssignmentPlanogramVersion,
  parsePlanogramCsv,
  type DraftRow,
  type PlanogramRow,
} from "@/lib/planogram";
import { requireUserId } from "@/lib/db/context";
import { startAssignment } from "@/lib/assignments";
import { createAssignment as createExpiryAssignment } from "@/lib/expiry-control";

export const Route = createFileRoute("/new-audit")({
  head: () => ({ meta: [{ title: "New Audit — Aislix" }] }),
  component: NewAuditPage,
});

type Method = "digital" | "ai";
type TemplateChoice = "general" | "fnv" | "expiry" | "planogram" | string;

const steps = [
  { id: 1, label: "Method & template", icon: Sparkles },
  { id: 2, label: "Scope & input", icon: FileSpreadsheet },
  { id: 3, label: "Evidence & RCA", icon: ShieldCheck },
  { id: 4, label: "Assign & review", icon: Users },
];

function NewAuditPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState<Method>("digital");
  const [templateChoice, setTemplateChoice] = useState<TemplateChoice>("general");
  const [storeId, setStoreId] = useState("");
  const [location, setLocation] = useState("Main shelf");
  const [category, setCategory] = useState("");
  const [sku, setSku] = useState("");
  const [productName, setProductName] = useState("");
  const [expectedQuantity, setExpectedQuantity] = useState("0");
  const [csvName, setCsvName] = useState<string | null>(null);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
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

  const selectedTemplate =
    templateChoice === "fnv"
      ? templatesQuery.data?.find(
          (t) => t.template_type === "fnv_qc_audit" || t.name.toLowerCase().includes("fnv"),
        )
      : templateChoice === "planogram"
        ? templatesQuery.data?.find((t) => t.name.toLowerCase().includes("planogram"))
        : templatesQuery.data?.find((t) => t.id === templateChoice);
  const effectivePolicy = useMemo(
    () =>
      mergeTemplateMinimum(
        evidencePolicy,
        selectedTemplate?.evidence_config
          ? {
              requiredProof: selectedTemplate.evidence_required
                ? ["context_photo" as EvidenceProof]
                : [],
            }
          : null,
      ),
    [evidencePolicy, selectedTemplate],
  );

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
    setCsvName(file.name);
    const result = await parsePlanogramCsv(file);
    setCsvErrors([...result.errors, ...result.rows.flatMap((r) => r.errors ?? [])]);
    const validRows = result.rows
      .filter((r) => r.valid && r.data)
      .map((r, index) => {
        const data = r.data as Partial<PlanogramRow>;
        return {
          key: crypto.randomUUID(),
          location: data.location ?? location,
          category: data.category ?? category,
          sub_category: data.sub_category ?? "",
          brand: data.brand ?? "",
          product_name: data.product_name ?? `Product ${index + 1}`,
          variant: data.variant ?? "",
          expected_qty: Number(data.expected_qty ?? data.expected_facings ?? 0),
          expected_facings: data.expected_facings,
          expected_shelf_units: data.expected_shelf_units,
          expected_shelf_level: data.expected_shelf_level,
          expected_position: data.expected_position,
          min_facings: data.min_facings,
          max_facings: data.max_facings,
          mrp_inr: data.mrp_inr,
          avg_daily_sales: data.avg_daily_sales,
          sku: data.sku ?? "",
          shelf_position: data.shelf_position ?? "",
          match_key: data.match_key ?? "",
        } satisfies DraftRow;
      });
    setRows(validRows);
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

      const assignmentRows =
        rows.length || method !== "digital" || selectedTemplate
          ? rows
          : [
              {
                key: crypto.randomUUID(),
                location,
                category,
                sub_category: "",
                brand: "",
                product_name: productName,
                variant: "",
                expected_qty: Number(expectedQuantity),
                sku,
                shelf_position: "",
                match_key: "",
              } satisfies DraftRow,
            ];

      let planogramVersionId: string | null = null;
      if (assignmentRows.length) {
        planogramVersionId = await createAssignmentPlanogramVersion({
          storeId,
          rows: assignmentRows,
          sourceType: csvName ? "csv" : "manual",
          sourceFilename: csvName,
        });
      }

      const assignmentId = await createScanAssignment({
        storeId,
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
        templateId: selectedTemplate?.id ?? null,
        templateVersion: selectedTemplate?.version ?? null,
        templateSnapshot: selectedTemplate
          ? (selectedTemplate as unknown as Record<string, unknown>)
          : {
              predefined_type: templateChoice,
              evidence_policy: effectivePolicy,
            },
        reviewerId: reviewerId || null,
        evidencePolicy: effectivePolicy,
        requireRca,
        creationSource: "unified_new_audit",
        inputSource: assignmentRows.length
          ? csvName
            ? "csv_upload"
            : "manual_rows"
          : selectedTemplate
            ? "template"
            : method === "ai"
              ? "camera"
              : "manual_rows",
      });

      if (assignToSelf) await startAssignment(assignmentId);
      return { assignmentId, self: assignToSelf, expiry: false };
    },
    onSuccess: ({ assignmentId, self, expiry }) => {
      toast.success(self ? "Audit created and started." : "Audit assigned successfully.");
      if (expiry && self) {
        void navigate({
          to: "/expiry-control/inspect/$attemptId",
          params: { attemptId: assignmentId },
        });
        return;
      }
      if (!self) {
        void navigate({ to: "/audits", search: { tab: "reviews" } });
      } else if (selectedTemplate) {
        void navigate({
          to: "/custom-audit",
          search: { assignmentId, test: false },
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
      ? Boolean(method && templateChoice)
      : step === 2
        ? Boolean(
            storeId &&
            location &&
            (method === "ai" ||
              rows.length > 0 ||
              selectedTemplate ||
              templateChoice === "expiry" ||
              (sku.trim() && productName.trim() && Number(expectedQuantity) >= 0)),
          )
        : step === 3
          ? effectivePolicy.requiredProof.length > 0
          : Boolean(
              (assignToSelf || assigneeId) &&
              (effectivePolicy.reviewMode !== "independent" || reviewerId),
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
              <h2 className="font-semibold">Choose audit method</h2>
              <p className="text-sm text-muted-foreground">
                The evidence policy applies to both methods.
              </p>
            </div>
            <RadioGroup
              value={method}
              onValueChange={(v) => setMethod(v as Method)}
              className="grid gap-3 md:grid-cols-2"
            >
              <MethodCard
                value="digital"
                title="Digital / Manual"
                description="Auditor records actual SKU quantities manually or imports CSV."
              />
              <MethodCard
                value="ai"
                title="AI-assisted"
                description="Shelf photos and camera analysis assist the auditor; human review remains visible."
              />
            </RadioGroup>
            <div className="space-y-2">
              <Label>Audit template</Label>
              <Select value={templateChoice} onValueChange={setTemplateChoice}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General audit — no template</SelectItem>
                  <SelectItem value="fnv">Predefined — FNV quality control</SelectItem>
                  <SelectItem value="expiry">Predefined — Expiry control</SelectItem>
                  <SelectItem value="planogram">Predefined — Planogram compliance</SelectItem>
                  {(templatesQuery.data ?? []).map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      Custom — {template.name} v{template.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="card-surface space-y-5 p-6">
            <div className="grid gap-4 md:grid-cols-4">
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
              <Field label="SKU / barcode">
                <Input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Optional"
                />
              </Field>
            </div>

            {method === "digital" ? (
              <div className="rounded-xl border border-dashed p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Expected SKU list</p>
                    <p className="text-sm text-muted-foreground">
                      Upload CSV now; the auditor receives this list and records actual quantities.
                    </p>
                  </div>
                  <Button variant="outline" asChild>
                    <label>
                      <Upload className="size-4" /> Upload CSV
                      <input
                        className="hidden"
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void parseCsv(file);
                        }}
                      />
                    </label>
                  </Button>
                </div>
                {csvName ? (
                  <p className="mt-3 text-sm">
                    <strong>{csvName}</strong> · {rows.length} valid SKU rows
                  </p>
                ) : null}
                {csvErrors.length ? (
                  <Alert variant="destructive" className="mt-3">
                    <AlertDescription>{csvErrors.slice(0, 3).join(" · ")}</AlertDescription>
                  </Alert>
                ) : null}
                {rows.length ? (
                  <div className="mt-3 max-h-52 overflow-auto rounded-lg border">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-muted">
                        <tr>
                          <th className="p-2">SKU</th>
                          <th>Product</th>
                          <th>Expected</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 20).map((row) => (
                          <tr key={row.key} className="border-t">
                            <td className="p-2">{row.sku || "—"}</td>
                            <td>{row.product_name}</td>
                            <td>{row.expected_qty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {!rows.length ? (
                  <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-3">
                    <Field label="Or add one product manually">
                      <Input
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        placeholder="Product name"
                      />
                    </Field>
                    <Field label="SKU">
                      <Input
                        value={sku}
                        onChange={(e) => setSku(e.target.value)}
                        placeholder="SKU code"
                      />
                    </Field>
                    <Field label="Expected quantity">
                      <Input
                        type="number"
                        min={0}
                        value={expectedQuantity}
                        onChange={(e) => setExpectedQuantity(e.target.value)}
                      />
                    </Field>
                  </div>
                ) : null}
              </div>
            ) : (
              <Alert>
                <Sparkles className="size-4" />
                <AlertDescription>
                  The auditor will capture shelf photos or use the camera. Evidence requirements are
                  selected next.
                </AlertDescription>
              </Alert>
            )}
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
            <div className="card-surface space-y-4 p-6">
              <Field label="Auditor">
                <Select
                  value={assigneeId}
                  onValueChange={(value) => {
                    setAssigneeId(value);
                    if (reviewerId === value) setReviewerId("");
                  }}
                  disabled={assignToSelf}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select auditor" />
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
              <Label className="flex items-center gap-2">
                <Checkbox
                  checked={assignToSelf}
                  onCheckedChange={(v) => setAssignToSelf(v === true)}
                />
                Assign to myself and start now
              </Label>
              <Field label="Reviewer">
                <Select value={reviewerId} onValueChange={setReviewerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional reviewer" />
                  </SelectTrigger>
                  <SelectContent>
                    {(membersQuery.data ?? []).map((member) => (
                      <SelectItem
                        key={member.user_id}
                        value={member.user_id}
                        disabled={!assignToSelf && member.user_id === assigneeId}
                      >
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Due date and time">
                <Input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                />
              </Field>
              <Field label="Instructions">
                <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} />
              </Field>
            </div>
            <aside className="card-surface space-y-3 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Assignment preview
              </p>
              <Summary
                label="Method"
                value={method === "digital" ? "Digital / Manual" : "AI-assisted"}
              />
              <Summary label="Template" value={selectedTemplate?.name ?? String(templateChoice)} />
              <Summary
                label="Store"
                value={storesQuery.data?.find((s) => s.id === storeId)?.name ?? "Not selected"}
              />
              <Summary
                label="Input"
                value={
                  rows.length
                    ? `${rows.length} CSV SKU rows`
                    : method === "ai"
                      ? "Camera / photos"
                      : "Manual"
                }
              />
              <Summary
                label="Evidence"
                value={`${effectivePolicy.level} · ${effectivePolicy.requiredProof.length} required proof types`}
              />
              <Summary label="RCA" value={requireRca ? "Mandatory for variance" : "Optional"} />
              <div className="flex flex-wrap gap-1">
                {effectivePolicy.requiredProof.map((proof) => (
                  <Badge key={proof} variant="secondary">
                    {proof.replaceAll("_", " ")}
                  </Badge>
                ))}
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
            <Button
              variant="brand"
              disabled={!canNext || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              <CheckCircle2 className="size-4" />
              {assignToSelf ? "Create & start audit" : "Assign audit"}
            </Button>
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
