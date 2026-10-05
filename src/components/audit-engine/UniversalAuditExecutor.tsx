import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AuditExecutionForm } from "@/components/audit-builder/AuditExecutionForm";
import { AuditExecutionTable } from "@/components/audit-engine/AuditExecutionTable";
import { SubmitBlockersPanel, type SubmitProblem } from "@/components/audit-engine/SubmitBlockersPanel";
import { useAuditEvidenceCapture } from "@/components/audit-engine/useAuditEvidenceCapture";
import { evaluateGridEvidence, shelfSlots, type GridRequirement } from "@/lib/audit-engine/grid-evidence";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ErrorState, Skeleton } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import type { AuditResponseValue, TemplateField } from "@/lib/audit-builder/types";
import { validateAuditCompletion } from "@/lib/audit-engine/completion";
import { AuditSubmitError, describeServerIssues } from "@/lib/audit-engine/submit-readiness";
import {
  auditExecutionPath,
  resolveAuditExecutionRoute,
  type AuditExecutionContext,
} from "@/lib/audit-engine";
import {
  fetchCustomAuditResponses,
  loadCustomAuditSession,
  mergeInputDatasetIntoResponses,
  removeCustomAuditRow,
  saveCustomAuditField,
  saveCustomAuditFields,
  submitCustomAudit,
  uploadCustomAuditImage,
  uploadCustomAuditVideo,
  type CustomAuditSession,
  type ResponseMap,
} from "@/lib/custom-audit";

type UniversalAuditExecutorProps = {
  assignmentId: string;
  testMode?: boolean;
};

export function UniversalAuditExecutor({ assignmentId, testMode = false }: UniversalAuditExecutorProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [responses, setResponses] = useState<ResponseMap>({});
  const [submitProblem, setSubmitProblem] = useState<SubmitProblem | null>(null);

  // No background refetch: it would replace the auditee's local table and drop rows not saved yet.
  const sessionQuery = useQuery({
    queryKey: ["custom-audit-session", assignmentId],
    queryFn: () => loadCustomAuditSession(assignmentId),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const responsesQuery = useQuery({
    queryKey: ["custom-audit-responses", assignmentId],
    queryFn: () => fetchCustomAuditResponses(assignmentId),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (!responsesQuery.data || !sessionQuery.data) return;
    setResponses(mergeInputDatasetIntoResponses(sessionQuery.data, responsesQuery.data));
  }, [responsesQuery.data, sessionQuery.data]);

  const session = sessionQuery.data;

  useEffect(() => {
    if (!session || testMode) return;
    const ctx: AuditExecutionContext = {
      assignmentId,
      method:
        session.template.audit_mode === "ai"
          ? "ai"
          : session.template.audit_mode === "ai_assisted"
            ? "ai_assisted"
            : "digital",
      templateType: session.template.template_type,
      operatingModel: session.template.operating_model,
      creationSource: null,
      hasFieldDefinitions: (session.template.field_definitions?.length ?? 0) > 0,
    };
    const route = resolveAuditExecutionRoute(ctx);
    // Template-based expiry audits run here (Expiry dates evidence); the expiry wizard is only for
    // inspections created in Expiry Control, which never reach this screen.
    if (route !== "universal" && route !== "custom" && route !== "expiry") {
      navigate({ to: auditExecutionPath(assignmentId, route) as "/" });
    }
  }, [assignmentId, navigate, session, testMode]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const completion = await validateAuditCompletion(assignmentId);
      if (!completion.ok && !testMode) {
        throw new AuditSubmitError("This audit isn't finished yet.", describeServerIssues(completion));
      }
      // Prefer latest persisted responses so submit matches what the auditor saved,
      // then overlay in-memory edits (deep-merge by section/record).
      const persisted = await fetchCustomAuditResponses(assignmentId);
      const submitResponses: typeof responses = { ...persisted };
      for (const [sec, records] of Object.entries(responses)) {
        submitResponses[sec] = { ...(submitResponses[sec] ?? {}) };
        for (const [idx, vals] of Object.entries(records)) {
          submitResponses[sec][Number(idx)] = {
            ...(submitResponses[sec][Number(idx)] ?? {}),
            ...vals,
          };
        }
      }
      return submitCustomAudit({
        assignmentId,
        session: session!,
        responses: submitResponses,
        testMode,
      });
    },
    onSuccess: ({ scanId, findingsCount }) => {
      if (testMode) {
        toast.success("Test audit validated successfully.");
        return;
      }
      toast.success(
        `Audit submitted${findingsCount ? ` — ${findingsCount} finding(s) flagged` : ""}.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["my-scans"] });
      if (scanId) navigate({ to: "/results", search: { scan: scanId } });
      else navigate({ to: "/my-scans" });
    },
    onMutate: () => setSubmitProblem(null),
    onError: (e) =>
      setSubmitProblem(
        e instanceof AuditSubmitError
          ? { title: e.title, items: e.items }
          : { title: "We couldn't submit this audit.", items: [toUserMessage(e)] },
      ),
  });

  if (sessionQuery.isLoading) return <Skeleton className="h-64 w-full" />;
  if (sessionQuery.isError || !session) {
    return (
      <ErrorState
        description={
          sessionQuery.error
            ? toUserMessage(sessionQuery.error)
            : "Could not load this audit assignment."
        }
      />
    );
  }

  const handleSaveField = async (
    sectionKey: string,
    recordIndex: number,
    field: TemplateField,
    value: AuditResponseValue,
  ) => {
    await saveCustomAuditField({
      assignmentId,
      templateId: session.template.id,
      templateVersion: session.template.version,
      sectionKey,
      recordIndex,
      field,
      value,
    });
  };

  const readOnly = session.status !== "pending" && session.status !== "in_progress";
  const useTable =
    session.template.audit_mode === "digital" && session.definition.sections.some((s) => s.repeatable);

  if (useTable) {
    return (
      <AuditExecutionTable
        session={session}
        responses={responses}
        onChange={setResponses}
        onSaveField={handleSaveField}
        onSaveMany={(sectionKey, items) =>
          saveCustomAuditFields({
            assignmentId,
            templateId: session.template.id,
            templateVersion: session.template.version,
            sectionKey,
            items,
          })
        }
        onRemoveRow={(sectionKey, recordIndex) => removeCustomAuditRow({ assignmentId, sectionKey, recordIndex })}
        onUploadImage={(file) => uploadCustomAuditImage(assignmentId, file)}
        onUploadVideo={(file) => uploadCustomAuditVideo(assignmentId, file)}
        readOnly={readOnly}
        testMode={testMode}
        submitting={submitMutation.isPending}
        onSubmit={() => submitMutation.mutate()}
        submitProblem={submitProblem}
        onDismissSubmitProblem={() => setSubmitProblem(null)}
      />
    );
  }

  const setValue = async (sectionKey: string, recordIndex: number, field: TemplateField, value: AuditResponseValue) => {
    setResponses((prev) => ({
      ...prev,
      [sectionKey]: {
        ...(prev[sectionKey] ?? {}),
        [recordIndex]: { ...(prev[sectionKey]?.[recordIndex] ?? {}), [field.key]: value },
      },
    }));
    if (readOnly) return;
    try {
      await handleSaveField(sectionKey, recordIndex, field, value);
    } catch (e) {
      toast.error(toUserMessage(e));
    }
  };
  const requirements = evaluateGridEvidence({
    policy: session.evidencePolicy,
    requireRca: false,
    dataset: null,
    columns: { shelfColumnId: null, barcodeColumnId: null },
    rows: [],
    responses,
  }).filter((r) => r.total > 0);
  const unmet = requirements.filter((r) => !r.ok && r.id !== "device_metadata");
  const submitForm = () => {
    if (unmet.length && !testMode) {
      setSubmitProblem({
        title: "Add the required evidence before submitting.",
        items: unmet.map((r) => `${r.label}: ${r.hint}`),
      });
      return;
    }
    submitMutation.mutate();
  };

  return (
    <div className="space-y-4">
      {session.template.operating_model && (
        <Alert>
          <AlertDescription>
            Operating model:{" "}
            <strong>{session.template.operating_model.replace(/_/g, " ")}</strong>
            {session.template.audit_purpose
              ? ` · ${session.template.audit_purpose.replace(/_/g, " ")}`
              : ""}
          </AlertDescription>
        </Alert>
      )}
      <div className="mx-auto max-w-lg pb-24">
        <AuditExecutionForm
          definition={session.definition}
          templateName={session.template.name}
          storeName={session.storeName}
          dueAt={session.dueAt}
          responses={responses}
          onChange={setResponses}
          onSaveField={handleSaveField}
          onUploadImage={(file) => uploadCustomAuditImage(assignmentId, file)}
          readOnly={readOnly}
          testMode={testMode}
          evidencePolicy={session.evidencePolicy}
        />
      </div>
      {requirements.length ? (
        <div className="mx-auto max-w-lg">
          <FormAuditEvidence
            session={session}
            requirements={requirements}
            responses={responses}
            setValue={setValue}
            assignmentId={assignmentId}
            readOnly={readOnly}
            canCapture={!readOnly && !testMode}
          />
        </div>
      ) : null}
      {submitProblem ? (
        <div className="mx-auto max-w-lg">
          <SubmitBlockersPanel blockers={[]} problem={submitProblem} onDismissProblem={() => setSubmitProblem(null)} />
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button onClick={submitForm} disabled={submitMutation.isPending}>
          {submitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {testMode ? "Validate test audit" : "Submit audit"}
        </Button>
      </div>
    </div>
  );
}

function FormAuditEvidence({
  session,
  requirements,
  responses,
  setValue,
  assignmentId,
  readOnly,
  canCapture,
}: {
  session: CustomAuditSession;
  requirements: GridRequirement[];
  responses: ResponseMap;
  setValue: (sectionKey: string, recordIndex: number, field: TemplateField, value: AuditResponseValue) => Promise<void>;
  assignmentId: string;
  readOnly: boolean;
  canCapture: boolean;
}) {
  const capture = useAuditEvidenceCapture({
    responses,
    setValue,
    onUploadImage: (file) => uploadCustomAuditImage(assignmentId, file),
    onUploadVideo: (file) => uploadCustomAuditVideo(assignmentId, file),
    policy: session.evidencePolicy,
    storeLocation: session.storeLocation,
    readOnly,
    canCapture,
  });
  return (
    <>
      {capture.renderPanel(requirements, shelfSlots(null, null))}
      {capture.hiddenInputs}
    </>
  );
}
