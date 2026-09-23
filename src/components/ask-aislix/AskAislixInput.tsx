import { useRef } from "react";
import { Paperclip, Send, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AskAislixAttachmentInput } from "@/lib/ask-aislix/ask-aislix.types";
import { ASK_AISLIX_MAX_ATTACHMENTS } from "@/lib/ask-aislix/ask-aislix.attachments";
import { readAskAislixAttachments } from "@/lib/ask-aislix/ask-aislix.attachments-io";
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
  const attachDisabled =
    loading || !onAttachmentsChange || attachments.length >= ASK_AISLIX_MAX_ATTACHMENTS;

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

  return (
    <form
      className={cn("flex flex-col gap-2", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit();
      }}
    >
      <div className="relative">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="What needs attention today?"
          disabled={loading}
          rows={3}
          className={cn(
            "min-h-[96px] w-full resize-y rounded-xl pb-11 pl-11 pr-[5.5rem] text-base leading-relaxed",
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

        <button
          type="button"
          disabled={attachDisabled}
          aria-label="Upload file"
          title={
            attachments.length >= ASK_AISLIX_MAX_ATTACHMENTS
              ? `Maximum ${ASK_AISLIX_MAX_ATTACHMENTS} files`
              : "Upload file"
          }
          className={cn(
            "absolute bottom-2.5 left-2.5 flex h-8 w-8 items-center justify-center rounded-lg transition",
            attachDisabled
              ? "cursor-not-allowed opacity-40"
              : isDark
                ? "text-[#536277] hover:bg-[#2B394D]/80 hover:text-navy"
                : "text-mp-muted hover:bg-muted/60 hover:text-navy",
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
        </button>

        <Button
          type="submit"
          size="sm"
          disabled={!canSubmit}
          className={cn(
            "absolute bottom-2.5 right-2.5 h-8 rounded-lg px-3 text-sm font-semibold",
            isDark && "hover:brightness-110",
          )}
          style={
            isDark
              ? {
                  backgroundColor: ASK_AISLIX_SECTION.askButton,
                  color: ASK_AISLIX_SECTION.askButtonText,
                }
              : {
                  backgroundColor: ASK_AISLIX_SECTION.askButton,
                  color: ASK_AISLIX_SECTION.askButtonText,
                }
          }
        >
          <Send className="mr-1.5 h-3.5 w-3.5" />
          Ask
        </Button>
      </div>

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
    </form>
  );
}
