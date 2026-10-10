import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { EmployeePreviewForm } from "@/components/audit-builder/EmployeePreviewForm";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import { canEditAuditTemplate, fetchAuditTemplate, templateToDefinition } from "@/lib/audit-templates";
import { isOrgManager } from "@/lib/assignments";
import { requireUserId } from "@/lib/db/context";

export const Route = createFileRoute("/audit-templates/$templateId/preview")({
  head: () => ({ meta: [{ title: "Preview audit template — Aislix" }] }),
  component: TemplatePreviewPage,
});

function TemplatePreviewPage() {
  const { templateId } = Route.useParams();
  const managerQuery = useQuery({ queryKey: ["is-org-manager"], queryFn: () => isOrgManager() });
  const templateQuery = useQuery({
    queryKey: ["audit-template", templateId],
    queryFn: () => fetchAuditTemplate(templateId),
    enabled: managerQuery.data === true,
  });
  const currentUserQuery = useQuery({ queryKey: ["current-user-id"], queryFn: requireUserId });

  if (managerQuery.isLoading || templateQuery.isLoading) {
    return (
      <AppShell title="Preview">
        <Skeleton className="h-96 w-full" />
      </AppShell>
    );
  }

  const template = templateQuery.data;
  if (!template) {
    return (
      <AppShell title="Preview">
        <ErrorState description={toUserMessage(templateQuery.error ?? "Template not found")} />
      </AppShell>
    );
  }

  const editable = canEditAuditTemplate(template, currentUserQuery.data);

  return (
    <AppShell
      title={template.name}
      description="What auditors will fill in when this template is used."
      actions={
        <>
          <Button asChild variant="outline" size="sm" className="rounded-lg">
            <Link to="/audit-templates">
              <ArrowLeft className="mr-1 size-3" /> Templates
            </Link>
          </Button>
          {editable ? (
            <Button asChild variant="outline" size="sm" className="rounded-lg">
              <Link to="/audit-templates/$templateId" params={{ templateId }}>
                <Pencil className="mr-1 size-3" /> Edit
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="brand" size="sm" className="rounded-lg">
            <Link
              to="/new-audit"
              search={{ templateId, systemKey: undefined, assign: false, dueDate: undefined, dueTime: undefined }}
            >
              Use template
            </Link>
          </Button>
        </>
      }
    >
      <EmployeePreviewForm templateName={template.name} definition={templateToDefinition(template)} />
    </AppShell>
  );
}
