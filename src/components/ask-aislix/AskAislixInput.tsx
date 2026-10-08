import { useEffect, useRef, useState, type RefObject } from "react";
import {
  ArrowUp,
  Calendar,
  Loader2,
  Paperclip,
  Store,
  Wand2,
  X,
} from "lucide-react";

import { AskAislixScopeSelect } from "@/components/ask-aislix/AskAislixScopeSelect";
import type { AskAislixAttachmentInput } from "@/lib/ask-aislix/ask-aislix.types";
import { ASK_AISLIX_MAX_ATTACHMENTS } from "@/lib/ask-aislix/ask-aislix.attachments";
import { readAskAislixAttachments } from "@/lib/ask-aislix/ask-aislix.attachments-io";
import { ASK_DEFAULT_PERIOD, ASK_SCOPE_OPTIONS } from "@/lib/ask-aislix/ask-aislix-suggestion-groups";
import { ASK_AISLIX_SECTION } from "@/lib/aislix-theme";
import { cn } from "@/lib/utils";

function enhancePromptText(query: string, store: string, period: string): string {
  const base = query.trim().replace(/\?$/, "");
  return `${base} across ${store.toLowerCase()} for the ${period.toLowerCase()}. Rank by business impact, explain the likely root cause, and suggest the next corrective action for each.`;
}

export function AskAislixInput({
  value,
  onChange,
  onSubmit,
  loading,
  className,
  variant: _variant = "light",
  attachments = [],
  onAttachmentsChange,
  onAttachmentError,
  storeScope,
  periodScope,
  onStoreScopeChange,
  onPeriodScopeChange,
  storeOptions = ASK_SCOPE_OPTIONS.stores,
  inputRef: externalInputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  className?: string;
  variant?: "light" | "dark";
  attachments?: AskAislixAttachmentInput[];
  onAttachmentsChange?: (attachments: AskAislixAttachmentInput[]) => void;
  onAttachmentError?: (message: string) => void;
  storeScope?: string;
  periodScope?: string;
  onStoreScopeChange?: (value: string) => void;
  onPeriodScopeChange?: (value: string) => void;
  storeOptions?: readonly string[];
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  void _variant;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalInputRef ?? localTextareaRef;
  const [enhancing, setEnhancing] = useState(false);
  const [store, setStore] = useState<string>(ASK_SCOPE_OPTIONS.stores[0]);
  const [period, setPeriod] = useState<string>(ASK_DEFAULT_PERIOD);

  const activeStore = storeScope ?? store;
  const activePeriod = periodScope ?? period;
  const setActiveStore = onStoreScopeChange ?? setStore;
  const setActivePeriod = onPeriodScopeChange ?? setPeriod;

  const canSubmit = !loading && value.trim().length > 0;
  const canEnhance = !loading && !enhancing && value.trim().length > 0;
  const attachDisabled =
    loading || !onAttachmentsChange || attachments.length >= ASK_AISLIX_MAX_ATTACHMENTS;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value, textareaRef]);

  const handleFiles = (files: FileList | null) => {
    if (!files?.length || !onAttachmentsChange) return;
    void readAskAislixAttachments(files, attachments.length)
      .then((next) => onAttachmentsChange([...attachments, ...next]))
      .catch((err) => {
        onAttachmentError?.(
          err instanceof Error ? err.message : "Could not attach that file.",
        );
      });
  };

  const handleEnhance = () => {
    const q = value.trim();
    if (!q || enhancing || loading) return;
    setEnhancing(true);
    window.setTimeout(() => {
      onChange(enhancePromptText(q, activeStore, activePeriod));
      setEnhancing(false);
      textareaRef.current?.focus();
    }, 500);
  };

  return (
    <form
      className={cn("w-full", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit();
      }}
    >
      <div
        className={cn(
          "rounded-xl border bg-white transition-colors duration-150",
          "focus-within:!border-[#9FB3C8]",
        )}
        style={{ borderColor: ASK_AISLIX_SECTION.composerBorder }}
      >
        {attachments.length > 0 ? (
          <ul className="flex flex-wrap gap-2 px-4 pt-3">
            {attachments.map((attachment, index) => (
              <li
                key={`${attachment.name}-${index}`}
                className="flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12.5px]"
                style={{
                  backgroundColor: ASK_AISLIX_SECTION.accentSoft,
                  borderColor: ASK_AISLIX_SECTION.bandBorder,
                  color: ASK_AISLIX_SECTION.scopeText,
                }}
              >
                <Paperclip className="h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate">{attachment.name}</span>
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-white"
                  aria-label={`Remove ${attachment.name}`}
                  disabled={loading}
                  onClick={() =>
                    onAttachmentsChange?.(
                      attachments.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <label htmlFor="ask-aislix-input" className="sr-only">
          Ask Aislix a question
        </label>
        <textarea
          id="ask-aislix-input"
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={loading}
          placeholder="What needs attention in my stores today?"
          className="block w-full resize-none bg-transparent px-4 pt-3.5 text-[15px] leading-relaxed text-[#04203F] placeholder:text-[#667085] focus:outline-none disabled:opacity-60"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSubmit) onSubmit();
            }
          }}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-2.5 pt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={attachDisabled}
              aria-label="Attach file"
              title={
                attachments.length >= ASK_AISLIX_MAX_ATTACHMENTS
                  ? `Maximum ${ASK_AISLIX_MAX_ATTACHMENTS} files`
                  : "Attach file"
              }
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg text-[#667085] transition-colors",
                "hover:bg-[#F4F7F9] hover:text-[#04203F]",
                "disabled:cursor-not-allowed disabled:opacity-40",
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" aria-hidden />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept="*/*"
              disabled={attachDisabled}
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <AskAislixScopeSelect
              icon={Store}
              label="Store scope"
              value={activeStore}
              options={storeOptions}
              onChange={setActiveStore}
              disabled={loading}
            />
            <AskAislixScopeSelect
              icon={Calendar}
              label="Time period"
              value={activePeriod}
              options={ASK_SCOPE_OPTIONS.period}
              onChange={setActivePeriod}
              disabled={loading}
            />
          </div>

          <div className="flex items-center gap-2">
            {canEnhance || enhancing ? (
              <button
                type="button"
                onClick={handleEnhance}
                disabled={!canEnhance}
                title="Add scope and ask for root cause and next action"
                className={cn(
                  "flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[13px] font-medium text-[#667085] transition-colors",
                  "hover:bg-[#F4F7F9] hover:text-[#04203F] disabled:cursor-not-allowed disabled:opacity-60",
                )}
              >
                {enhancing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" aria-hidden />
                )}
                <span className="hidden sm:inline">{enhancing ? "Improving…" : "Improve question"}</span>
              </button>
            ) : null}
            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-lg px-4 text-[13.5px] font-semibold transition-colors duration-150",
                "disabled:cursor-not-allowed",
              )}
              style={
                canSubmit
                  ? {
                      backgroundColor: ASK_AISLIX_SECTION.askButton,
                      color: ASK_AISLIX_SECTION.askButtonText,
                    }
                  : {
                      backgroundColor: ASK_AISLIX_SECTION.askButtonDisabled,
                      color: ASK_AISLIX_SECTION.askButtonDisabledText,
                    }
              }
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <ArrowUp className="h-4 w-4" aria-hidden />
              )}
              Ask
            </button>
          </div>
        </div>
      </div>

    </form>
  );
}
