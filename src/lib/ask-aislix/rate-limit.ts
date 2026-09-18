type Bucket = { count: number; resetAt: number };

const userBuckets = new Map<string, Bucket>();
const orgBuckets = new Map<string, Bucket>();

function hourMs() {
  return 60 * 60 * 1000;
}

function checkBucket(map: Map<string, Bucket>, key: string, limit: number): boolean {
  const now = Date.now();
  const existing = map.get(key);
  if (!existing || existing.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + hourMs() });
    return true;
  }
  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}

export function checkAskRateLimit(userId: string, orgId: string): { ok: boolean; reason?: string } {
  const userLimit = Number(process.env.ASK_AISLIX_RATE_LIMIT_USER_PER_HOUR ?? 30);
  const orgLimit = Number(process.env.ASK_AISLIX_RATE_LIMIT_ORG_PER_HOUR ?? 200);

  if (!checkBucket(userBuckets, userId, userLimit)) {
    return { ok: false, reason: "rate_limited_user" };
  }
  if (!checkBucket(orgBuckets, orgId, orgLimit)) {
    return { ok: false, reason: "rate_limited_org" };
  }
  return { ok: true };
}
