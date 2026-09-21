import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { submitAiAudit } from "@/lib/assignment-emails.functions";
import { networkErrorMessage } from "@/lib/api-errors";

type Props = {
  scanId: string;
  assignmentId?: string | null;
  /** True when this scan was already submitted for review. */
  alreadySubmitted?: boolean;
  /** Hide for viewers who cannot submit. */
  canSubmit?: boolean;
};

/** Explicit Submit + optional Notes before assignor is notified. */
export function AiAuditSubmitPanel({
  scanId,
  assignmentId,
  alreadySubmitted = false,
  canSubmit = true,
}: Props) {
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      submitAiAudit({
        data: {
          scanId,
          assignmentId: assignmentId ?? null,
          notes: notes.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Audit submitted. The assignor has been notified.");
      void queryClient.invalidateQueries({ queryKey: ["scan-result", scanId] });
      void queryClient.invalidateQueries({ queryKey: ["org-assignments"] });
      void queryClient.invalidateQueries({ queryKey: ["my-assignments"] });
    },
    onError: (error) => {
      toast.error(networkErrorMessage(error, "Could not submit the audit."));
    },
  });

  if (!canSubmit) return null;

  if (alreadySubmitted || mutation.isSuccess) {
    return (
      <div className="mt-6 rounded-xl border border-[#D9E2E8] bg-white p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-[#102A43]">
          <CheckCircle2 className="size-4 text-[#79E2A8]" />
          Audit submitted
        </div>
        <p className="mt-1 text-sm text-[#667085]">
          Results are saved. The assignor can review this report anytime.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-[#D9E2E8] bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-[#102A43]">Submit audit</h3>
      <p className="mt-1 text-sm text-[#667085]">
        Analysis is complete. Add optional notes, then submit so the assignor is notified.
      </p>
      <div className="mt-3 space-y-2">
        <Label htmlFor="ai-submit-notes" className="text-xs text-[#667085]">
          Notes (optional)
        </Label>
        <Textarea
          id="ai-submit-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Shelf notes for the assignor…"
          className="min-h-[88px] rounded-xl"
          maxLength={2000}
        />
      </div>
      <Button
        type="button"
        className="mt-4 rounded-xl"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Send className="mr-2 size-4" />
        )}
        Submit
      </Button>
    </div>
  );
}
