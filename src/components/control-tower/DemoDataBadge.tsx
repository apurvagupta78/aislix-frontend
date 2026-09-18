import { MpBadge } from "@/components/design-system/MpBadge";
import { DEMO_CTA, DEMO_DATA_LABEL, DEMO_PREVIEW_CTA } from "@/lib/demo-environment";

export function DemoDataBadge({
  showCta = false,
  previewMode = false,
}: {
  showCta?: boolean;
  previewMode?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <MpBadge tone="neutral">{DEMO_DATA_LABEL}</MpBadge>
      {showCta ? (
        <p className="text-xs text-mp-muted">{previewMode ? DEMO_PREVIEW_CTA : DEMO_CTA}</p>
      ) : null}
    </div>
  );
}
