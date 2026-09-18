import { FlaskConical } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function DemoPreviewToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2">
      <FlaskConical className="size-4 shrink-0 text-amber-700" aria-hidden />
      <div className="min-w-0 flex-1">
        <Label htmlFor="demo-preview-toggle" className="text-sm font-medium text-navy">
          Preview demo dashboard
        </Label>
        <p className="text-xs text-mp-muted">
          Load the full demo org (350 audits, all templates) for QA without switching workspace.
        </p>
      </div>
      <Switch
        id="demo-preview-toggle"
        checked={enabled}
        onCheckedChange={onChange}
        aria-label="Preview demo dashboard"
      />
    </div>
  );
}
