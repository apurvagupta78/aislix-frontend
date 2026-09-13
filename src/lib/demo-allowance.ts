/**
 * Free demo AI audit allowance — display helpers (backend is authoritative).
 */

export type DemoAllowance = {
  used: number;
  limit: number;
  remaining: number;
  nextAvailableAt: string | null;
};

export function parseDemoAllowance(raw?: {
  demo_audits_used?: number;
  demo_audits_limit?: number;
  demo_audits_remaining?: number;
  demo_next_available_at?: string | null;
  audits_used_today?: number;
  audits_daily_limit?: number;
} | null): DemoAllowance | null {
  if (!raw) return null;
  const limit = raw.demo_audits_limit ?? raw.scans_daily_limit;
  if (limit == null) return null;
  const used = raw.demo_audits_used ?? raw.scans_used_today ?? 0;
  const remaining =
    raw.demo_audits_remaining ?? Math.max(0, limit - used);
  return {
    used,
    limit,
    remaining,
    nextAvailableAt: raw.demo_next_available_at ?? null,
  };
}

export function formatNextAvailable(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
