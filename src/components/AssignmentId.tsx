/**
 * Human-readable assignment identifier shown across task surfaces.
 * Format: ASN- + first 8 hex chars of the UUID, uppercased (e.g. ASN-3CD1F84A).
 */
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function formatAssignmentId(id: string): string {
  return `ASN-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function AssignmentIdChip({
  id,
  label = true,
  className,
}: {
  id: string;
  label?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const text = formatAssignmentId(id);

  const copy = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`Copied ${text}`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy the assignment ID");
    }
  };

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}
    >
      {label ? "Assignment ID:" : null}
      <span className="font-mono font-medium text-foreground">{text}</span>
      <button
        type="button"
        aria-label="Copy assignment ID"
        onClick={copy}
        className="rounded-md p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      </button>
    </span>
  );
}
