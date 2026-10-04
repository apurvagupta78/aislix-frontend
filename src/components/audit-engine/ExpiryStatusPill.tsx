import { AISLIX_PALETTE, ACCENT_TINT } from "@/lib/ai-audit/kpi-palette";
import { EXPIRY_STATUS_LABEL, describeExpiry, type ExpiryStatus } from "@/lib/audit-engine/expiry-evidence";

const STYLE: Record<ExpiryStatus, { background: string; border: string }> = {
  expired: { background: AISLIX_PALETTE.pink, border: `1px solid ${AISLIX_PALETTE.secondary}` },
  near_expiry: { background: ACCENT_TINT.pink, border: `1px dashed ${AISLIX_PALETTE.secondary}` },
  ok: { background: ACCENT_TINT.green, border: `1px solid ${AISLIX_PALETTE.green}` },
};

export function ExpiryStatusPill({ status, date, today }: { status: ExpiryStatus; date: string; today: string }) {
  return (
    <span
      title={describeExpiry(date, today)}
      className="inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium text-[#102A43]"
      style={STYLE[status]}
    >
      {status === "expired" ? <strong>EXPIRED</strong> : EXPIRY_STATUS_LABEL[status]}
      {status !== "ok" ? <span className="ml-1 font-normal text-[#667085]">· {describeExpiry(date, today)}</span> : null}
    </span>
  );
}

export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}
