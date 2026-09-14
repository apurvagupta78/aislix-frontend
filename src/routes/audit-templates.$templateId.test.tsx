import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { AuditExecutionForm } from "@/components/audit-builder/AuditExecutionForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorState, Skeleton } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import { computeCompletion } from "@/lib/audit-builder/validation";
import { fetchAuditTemplate, templateToDefinition } from "@/lib/audit-templates";
import { buildRecordContexts, type ResponseMap } from "@/lib/custom-audit";
import { isOrgManager } from "@/lib/assignments";

export const Route = createFileRoute("/audit-templates/$templateId/test")({
  head: () => ({ meta: [{ title: "Test Audit Template — Aislix" }] }),
  component: TemplateTestPage,
});

function TemplateTestPage() {
  const { templateId } = Route.useParams();
  const [responses, setResponses] = useState<ResponseMap>({});
  const managerQuery = useQuery({ queryKey: ["is-org-manager"], queryFn: () => isOrgManager() });
  const templateQuery = useQuery({
    queryKey: ["audit-template", templateId],
    queryFn: () => fetchAuditTemplate(templateId),
    enabled: managerQuery.data === true,
  });

  if (templateQuery.isLoading) {
    return (
      <AppShell title="Test Audit">
        <Skeleton className="h-96 w-full" />
      </AppShell>
    );
  }

  const template = templateQuery.data;
  if (!template) {
    return (
      <AppShell title="Test Audit">
        <ErrorState description={toUserMessage(templateQuery.error ?? "Template not found")} />
      </AppShell>
    );
  }

  const definition = templateToDefinition(template);
  const records = buildRecordContexts(definition, responses);
  const completion = computeCompletion(definition, records);

  return (
    <AppShell
      title={`Test — ${template.name}`}
      description="Validate required fields, rules, calculations, and submission logic."
      actions={
        <div className="flex gap-2">
          <Badge variant="outline" className="border-amber-500 text-amber-700">
            TEST MODE
          </Badge>
          <Button asChild variant="outline" size="sm">
            <Link to="/audit-templates/$templateId" params={{ templateId }}>
              <ArrowLeft className="mr-1 size-3" /> Back to Builder
            </Link>
          </Button>
          <Button
            variant="brand"
            size="sm"
            onClick={() => {
              if (completion.complete) toast.success("Test audit validation passed.");
              else toast.error(`${completion.missing.length} required item(s) remaining.`);
            }}
          >
            Validate Submit
          </Button>
        </div>
      }
    >
      <div className="mx-auto max-w-lg pb-24">
        <AuditExecutionForm
          definition={definition}
          templateName={template.name}
          storeName="Store #102 (Test)"
          dueAt={new Date().toISOString()}
          responses={responses}
          onChange={setResponses}
          onSaveField={async () => {}}
          onUploadImage={async () => "https://placehold.co/120x120?text=Evidence"}
          testMode
        />
      </div>
    </AppShell>
  );
}
