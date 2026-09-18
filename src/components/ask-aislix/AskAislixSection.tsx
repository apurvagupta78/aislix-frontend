import { useCallback, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";

import {
  askAislix,
  type AskAislixAttachmentInput,
  type AskAislixMessage,
  type AskAislixResponse,
} from "@/lib/ask-aislix";
import {
  ASK_AISLIX_PARSE_ERROR_MESSAGE,
  NO_AUDIT_FOUND_MESSAGE,
} from "@/lib/ask-aislix/ask-aislix.response";
import { ASK_AISLIX_SECTION } from "@/lib/aislix-theme";
import { useGlobalFilters } from "@/lib/global-filters";
import { requireOrgId } from "@/lib/db/context";
import { AskAislixAnswerPanel } from "./AskAislixAnswerPanel";
import { AskAislixInput } from "./AskAislixInput";
import { AskAislixLoading } from "./AskAislixLoading";
import { AskAislixSuggestions } from "./AskAislixSuggestions";
import { HelpMeAskAislixButton } from "./HelpMeAskAislixButton";
import { HelpMeAskAislixDialog } from "./HelpMeAskAislixDialog";

export function AskAislixSection({ previewDemo = false }: { previewDemo?: boolean }) {
  const { filters } = useGlobalFilters();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AskAislixResponse | null>(null);
  const [messages, setMessages] = useState<AskAislixMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [helpOpen, setHelpOpen] = useState(false);
  const [attachments, setAttachments] = useState<AskAislixAttachmentInput[]>([]);

  const suggestionRotationSeed = useMemo(
    () => Math.floor(Date.now() / (1000 * 60 * 60 * 6)),
    [],
  );

  const submitQuestion = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q || loading) return;

      setLoading(true);
      setError(null);
      setQuestion(q);

      try {
        const orgId = await requireOrgId();
        const result = await askAislix({
          data: {
            question: q,
            activeOrgId: orgId,
            filters,
            messages,
            conversationId,
            attachments: attachments.length ? attachments : undefined,
            previewDemo: previewDemo || undefined,
          },
        });

        setConversationId(result.conversationId);

        if (!result.ok) {
          setResponse(null);
          setError(result.response.answer || "Ask Aislix could not complete this request.");
          return;
        }

        if (
          result.response.answer === NO_AUDIT_FOUND_MESSAGE ||
          result.response.answer === ASK_AISLIX_PARSE_ERROR_MESSAGE
        ) {
          setResponse(null);
          setError(result.response.answer);
          return;
        }

        setResponse(result.response);
        setAttachments([]);
        setMessages((prev) =>
          [
            ...prev,
            { role: "user", content: q },
            { role: "assistant", content: result.response.answer },
          ].slice(-10),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not reach Ask Aislix.");
        setResponse(null);
      } finally {
        setLoading(false);
      }
    },
    [attachments, conversationId, filters, loading, messages, previewDemo],
  );

  return (
    <section
      className="space-y-4 overflow-hidden rounded-xl border border-[#536277]/40 p-4 shadow-card md:p-6"
      style={{ backgroundColor: ASK_AISLIX_SECTION.background }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: ASK_AISLIX_SECTION.chipBackground }}
        >
          <Sparkles className="h-5 w-5" style={{ color: ASK_AISLIX_SECTION.heading }} />
        </div>
        <div className="min-w-0 flex-1">
          <h2
            className="font-display text-xl font-semibold tracking-tight"
            style={{ color: ASK_AISLIX_SECTION.heading }}
          >
            Ask AISLIX
          </h2>
          <p className="mt-1 text-sm" style={{ color: ASK_AISLIX_SECTION.subtitle }}>
            Your AI retail operations copilot. Ask anything about your audits, stores, inventory, findings, actions and analysis.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <AskAislixInput
          value={question}
          onChange={setQuestion}
          onSubmit={() => void submitQuestion(question)}
          loading={loading}
          variant="dark"
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          onAttachmentError={setError}
        />

        <HelpMeAskAislixButton variant="dark" disabled={loading} onClick={() => setHelpOpen(true)} />
      </div>

      <HelpMeAskAislixDialog
        open={helpOpen}
        onOpenChange={setHelpOpen}
        onUsePrompt={(q) => {
          setQuestion(q);
          setError(null);
          setResponse(null);
        }}
      />

      <AskAislixSuggestions
        disabled={loading}
        variant="dark"
        roleHint={filters.role}
        city={filters.city}
        rotationSeed={suggestionRotationSeed}
        onSelect={(s) => {
          setQuestion(s);
          setError(null);
          setResponse(null);
        }}
      />

      {loading ? <AskAislixLoading variant="dark" /> : null}
      {error ? (
        <p className="rounded-lg border border-red-300/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </p>
      ) : null}
      {response && !loading && !error ? (
        <AskAislixAnswerPanel
          response={response}
          onFollowUp={(q) => {
            setQuestion(q);
            setError(null);
            setResponse(null);
          }}
        />
      ) : null}
    </section>
  );
}
