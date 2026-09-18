import { useCallback, useState } from "react";
import { Sparkles } from "lucide-react";

import { askAislix, type AskAislixMessage, type AskAislixResponse } from "@/lib/ask-aislix";
import { AISLIX } from "@/lib/aislix-theme";
import { useGlobalFilters } from "@/lib/global-filters";
import { requireOrgId } from "@/lib/db/context";
import { AskAislixAnswerPanel } from "./AskAislixAnswerPanel";
import { AskAislixInput } from "./AskAislixInput";
import { AskAislixLoading } from "./AskAislixLoading";
import { AskAislixSuggestions } from "./AskAislixSuggestions";
import { HelpMeAskAislixButton } from "./HelpMeAskAislixButton";
import { HelpMeAskAislixDialog } from "./HelpMeAskAislixDialog";

export function AskAislixSection() {
  const { filters } = useGlobalFilters();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AskAislixResponse | null>(null);
  const [messages, setMessages] = useState<AskAislixMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [helpOpen, setHelpOpen] = useState(false);

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
          },
        });

        setConversationId(result.conversationId);

        if (!result.ok) {
          setResponse(null);
          setError(result.response.summary || "Something went wrong while analyzing your data.");
          return;
        }

        setResponse(result.response);
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
    [conversationId, filters, loading, messages],
  );

  return (
    <section
      className="space-y-4 overflow-hidden rounded-xl border border-white/10 p-4 shadow-card md:p-6"
      style={{ backgroundColor: AISLIX.primary }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold tracking-tight text-white">ASK AISLIX</h2>
          <p className="mt-1 text-sm text-white/75">
            Your retail operations copilot. Ask anything about your audits, stores, inventory, findings or actions.
          </p>
        </div>
      </div>

      <AskAislixInput
        value={question}
        onChange={setQuestion}
        onSubmit={() => void submitQuestion(question)}
        loading={loading}
        variant="dark"
      />

      <HelpMeAskAislixButton variant="dark" disabled={loading} onClick={() => setHelpOpen(true)} />

      <HelpMeAskAislixDialog
        open={helpOpen}
        onOpenChange={setHelpOpen}
        onQuestionReady={(q) => {
          setQuestion(q);
          setError(null);
          setResponse(null);
        }}
      />

      <AskAislixSuggestions
        disabled={loading}
        variant="dark"
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
