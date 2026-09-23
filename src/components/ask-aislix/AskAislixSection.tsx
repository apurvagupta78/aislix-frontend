import { useCallback, useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";

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
import { requireOrgId, requireUserId } from "@/lib/db/context";
import { fetchMembershipRole } from "@/lib/access-scope";
import { useIsGuest } from "@/lib/use-is-guest";
import { AskAislixAnswerPanel } from "./AskAislixAnswerPanel";
import { AskAislixInput } from "./AskAislixInput";
import { AskAislixLoading } from "./AskAislixLoading";
import { AskAislixSuggestions } from "./AskAislixSuggestions";
import { HelpMeAskAislixButton } from "./HelpMeAskAislixButton";
import { HelpMeAskAislixDialog } from "./HelpMeAskAislixDialog";
import type { SuggestionDataAvailability } from "@/lib/ask-aislix/ask-aislix-suggestions.select";

const GUEST_ASK_RESPONSE: AskAislixResponse = {
  answer:
    "[Demo] Across the Guest demo workspace, oral-care planogram compliance averages 84% with 3 open critical findings. Koramangala leads at 91% compliance; Whitefield needs restock on 2 low-facing SKUs. Create a free account to ask about your live audits.",
  summary: "Guest demo · oral care compliance and findings",
  metrics: [
    { label: "Planogram compliance", value: "84", unit: "%", trend: "up" },
    { label: "Open critical", value: "3", unit: "", trend: "down" },
    { label: "Audits (demo)", value: "42", unit: "", trend: "flat" },
  ],
  visual: {
    type: "bar",
    title: "Compliance by store (demo)",
    data: [
      { label: "Koramangala", value: 91 },
      { label: "Whitefield", value: 82 },
      { label: "HSR", value: 88 },
    ],
  },
  table: { columns: [], rows: [] },
  insights: [
    "Whitefield has the largest facing shortfall in the demo set.",
    "Restock Oral-B Pro Expert and verify Sensodyne price tags.",
  ],
  actions: [{ label: "Create free account", route: "/signup", params: {} }],
  source_context: {
    period: "Last 30 days (demo)",
    locations: ["Bengaluru"],
    operating_model: "Supermarket",
  },
  follow_up_questions: [
    "Which stores have the lowest planogram compliance?",
    "What corrective actions are overdue?",
    "Summarize brand share on the last shelf audit",
  ],
};

export function AskAislixSection({
  previewDemo = false,
  dataAvailability = null,
  city = null,
  roleHint = null,
}: {
  previewDemo?: boolean;
  dataAvailability?: SuggestionDataAvailability | null;
  city?: string | null;
  roleHint?: string | null;
}) {
  const isGuest = useIsGuest();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AskAislixResponse | null>(null);
  const [messages, setMessages] = useState<AskAislixMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [helpOpen, setHelpOpen] = useState(false);
  const [attachments, setAttachments] = useState<AskAislixAttachmentInput[]>([]);
  const [accessRole, setAccessRole] = useState<string | null>(null);

  const suggestionRotationSeed = useMemo(
    () => Math.floor(Date.now() / (1000 * 60 * 60 * 6)),
    [],
  );

  useEffect(() => {
    if (isGuest) {
      setAccessRole("manager");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const orgId = await requireOrgId();
        const userId = await requireUserId();
        const membership = await fetchMembershipRole(orgId, userId);
        if (!cancelled) setAccessRole(membership?.role ?? null);
      } catch {
        if (!cancelled) setAccessRole(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isGuest]);

  const submitQuestion = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q || loading) return;

      setLoading(true);
      setError(null);
      setQuestion(q);

      try {
        if (isGuest) {
          await new Promise((r) => window.setTimeout(r, 400));
          setResponse(GUEST_ASK_RESPONSE);
          setMessages((prev) =>
            [
              ...prev,
              { role: "user", content: q },
              { role: "assistant", content: GUEST_ASK_RESPONSE.answer },
            ].slice(-10),
          );
          return;
        }

        const orgId = await requireOrgId();
        const result = await askAislix({
          data: {
            question: q,
            activeOrgId: orgId,
            messages,
            conversationId,
            attachments: attachments.length ? attachments : undefined,
            previewDemo: previewDemo ? true : false,
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
    [attachments, conversationId, isGuest, loading, messages, previewDemo],
  );

  return (
    <section
      className="space-y-4 overflow-hidden rounded-xl border border-[#D9E2E8] p-4 shadow-card md:p-6"
      style={{ backgroundColor: "#FFFFFF" }}
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
            {isGuest
              ? "Guest demo answers use showcase data. Create a free account for live Ask Aislix."
              : "Your AI retail operations copilot. Ask anything about your audits, stores, inventory, findings, actions and analysis."}
          </p>
          {isGuest ? (
            <Link
              to="/signup"
              className="mt-2 inline-block text-sm font-medium text-[#2A6FA8] underline-offset-2 hover:underline"
            >
              Create free account
            </Link>
          ) : null}
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
        accessRole={accessRole}
        roleHint={roleHint}
        city={city}
        rotationSeed={suggestionRotationSeed}
        dataAvailability={dataAvailability}
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
