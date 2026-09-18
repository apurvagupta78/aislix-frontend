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
    <div
      className="flex flex-col gap-1 rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-2"
      role="status"
      aria-label={DEMO_DATA_LABEL}
    >
      <MpBadge tone="neutral" className="w-fit border-amber-400 bg-amber-100 font-semibold text-amber-900">
        {DEMO_DATA_LABEL}
      </MpBadge>
      {showCta ? (
        <p className="text-xs text-amber-900/80">{previewMode ? DEMO_PREVIEW_CTA : DEMO_CTA}</p>
      ) : null}
    </div>
  );
}
