import { useRef } from "react";
import { Paperclip, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AskAislixAttachmentInput } from "@/lib/ask-aislix/ask-aislix.types";
import { ASK_AISLIX_MAX_ATTACHMENTS } from "@/lib/ask-aislix/ask-aislix.attachments";
import { ASK_AISLIX_SECTION } from "@/lib/aislix-theme";
import { cn } from "@/lib/utils";

export function AskAislixInput({
  value,
  onChange,
  onSubmit,
  loading,
  className,
  variant = "light",
  attachments = [],
  onAttachmentsChange,
  onAttachmentError,
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
}) {
  const isDark = variant === "dark";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = !loading && value.trim().length > 0;

  return (
    <form
      className={cn("flex flex-col gap-2", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit();
      }}
    >
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="What needs attention today?"
        disabled={loading}
        rows={3}
        className={cn(
          "min-h-[96px] w-full resize-y rounded-xl text-base leading-relaxed",
          isDark
            ? "border-[#536277]/50 text-navy placeholder:text-mp-muted focus-visible:ring-[#536277]/40"
            : "border-line bg-white",
        )}
        style={isDark ? { backgroundColor: ASK_AISLIX_SECTION.inputBackground } : undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (canSubmit) onSubmit();
          }
        }}
      />

      {attachments.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {attachments.map((attachment, index) => (
            <span
              key={`${attachment.name}-${index}`}
              className={cn(
                "inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-xs",
                isDark ? "border-[#536277] bg-[#2B394D] text-white" : "border-line bg-white text-navy",
              )}
            >
              <Paperclip className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
              <span className="truncate">{attachment.name}</span>
              <button
                type="button"
                className="rounded-full p-0.5 opacity-70 transition hover:opacity-100"
                aria-label={`Remove ${attachment.name}`}
                disabled={loading}
                onClick={() =>
                  onAttachmentsChange?.(attachments.filter((_, itemIndex) => itemIndex !== index))
                }
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept="*/*"
          disabled={loading || attachments.length >= ASK_AISLIX_MAX_ATTACHMENTS}
          onChange={(e) => {
            const files = e.target.files;
            e.target.value = "";
            if (!files?.length || !onAttachmentsChange) return;
            void (async () => {
              try {
                const { readAskAislixAttachments } = await import(
                  "@/lib/ask-aislix/ask-aislix.attachments-io"
                );
                const next = await readAskAislixAttachments(files, attachments.length);
                onAttachmentsChange([...attachments, ...next]);
              } catch (err) {
                onAttachmentError?.(
                  err instanceof Error ? err.message : "Could not attach that file.",
                );
              }
            })();
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={loading || attachments.length >= ASK_AISLIX_MAX_ATTACHMENTS}
          className={cn(
            "h-9 rounded-xl px-3",
            isDark ? "text-[#D3DAE5] hover:bg-[#2B394D] hover:text-white" : "text-navy",
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="mr-2 h-4 w-4" />
          Attach
        </Button>
        <div className="flex-1" />
        <Button
          type="submit"
          size="lg"
          disabled={!canSubmit}
          className={cn("h-12 rounded-xl px-5", isDark && "hover:brightness-110")}
          style={
            isDark
              ? {
                  backgroundColor: ASK_AISLIX_SECTION.askButton,
                  color: ASK_AISLIX_SECTION.heading,
                }
              : undefined
          }
        >
          <Send className="mr-2 h-4 w-4" />
          Ask
        </Button>
      </div>
    </form>
  );
}
