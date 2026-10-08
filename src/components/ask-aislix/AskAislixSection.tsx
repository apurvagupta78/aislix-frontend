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
import { buildDemoAskResponse } from "@/lib/ask-aislix/ask-aislix-demo-answers";
import {
  ASK_DEFAULT_PERIOD,
  ASK_PERIOD_KEYS,
  ASK_SCOPE_OPTIONS,
} from "@/lib/ask-aislix/ask-aislix-suggestion-groups";
import { AISLIX_DEMO_ORG_ID, prefixDemoAnswer } from "@/lib/demo-environment";
import { ASK_AISLIX_SECTION } from "@/lib/aislix-theme";
import { requireOrgId, requireUserId } from "@/lib/db/context";
import { supabase } from "@/integrations/supabase/client";
import { fetchMembershipRole } from "@/lib/access-scope";
import { useIsGuest } from "@/lib/use-is-guest";
import { AskAislixAnswerPanel } from "./AskAislixAnswerPanel";
import { AskAislixInput } from "./AskAislixInput";
import { AskAislixLoading } from "./AskAislixLoading";
import { AskAislixSuggestions } from "./AskAislixSuggestions";
import type { SuggestionDataAvailability } from "@/lib/ask-aislix/ask-aislix-suggestions.select";

function demoShowcaseResponse(question: string): AskAislixResponse {
  const response = buildDemoAskResponse(question);
  response.answer = prefixDemoAnswer(response.answer, true);
  response.actions = [{ label: "Create free account", route: "/signup", params: {} }];
  return response;
}

function withAskScope(question: string, store: string, period: string): string {
  const q = question.trim();
  if (!q) return q;
  const defaultStore = ASK_SCOPE_OPTIONS.stores[0];
  if (store === defaultStore && period === ASK_DEFAULT_PERIOD) return q;
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
  const [periodScope, setPeriodScope] = useState<string>(ASK_DEFAULT_PERIOD);
  const [storeOptions, setStoreOptions] = useState<readonly string[]>(ASK_SCOPE_OPTIONS.stores);
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
        const [membership, storesResult] = await Promise.all([
          fetchMembershipRole(orgId, userId),
          supabase
            .from("stores")
            .select("name")
            .eq("org_id", previewDemo ? AISLIX_DEMO_ORG_ID : orgId)
            .neq("status", "inactive")
            .order("name")
            .limit(50),
        ]);
        if (cancelled) return;
        setAccessRole(membership?.role ?? null);
        if (storesResult && !storesResult.error) {
          const names = Array.from(
            new Set((storesResult.data ?? []).map((s) => s.name).filter(Boolean)),
          );
          setStoreOptions([ASK_SCOPE_OPTIONS.stores[0], ...names]);
        }
      } catch {
        if (!cancelled) setAccessRole(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isGuest, previewDemo]);

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
          await new Promise((r) => window.setTimeout(r, 600));
          const demo = demoShowcaseResponse(q);
          setError(null);
          setResponse(demo);
          setMessages((prev) =>
            [...prev, { role: "user" as const, content: q }, { role: "assistant" as const, content: demo.answer }].slice(
              -10,
            ),
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
            period: ASK_PERIOD_KEYS[periodScope as keyof typeof ASK_PERIOD_KEYS],
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
    <section aria-labelledby="ask-aislix-heading" className="w-full">
      <header className="mb-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h2
          id="ask-aislix-heading"
          className="flex items-center gap-1.5 text-base font-semibold"
          style={{ color: ASK_AISLIX_SECTION.heading }}
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          Ask Aislix
        </h2>
        <p className="text-sm" style={{ color: ASK_AISLIX_SECTION.subtitle }}>
          {isGuest ? (
            <>
              Demo answers.{" "}
              <Link to="/signup" className="font-medium text-[#04203F] underline-offset-2 hover:underline">
                Create a free account
              </Link>{" "}
              for your own data.
            </>
          ) : (
            "Questions about your stores, audits and actions."
          )}
        </p>
      </header>

      <div className="space-y-4">
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
          storeOptions={storeOptions}
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
          <p className="rounded-lg border border-[#ECBDCC] bg-[#FFEAF1] px-4 py-3 text-sm text-[#04203F]">
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
