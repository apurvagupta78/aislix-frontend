import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { EvidenceConfig } from "@/lib/audit-builder/types";

type Props = {
  evidence: EvidenceConfig;
  onChange: (evidence: EvidenceConfig) => void;
};

export function ExpiryVerificationPanel({ evidence, onChange }: Props) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">Quantity-Linked Expiry Verification</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        When enabled, each physical unit must have corresponding expiry evidence before the audit
        item can be marked complete.
      </p>
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <Label className="text-xs">Enable quantity-based verification</Label>
          <Switch
            checked={evidence.expiryUnitCoverage ?? false}
            onCheckedChange={(v) => onChange({ ...evidence, expiryUnitCoverage: v })}
          />
        </div>
        {evidence.expiryUnitCoverage ? (
          <div className="rounded-lg border border-brand/20 bg-brand/5 p-3 text-xs">
            <p className="font-medium text-brand">Preview behavior</p>
            <p className="mt-1 text-muted-foreground">
              Physical Quantity: <strong>4</strong>
            </p>
            <p className="text-muted-foreground">
              Expiry Verification: <strong>0 / 4</strong> units verified
            </p>
            <p className="mt-2 text-muted-foreground">
              Supports multiple photos, expiry OCR, unique unit coverage, and duplicate evidence
              detection when configured on image fields.
            </p>
          </div>
        ) : null}
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <Label className="text-xs">Prevent duplicate evidence</Label>
          <Switch
            checked={evidence.preventDuplicates ?? false}
            onCheckedChange={(v) => onChange({ ...evidence, preventDuplicates: v })}
          />
        </div>
      </div>
    </section>
  );
}
