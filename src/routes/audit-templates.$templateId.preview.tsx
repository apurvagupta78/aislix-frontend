import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { EmployeePreviewForm } from "@/components/audit-builder/EmployeePreviewForm";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import { fetchAuditTemplate, templateToDefinition } from "@/lib/audit-templates";
import { isOrgManager } from "@/lib/assignments";

export const Route = createFileRoute("/audit-templates/$templateId/preview")({
  head: () => ({ meta: [{ title: "Preview Audit Template — Aislix" }] }),
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

  if (templateQuery.isLoading) {
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

  return (
    <AppShell
      title={`Preview — ${template.name}`}
      description="Employee and manager views of the configured audit."
      actions={
        <Button asChild variant="outline" size="sm">
          <Link to="/audit-templates/$templateId" params={{ templateId }}>
            <ArrowLeft className="mr-1 size-3" /> Back to Builder
          </Link>
        </Button>
      }
    >
      <EmployeePreviewForm templateName={template.name} definition={templateToDefinition(template)} />
    </AppShell>
  );
}
