import { useCallback, useEffect, useRef, useState } from "react";
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
import { ASK_SCOPE_OPTIONS } from "@/lib/ask-aislix/ask-aislix-suggestion-groups";
import { ASK_AISLIX_SECTION } from "@/lib/aislix-theme";
import { requireOrgId, requireUserId } from "@/lib/db/context";
import { fetchMembershipRole } from "@/lib/access-scope";
import { useIsGuest } from "@/lib/use-is-guest";
import { AskAislixAnswerPanel } from "./AskAislixAnswerPanel";
import { AskAislixInput } from "./AskAislixInput";
import { AskAislixLoading } from "./AskAislixLoading";
import { AskAislixSuggestions } from "./AskAislixSuggestions";
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

function withAskScope(question: string, store: string, period: string): string {
  const q = question.trim();
  if (!q) return q;
  const defaultStore = ASK_SCOPE_OPTIONS.stores[0];
  const defaultPeriod = ASK_SCOPE_OPTIONS.period[1];
  if (store === defaultStore && period === defaultPeriod) return q;
  return `${q} (Scope: ${store}, ${period})`;
}

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
  const [attachments, setAttachments] = useState<AskAislixAttachmentInput[]>([]);
  const [accessRole, setAccessRole] = useState<string | null>(null);
  const [storeScope, setStoreScope] = useState<string>(ASK_SCOPE_OPTIONS.stores[0]);
  const [periodScope, setPeriodScope] = useState<string>(ASK_SCOPE_OPTIONS.period[1]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submitQuestion = useCallback(
    async (raw: string) => {
      const q = withAskScope(raw, storeScope, periodScope);
      if (!q || loading) return;

      setLoading(true);
      setError(null);
      setQuestion(raw.trim());

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
    [
      attachments,
      conversationId,
      isGuest,
      loading,
      messages,
      periodScope,
      previewDemo,
      storeScope,
    ],
  );

  const showSuggestions = !loading && !response && !error;

  return (
    <section
      aria-labelledby="ask-aislix-heading"
      className="w-full overflow-hidden rounded-3xl border shadow-card"
      style={{
        backgroundColor: "#FFFFFF",
        borderColor: ASK_AISLIX_SECTION.bandBorder,
      }}
    >
      <div
        className="border-b px-5 pb-14 pt-5 md:px-8 md:pb-16 md:pt-6"
        style={{
          backgroundColor: ASK_AISLIX_SECTION.background,
          borderColor: ASK_AISLIX_SECTION.bandBorder,
        }}
      >
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-xl border bg-white shadow-[0_1px_2px_rgba(15,42,68,0.08)]"
              style={{
                borderColor: ASK_AISLIX_SECTION.composerBorder,
                color: ASK_AISLIX_SECTION.sparkle,
              }}
            >
              <Sparkles className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2
                id="ask-aislix-heading"
                className="font-display text-[22px] font-semibold tracking-tight"
                style={{ color: ASK_AISLIX_SECTION.heading }}
              >
                Ask AISLIX
              </h2>
              <p className="mt-0.5 text-[14px]" style={{ color: ASK_AISLIX_SECTION.subtitle }}>
                {isGuest
                  ? "Guest demo answers use showcase data. Create a free account for live Ask Aislix."
                  : "Your retail operations copilot for audits, stores, inventory and actions."}
              </p>
              {isGuest ? (
                <Link
                  to="/signup"
                  className="mt-1.5 inline-block text-sm font-medium text-[#2A6FA8] underline-offset-2 hover:underline"
                >
                  Create free account
                </Link>
              ) : null}
            </div>
          </div>
          <kbd
            className="hidden items-center gap-1 rounded-lg border bg-white px-2.5 py-1 font-sans text-[12px] font-medium shadow-[0_1px_2px_rgba(15,42,68,0.08)] md:flex"
            style={{
              borderColor: ASK_AISLIX_SECTION.bandBorder,
              color: ASK_AISLIX_SECTION.blueInk,
            }}
          >
            ⌘ K
          </kbd>
        </header>
      </div>

      <div className="-mt-11 space-y-5 px-5 pb-5 md:px-8 md:pb-8">
        <AskAislixInput
          value={question}
          onChange={setQuestion}
          onSubmit={() => void submitQuestion(question)}
          loading={loading}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          onAttachmentError={setError}
          storeScope={storeScope}
          periodScope={periodScope}
          onStoreScopeChange={setStoreScope}
          onPeriodScopeChange={setPeriodScope}
          inputRef={inputRef}
        />

        {showSuggestions ? (
          <AskAislixSuggestions
            disabled={loading}
            accessRole={accessRole}
            roleHint={roleHint}
            city={city}
            dataAvailability={dataAvailability}
            onSelect={(s) => {
              setQuestion(s);
              setError(null);
              setResponse(null);
              void submitQuestion(s);
            }}
          />
        ) : null}

        {loading ? <AskAislixLoading /> : null}
        {error ? (
          <p className="rounded-lg border border-[#f5b8cb] bg-[#fde8ef] px-4 py-3 text-sm text-[#0f2a44]">
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
      </div>
    </section>
  );
}
