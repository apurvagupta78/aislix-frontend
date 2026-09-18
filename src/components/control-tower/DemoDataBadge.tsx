import { MpBadge } from "@/components/design-system/MpBadge";
import { DEMO_CTA, DEMO_DATA_LABEL } from "@/lib/demo-environment";

export function DemoDataBadge({ showCta = false }: { showCta?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <MpBadge tone="neutral">{DEMO_DATA_LABEL}</MpBadge>
      {showCta ? <p className="text-xs text-mp-muted">{DEMO_CTA}</p> : null}
    </div>
  );
}
