import { useMemo, useState, type ReactNode } from "react";
import { Link, Outlet, createFileRoute, useChildMatches, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  Copy,
  FileStack,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  SearchX,
  Share2,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { EmptyState, FilterSearch, PageHeader, PreviewDrawer } from "@/components/design-system";
import { TablePager, usePager } from "@/components/design-system/TablePager";
import { DuplicateTemplateDialog } from "@/components/audit-builder/DuplicateTemplateDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import type { AuditPurpose, OperatingModel, TemplateDefinition } from "@/lib/audit-builder/types";
import { templateHasSavedCsvConfig } from "@/lib/audit-builder/load-saved-template-audit";
import {
  canEditAuditTemplate,
  createBlankAuditTemplate,
  deleteOrArchiveAuditTemplate,
  duplicateAuditTemplate,
  fetchAuditTemplates,
  fetchTemplateUsageCounts,
  isCustomBuilderTemplate,
  shareAuditTemplateWithOrganization,
  templateToDefinition,
  updateAuditTemplate,
  type AuditTemplate,
  type TemplateStatus,
} from "@/lib/audit-templates";
import { requireUserId } from "@/lib/db/context";
import { isOrgManager } from "@/lib/assignments";
import { OPERATING_MODEL_CARDS } from "@/lib/audit-engine/operating-model-catalog";
import { ensureSystemTemplate } from "@/lib/audit-engine/seed-templates";
import { PURPOSE_SECTION_LABELS, purposeOptionsForFilter } from "@/lib/audit-engine/template-catalog-ui";
import { STARTER_TEMPLATE_LIBRARY, type SystemTemplateSpec } from "@/lib/audit-engine/template-factory";
import { formatScanDate } from "@/lib/scan-history";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/audit-templates")({
  head: () => ({ meta: [{ title: "Audit templates — Aislix" }] }),
  component: AuditTemplatesRoute,
});

/** The builder, preview and new-template pages are child routes and render in place of the list. */
function AuditTemplatesRoute() {
  const childMatches = useChildMatches();
  return childMatches.length ? <Outlet /> : <AuditTemplatesPage />;
}

/* ---------------------------------- rows ---------------------------------- */

type LibraryTab = "aislix" | "mine" | "team";

type TemplateRow = {
  id: string;
  kind: "aislix" | "custom";
  name: string;
  description: string;
  model: OperatingModel | null;
  purpose: AuditPurpose | null;
  modelLabel: string;
  purposeLabel: string;
  fieldCount: number;
  sectionCount: number;
  ai: boolean;
  evidence: boolean;
  recommended: boolean;
  definition: TemplateDefinition;
  spec?: SystemTemplateSpec;
  template?: AuditTemplate;
};

function modelLabel(model: OperatingModel | null): string {
  if (!model) return "Any store";
  return OPERATING_MODEL_CARDS.find((c) => c.id === model)?.title ?? model;
}

function purposeLabel(purpose: AuditPurpose | null, fallback?: string | null): string {
  if (!purpose) return fallback?.trim() || "General";
  return PURPOSE_SECTION_LABELS[purpose] ?? purpose.replace(/_/g, " ");
}

function specRow(spec: SystemTemplateSpec): TemplateRow {
  const definition = spec.build();
  return {
    id: spec.key,
    kind: "aislix",
    name: spec.name,
    description: spec.shortDescription,
    model: spec.operatingModel,
    purpose: spec.purpose,
    modelLabel: modelLabel(spec.operatingModel),
    purposeLabel: purposeLabel(spec.purpose, spec.category),
    fieldCount: definition.fields.length,
    sectionCount: definition.sections.length,
    ai: Boolean(definition.ai?.enabled),
    evidence: Boolean(definition.evidence?.photoRequired),
    recommended: Boolean(spec.recommended || spec.flagship),
    definition,
    spec,
  };
}

function customRow(template: AuditTemplate): TemplateRow {
  const definition = templateToDefinition(template);
  return {
    id: template.id,
    kind: "custom",
    name: template.name,
    description: template.short_description || template.description || "",
    model: template.operating_model,
    purpose: template.audit_purpose,
    modelLabel: modelLabel(template.operating_model),
    purposeLabel: purposeLabel(template.audit_purpose, template.category),
    fieldCount: template.field_definitions.length,
    sectionCount: template.sections.length,
    ai: Boolean(template.ai_config?.enabled),
    evidence: template.evidence_required || Boolean(template.evidence_config?.photoRequired),
    recommended: false,
    definition,
    template,
  };
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function contentsLabel(row: TemplateRow): string {
  return `${plural(row.fieldCount, "field")} · ${plural(row.sectionCount, "section")}`;
}

function capabilityLabel(row: TemplateRow): string {
  return [row.ai ? "AI assisted" : "Digital", row.evidence ? "photo evidence" : null].filter(Boolean).join(" · ");
}

const STATUS_LABEL: Record<TemplateStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

const STATUS_DOT: Record<TemplateStatus, string> = {
  draft: "bg-[#D9E2E8]",
  published: "bg-[#79E2A8]",
  archived: "bg-[#D9E2E8]",
};

function StatusPill({ status }: { status: TemplateStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#D9E2E8] bg-white px-2 py-0.5 text-xs font-medium text-[#04203F]">
      <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

/* --------------------------------- filters -------------------------------- */

type Filters = {
  q: string;
  model: OperatingModel | "all";
  purpose: AuditPurpose | "all";
  status: TemplateStatus | "active";
  ai: boolean;
  evidence: boolean;
};

const EMPTY_FILTERS: Filters = { q: "", model: "all", purpose: "all", status: "active", ai: false, evidence: false };

function activeFilterCount(filters: Filters): number {
  return [filters.model !== "all", filters.purpose !== "all", filters.status !== "active", filters.ai, filters.evidence].filter(
    Boolean,
  ).length;
}

function matchesFilters(row: TemplateRow, filters: Filters): boolean {
  if (filters.model !== "all" && row.model !== filters.model) return false;
  if (filters.purpose !== "all" && row.purpose !== filters.purpose) return false;
  if (filters.ai && !row.ai) return false;
  if (filters.evidence && !row.evidence) return false;
  if (row.template) {
    if (filters.status === "active" ? row.template.status === "archived" : row.template.status !== filters.status) {
      return false;
    }
  }
  const q = filters.q.trim().toLowerCase();
  if (q && ![row.name, row.description, row.modelLabel, row.purposeLabel].join(" ").toLowerCase().includes(q)) {
    return false;
  }
  return true;
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs text-[#667085]">
      {label}
      {children}
    </label>
  );
}

/* ------------------------------ preview drawer ---------------------------- */

function TemplatePreview({
  row,
  editable,
  onClose,
  onUse,
  using,
}: {
  row: TemplateRow | null;
  editable: boolean;
  onClose: () => void;
  onUse: (row: TemplateRow) => void;
  using: boolean;
}) {
  const sections = row
    ? [...row.definition.sections]
        .sort((a, b) => a.order - b.order)
        .map((section) => ({
          ...section,
          fields: row.definition.fields.filter((f) => f.section === section.key),
        }))
    : [];
  const details: [string, ReactNode][] = row
    ? [
        ["Source", row.kind === "aislix" ? "Aislix library" : row.template?.visibility === "organization" ? "Shared with team" : "Only you"],
        ...(row.template ? ([["Status", <StatusPill key="s" status={row.template.status} />]] as [string, ReactNode][]) : []),
        ["Store type", row.modelLabel],
        ["Purpose", row.purposeLabel],
        ["Contents", contentsLabel(row)],
        ["Capture", capabilityLabel(row)],
      ]
    : [];

  return (
    <PreviewDrawer
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={row?.name ?? ""}
      description={row?.description || undefined}
    >
      {row ? (
        <div className="space-y-5">
          <dl className="divide-y divide-[#D9E2E8] rounded-xl border border-[#D9E2E8]">
            {details.map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4 px-3 py-2 text-sm">
                <dt className="text-[#667085]">{label}</dt>
                <dd className="text-right font-medium text-[#04203F]">{value}</dd>
              </div>
            ))}
          </dl>

          <div>
            <p className="text-xs text-[#667085]">What the auditor fills in</p>
            <ul className="mt-2 space-y-2">
              {sections.map((section) => (
                <li key={section.key} className="rounded-lg border border-[#D9E2E8] px-3 py-2">
                  <p className="text-sm font-medium text-[#04203F]">
                    {section.title}
                    <span className="ml-1.5 text-xs font-normal text-[#667085]">
                      {plural(section.fields.length, "field")}
                      {section.repeatable ? " · repeats per item" : ""}
                    </span>
                  </p>
                  {section.fields.length ? (
                    <p className="mt-1 text-xs leading-5 text-[#667085]">
                      {section.fields
                        .slice(0, 8)
                        .map((f) => f.label)
                        .join(", ")}
                      {section.fields.length > 8 ? `, +${section.fields.length - 8} more` : ""}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <Button variant="brand" className="w-full rounded-lg" disabled={using} onClick={() => onUse(row)}>
              {using ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Use template
            </Button>
            {row.template ? (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="rounded-lg" asChild>
                  <Link to="/audit-templates/$templateId/preview" params={{ templateId: row.template.id }}>
                    Auditor view
                  </Link>
                </Button>
                {editable ? (
                  <Button variant="outline" className="rounded-lg" asChild>
                    <Link to="/audit-templates/$templateId" params={{ templateId: row.template.id }}>
                      <Pencil className="mr-1.5 size-3.5" /> Edit
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </PreviewDrawer>
  );
}

/* --------------------------------- dialogs -------------------------------- */

function TemplateDetailsDialog({
  open,
  title,
  description,
  initialName,
  initialDescription,
  submitLabel,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description: string;
  initialName: string;
  initialDescription: string;
  submitLabel: string;
  pending: boolean;
  onClose: () => void;
  onSubmit: (value: { name: string; description: string }) => void;
}) {
  const [name, setName] = useState(initialName);
  const [details, setDetails] = useState(initialDescription);
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="rounded-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="flex flex-col gap-1.5 text-xs text-[#667085]">
            Template name
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10 rounded-lg" autoFocus />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-[#667085]">
            Short description (optional)
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              className="rounded-lg"
              placeholder="What is this audit for?"
            />
          </label>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" className="rounded-lg" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="brand"
            className="rounded-lg"
            disabled={!name.trim() || pending}
            onClick={() => onSubmit({ name: name.trim(), description: details.trim() })}
          >
            {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------- page ---------------------------------- */

const TABS: { id: LibraryTab; label: string; hint: string }[] = [
  { id: "aislix", label: "Aislix library", hint: "Ready-made templates you can use as they are, or duplicate and customise." },
  { id: "mine", label: "My templates", hint: "Templates you created. Only you can edit or delete them." },
  { id: "team", label: "Shared with team", hint: "Templates your teammates created and shared with the workspace." },
];

function AuditTemplatesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [tab, setTab] = useState<LibraryTab>("aislix");
  const [filters, setFiltersState] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [previewing, setPreviewing] = useState<TemplateRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingDetails, setEditingDetails] = useState<AuditTemplate | null>(null);
  const [duplicating, setDuplicating] = useState<TemplateRow | null>(null);
  const [deleting, setDeleting] = useState<AuditTemplate | null>(null);
  const [usingId, setUsingId] = useState<string | null>(null);

  const managerQuery = useQuery({ queryKey: ["is-org-manager"], queryFn: () => isOrgManager() });
  const currentUserQuery = useQuery({
    queryKey: ["current-user-id"],
    queryFn: requireUserId,
    enabled: managerQuery.data === true,
  });
  const templatesQuery = useQuery({
    queryKey: ["audit-templates", "library"],
    queryFn: () => fetchAuditTemplates({ status: "all" }),
    enabled: managerQuery.data === true,
  });
  const userId = currentUserQuery.data ?? null;

  const aislixRows = useMemo(() => {
    const rows = STARTER_TEMPLATE_LIBRARY.map(specRow);
    return [...rows.filter((r) => r.recommended), ...rows.filter((r) => !r.recommended)];
  }, []);
  const customTemplates = useMemo(
    () => (templatesQuery.data ?? []).filter((t) => !t.is_system_template),
    [templatesQuery.data],
  );
  const mineRows = useMemo(
    () => customTemplates.filter((t) => userId && t.owner_user_id === userId).map(customRow),
    [customTemplates, userId],
  );
  const teamRows = useMemo(
    () =>
      customTemplates
        .filter((t) => t.visibility === "organization" && !(userId && t.owner_user_id === userId))
        .map(customRow),
    [customTemplates, userId],
  );

  const tabRows = tab === "aislix" ? aislixRows : tab === "mine" ? mineRows : teamRows;
  const visible = useMemo(() => tabRows.filter((row) => matchesFilters(row, filters)), [tabRows, filters]);
  const tabCount = (id: LibraryTab) =>
    (id === "aislix" ? aislixRows : id === "mine" ? mineRows : teamRows).filter((r) => matchesFilters(r, EMPTY_FILTERS))
      .length;

  const usageQuery = useQuery({
    queryKey: ["template-usage", customTemplates.map((t) => t.id).join(",")],
    queryFn: () => fetchTemplateUsageCounts(customTemplates.map((t) => t.id)),
    enabled: customTemplates.length > 0,
  });

  const pager = usePager(visible.length);
  const pageRows = visible.slice(pager.start, pager.end);
  const purposeOptions = useMemo(() => purposeOptionsForFilter(filters.model), [filters.model]);
  const activeCount = activeFilterCount(filters);
  const narrowed = activeCount > 0 || Boolean(filters.q.trim());

  const setFilters = (patch: Partial<Filters>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
    pager.setPage(0);
  };
  const clearFilters = () => {
    setFiltersState(EMPTY_FILTERS);
    pager.setPage(0);
  };
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["audit-templates"] });

  const useTemplateMutation = useMutation({
    mutationFn: async (row: TemplateRow) => {
      if (row.template) return row.template.id;
      const template = await ensureSystemTemplate(row.spec!.key);
      if (!template) throw new Error("Could not prepare this template. Please try again.");
      return template.id;
    },
    onMutate: (row) => setUsingId(row.id),
    onSuccess: (templateId) => {
      invalidate();
      void navigate({
        to: "/new-audit",
        search: { templateId, systemKey: undefined, assign: false, dueDate: undefined, dueTime: undefined },
      });
    },
    onError: (e) => toast.error(toUserMessage(e)),
    onSettled: () => setUsingId(null),
  });

  const createMutation = useMutation({
    mutationFn: (value: { name: string; description: string }) => createBlankAuditTemplate(value),
    onSuccess: (template) => {
      setCreating(false);
      invalidate();
      void navigate({ to: "/audit-templates/$templateId", params: { templateId: template.id } });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const detailsMutation = useMutation({
    mutationFn: ({ id, name, description }: { id: string; name: string; description: string }) =>
      updateAuditTemplate(id, { name, description, short_description: description }),
    onSuccess: () => {
      toast.success("Template updated");
      setEditingDetails(null);
      invalidate();
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const duplicateMutation = useMutation({
    mutationFn: async ({ row, name }: { row: TemplateRow; name: string }) => {
      const sourceId = row.template?.id ?? (await ensureSystemTemplate(row.spec!.key))?.id;
      if (!sourceId) throw new Error("Could not prepare this template. Please try again.");
      const copy = await duplicateAuditTemplate(sourceId);
      await updateAuditTemplate(copy.id, { name, is_system_template: false });
      return copy;
    },
    onSuccess: (copy) => {
      toast.success("Copy saved to My templates");
      setDuplicating(null);
      invalidate();
      void navigate({ to: "/audit-templates/$templateId", params: { templateId: copy.id } });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const shareMutation = useMutation({
    mutationFn: shareAuditTemplateWithOrganization,
    onSuccess: () => {
      toast.success("Shared with your team");
      invalidate();
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteOrArchiveAuditTemplate(id),
    onSuccess: (outcome) => {
      toast.success(
        outcome === "deleted"
          ? "Template deleted"
          : "Template archived — past audits use it, so their reports keep working",
      );
      setDeleting(null);
      invalidate();
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const isEditable = (row: TemplateRow) => Boolean(row.template && canEditAuditTemplate(row.template, userId));
  const usesBuilder = (t: AuditTemplate) => isCustomBuilderTemplate(t) && !templateHasSavedCsvConfig(t);

  const rowMenu = (row: TemplateRow) => {
    const t = row.template;
    const editable = isEditable(row);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-lg" aria-label={`More actions for ${row.name}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-xl">
          {t && editable ? (
            usesBuilder(t) ? (
              <DropdownMenuItem asChild>
                <Link to="/audit-templates/$templateId" params={{ templateId: t.id }}>
                  <Pencil className="size-4" /> Edit
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => setEditingDetails(t)}>
                <Pencil className="size-4" /> Edit name and description
              </DropdownMenuItem>
            )
          ) : null}
          <DropdownMenuItem onSelect={() => setDuplicating(row)}>
            <Copy className="size-4" /> {row.kind === "aislix" ? "Duplicate and customise" : "Duplicate"}
          </DropdownMenuItem>
          {t && editable && t.visibility === "private" && t.status !== "archived" ? (
            <DropdownMenuItem onSelect={() => shareMutation.mutate(t.id)}>
              <Share2 className="size-4" /> Share with team
            </DropdownMenuItem>
          ) : null}
          {t && editable && t.status !== "archived" ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleting(t)}>
                <Trash2 className="size-4" /> Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const renderUseButton = (row: TemplateRow, className?: string) => (
    <Button
      variant="brand"
      size="sm"
      className={cn("rounded-lg", className)}
      disabled={useTemplateMutation.isPending}
      onClick={() => useTemplateMutation.mutate(row)}
    >
      {usingId === row.id ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
      Use
    </Button>
  );

  if (managerQuery.isLoading) {
    return (
      <AppShell title="" hidePageHeader>
        <Skeleton className="h-48 w-full rounded-xl" />
      </AppShell>
    );
  }

  if (!managerQuery.data) {
    return (
      <AppShell title="" hidePageHeader>
        <EmptyState
          title="Manager access required"
          description="Only workspace owners, admins and managers can manage audit templates."
        />
      </AppShell>
    );
  }

  const isCustomTab = tab !== "aislix";

  return (
    <AppShell title="" hidePageHeader>
      <div className="play-canvas space-y-5">
        <PageHeader
          title="Audit templates"
          description="Pick a ready-made Aislix template, or build your own and share it with your team."
          actions={
            <Button variant="brand" size="sm" className="rounded-lg" onClick={() => setCreating(true)}>
              <Plus className="mr-1.5 size-4" /> Create template
            </Button>
          }
        />

        <div>
          <div className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-[#D9E2E8]" role="tablist" aria-label="Template library">
            {TABS.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setTab(item.id);
                    pager.setPage(0);
                  }}
                  className={cn(
                    "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                    active ? "border-[#04203F] text-[#04203F]" : "border-transparent text-[#667085] hover:text-[#04203F]",
                  )}
                >
                  {item.label}{" "}
                  <span className="tabular-nums text-[#667085]">
                    ({item.id === "aislix" || templatesQuery.data ? tabCount(item.id) : "…"})
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-[#667085]">{TABS.find((t) => t.id === tab)?.hint}</p>
        </div>

        <section className="space-y-3 rounded-xl border border-[#D9E2E8] bg-white p-4">
          <div className="flex flex-wrap items-center gap-3">
            <FilterSearch value={filters.q} onChange={(value) => setFilters({ q: value })} placeholder="Search templates…" />
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-3 text-sm font-medium text-[#04203F] transition-colors hover:bg-[#F4F7F9]",
                activeCount > 0 ? "border-[#04203F]/40" : "border-[#D9E2E8]",
              )}
            >
              <SlidersHorizontal className="size-4 text-[#667085]" aria-hidden />
              Filters{activeCount > 0 ? ` (${activeCount})` : ""}
              <ChevronDown className={cn("size-4 text-[#667085] transition-transform", filtersOpen && "rotate-180")} aria-hidden />
            </button>
          </div>

          {filtersOpen ? (
            <div className="grid gap-3 border-t border-[#D9E2E8] pt-3 sm:grid-cols-2 lg:grid-cols-3">
              <FilterField label="Store type">
                <Select
                  value={filters.model}
                  onValueChange={(v) => setFilters({ model: v as Filters["model"], purpose: "all" })}
                >
                  <SelectTrigger className="h-10 rounded-lg" aria-label="Filter by store type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All store types</SelectItem>
                    {OPERATING_MODEL_CARDS.filter((c) => c.id !== "custom").map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="Purpose">
                <Select value={filters.purpose} onValueChange={(v) => setFilters({ purpose: v as Filters["purpose"] })}>
                  <SelectTrigger className="h-10 rounded-lg" aria-label="Filter by purpose">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All purposes</SelectItem>
                    {purposeOptions.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>
              {isCustomTab ? (
                <FilterField label="Status">
                  <Select value={filters.status} onValueChange={(v) => setFilters({ status: v as Filters["status"] })}>
                    <SelectTrigger className="h-10 rounded-lg" aria-label="Filter by status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Drafts and published</SelectItem>
                      <SelectItem value="draft">Drafts</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </FilterField>
              ) : null}
              <div className="flex flex-wrap items-end gap-4 pb-2 text-sm text-[#04203F]">
                <label className="flex items-center gap-2">
                  <Checkbox checked={filters.ai} onCheckedChange={(c) => setFilters({ ai: Boolean(c) })} />
                  AI assisted
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={filters.evidence} onCheckedChange={(c) => setFilters({ evidence: Boolean(c) })} />
                  Photo evidence
                </label>
              </div>
            </div>
          ) : null}

          {narrowed ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085]">
              <span>
                {visible.length.toLocaleString()} of {tabRows.length.toLocaleString()} templates match
              </span>
              <Button variant="ghost" size="sm" className="h-7 rounded-lg px-2 text-xs" onClick={clearFilters}>
                Clear all
              </Button>
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-[#D9E2E8] bg-white">
          {isCustomTab && templatesQuery.isPending ? (
            <Skeleton className="m-4 h-48 rounded-xl" aria-label="Loading templates" />
          ) : isCustomTab && templatesQuery.isError ? (
            <div className="p-4">
              <ErrorState description={toUserMessage(templatesQuery.error)} onRetry={() => void templatesQuery.refetch()} />
            </div>
          ) : tabRows.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={<FileStack className="size-6" />}
                title={tab === "mine" ? "You haven't created a template yet" : "No shared templates yet"}
                description={
                  tab === "mine"
                    ? "Create one from scratch, or duplicate an Aislix template and customise it."
                    : "When a teammate shares a template with the workspace, it appears here."
                }
                action={
                  tab === "mine" ? (
                    <Button variant="brand" className="rounded-lg" onClick={() => setCreating(true)}>
                      <Plus className="mr-1.5 size-4" /> Create template
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : visible.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={<SearchX className="size-5" />}
                title="No templates match"
                description="Try another search, store type or purpose."
                action={
                  <Button variant="subtle" size="sm" className="rounded-lg" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template</TableHead>
                      <TableHead>Store type</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Contents</TableHead>
                      {isCustomTab ? <TableHead>Status</TableHead> : null}
                      {isCustomTab ? <TableHead className="text-right">Assignments</TableHead> : null}
                      {isCustomTab ? <TableHead>Updated</TableHead> : null}
                      <TableHead className="sticky right-0 bg-white text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((row) => (
                      <TableRow key={row.id} className="group transition-colors hover:bg-[#F4F7F9]">
                        <TableCell className="max-w-[340px]">
                          <button
                            type="button"
                            onClick={() => setPreviewing(row)}
                            className="block max-w-full text-left"
                          >
                            <span className="flex items-center gap-2">
                              <span className="truncate font-medium text-[#04203F] hover:underline" title={row.name}>
                                {row.name}
                              </span>
                              {row.recommended ? (
                                <span className="shrink-0 rounded-full border border-[#D9E2E8] px-1.5 py-0.5 text-[11px] font-medium text-[#667085]">
                                  Recommended
                                </span>
                              ) : null}
                            </span>
                            {row.description ? (
                              <span className="block truncate text-xs text-[#667085]">{row.description}</span>
                            ) : null}
                          </button>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{row.modelLabel}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{row.purposeLabel}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          <p className="text-[#04203F]">{contentsLabel(row)}</p>
                          <p className="text-xs text-[#667085]">{capabilityLabel(row)}</p>
                        </TableCell>
                        {isCustomTab ? (
                          <TableCell>
                            {row.template ? (
                              <span className="flex flex-col items-start gap-1">
                                <StatusPill status={row.template.status} />
                                {tab === "mine" ? (
                                  <span className="text-[11px] text-[#667085]">
                                    {row.template.visibility === "organization" ? "Shared with team" : "Only you"}
                                  </span>
                                ) : null}
                              </span>
                            ) : null}
                          </TableCell>
                        ) : null}
                        {isCustomTab ? (
                          <TableCell className="text-right tabular-nums text-sm">
                            {usageQuery.data ? (usageQuery.data[row.id] ?? 0).toLocaleString() : "—"}
                          </TableCell>
                        ) : null}
                        {isCustomTab ? (
                          <TableCell className="whitespace-nowrap text-sm text-[#667085]">
                            {row.template ? formatScanDate(row.template.updated_at) : "—"}
                          </TableCell>
                        ) : null}
                        <TableCell className="sticky right-0 border-l border-[#D9E2E8] bg-white text-right transition-colors group-hover:bg-[#F4F7F9]">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => setPreviewing(row)}>
                              Preview
                            </Button>
                            {renderUseButton(row)}
                            {rowMenu(row)}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <ul className="divide-y divide-[#D9E2E8] md:hidden">
                {pageRows.map((row) => (
                  <li key={row.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <button type="button" onClick={() => setPreviewing(row)} className="min-w-0 text-left">
                        <p className="truncate text-sm font-semibold text-[#04203F]">{row.name}</p>
                        {row.description ? (
                          <p className="mt-0.5 line-clamp-2 text-xs text-[#667085]">{row.description}</p>
                        ) : null}
                      </button>
                      {row.template ? (
                        <StatusPill status={row.template.status} />
                      ) : row.recommended ? (
                        <span className="shrink-0 rounded-full border border-[#D9E2E8] px-1.5 py-0.5 text-[11px] font-medium text-[#667085]">
                          Recommended
                        </span>
                      ) : null}
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      {[
                        { l: "Store type", v: row.modelLabel },
                        { l: "Purpose", v: row.purposeLabel },
                        { l: "Contents", v: contentsLabel(row) },
                        { l: "Capture", v: capabilityLabel(row) },
                      ].map((item) => (
                        <div key={item.l} className="min-w-0">
                          <dt className="text-[#667085]">{item.l}</dt>
                          <dd className="mt-0.5 truncate font-medium text-[#04203F]">{item.v}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-3 flex items-center gap-2">
                      <Button variant="outline" size="sm" className="flex-1 rounded-lg" onClick={() => setPreviewing(row)}>
                        Preview
                      </Button>
                      {renderUseButton(row, "flex-1")}
                      {rowMenu(row)}
                    </div>
                  </li>
                ))}
              </ul>

              <TablePager pager={pager} noun="templates" className="border-t border-[#D9E2E8]" />
            </>
          )}
        </section>
      </div>

      <TemplatePreview
        row={previewing}
        editable={previewing ? isEditable(previewing) : false}
        onClose={() => setPreviewing(null)}
        onUse={(row) => useTemplateMutation.mutate(row)}
        using={previewing !== null && usingId === previewing.id}
      />

      {creating ? (
        <TemplateDetailsDialog
          open
          title="Create template"
          description="Name your template. You add the fields next in the template builder."
          initialName=""
          initialDescription=""
          submitLabel="Continue to builder"
          pending={createMutation.isPending}
          onClose={() => setCreating(false)}
          onSubmit={(value) => createMutation.mutate(value)}
        />
      ) : null}

      {editingDetails ? (
        <TemplateDetailsDialog
          key={editingDetails.id}
          open
          title="Edit template"
          description="Update how this template appears in the library."
          initialName={editingDetails.name}
          initialDescription={editingDetails.short_description || editingDetails.description || ""}
          submitLabel="Save"
          pending={detailsMutation.isPending}
          onClose={() => setEditingDetails(null)}
          onSubmit={(value) => detailsMutation.mutate({ id: editingDetails.id, ...value })}
        />
      ) : null}

      {duplicating ? (
        <DuplicateTemplateDialog
          key={duplicating.id}
          open
          onOpenChange={(open) => !open && setDuplicating(null)}
          defaultName={`${duplicating.name} — Copy`}
          duplicating={duplicateMutation.isPending}
          onConfirm={(name) => duplicateMutation.mutate({ row: duplicating, name })}
        />
      ) : null}

      <AlertDialog open={deleting !== null} onOpenChange={(open) => (open ? undefined : setDeleting(null))}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              If past audits used this template it is archived instead — hidden from the library, while their reports
              keep working. Otherwise it is deleted permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleting) deleteMutation.mutate(deleting.id);
              }}
            >
              {deleteMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
