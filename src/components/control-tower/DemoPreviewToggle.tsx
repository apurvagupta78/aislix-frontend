import { FlaskConical } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function DemoPreviewToggle({
  enabled,
  onChange,
  compact = false,
  locked = false,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  /** Compact header control — label only, no helper copy. */
  compact?: boolean;
  /** Guest mode: Demo stays ON and cannot be toggled. */
  locked?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[#C1E4F8] bg-[#EAF6FD] px-3 py-1.5">
        <Label
          htmlFor="demo-data-toggle"
          className={cn("text-sm font-medium text-navy", locked ? "cursor-default" : "cursor-pointer")}
        >
          Demo Data
        </Label>
        <Switch
          id="demo-data-toggle"
          checked={enabled}
          disabled={locked}
          onCheckedChange={locked ? undefined : onChange}
          aria-label="Demo Data"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-[#C1E4F8] bg-[#EAF6FD]/80 px-3 py-2",
      )}
    >
      <FlaskConical className="size-4 shrink-0 text-[#557187]" aria-hidden />
      <div className="min-w-0 flex-1">
        <Label htmlFor="demo-preview-toggle" className="text-sm font-medium text-navy">
          Demo Data
        </Label>
        <p className="text-xs text-mp-muted">
          {locked
            ? "Guest mode always uses showcase demo data."
            : "On: showcase demo audits. Off: your workspace data (empty until you run audits)."}
        </p>
      </div>
      <Switch
        id="demo-preview-toggle"
        checked={enabled}
        disabled={locked}
        onCheckedChange={locked ? undefined : onChange}
        aria-label="Demo Data"
      />
    </div>
  );
}
