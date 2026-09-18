import { isSuggestionToolAvailable } from "./ask-aislix-suggestions.capabilities";
import { ASK_AISLIX_SUGGESTION_LIBRARY } from "./ask-aislix-suggestions.library";
import type {
  AskAislixSuggestionItem,
  ResolvedAskSuggestion,
  SuggestionCategory,
  SuggestionRole,
} from "./ask-aislix-suggestions.types";

export type SuggestionSelectContext = {
  /** Dashboard role tab hint (supermarket, darkstore, fmcg, etc.). */
  roleHint?: string | null;
  /** Active city filter label, e.g. "Mumbai". */
  city?: string | null;
  /** Number of chips to display (default 7). */
  count?: number;
  /** Rotation seed — change on visit/refresh for varied examples. */
  rotationSeed?: number;
};

const ROLE_BUCKETS: SuggestionRole[] = [
  "supermarket",
  "fmcg",
  "local",
  "darkstore",
  "warehouse",
];

const CATEGORY_PRIORITY: SuggestionCategory[] = [
  "evidence",
  "trend",
  "inventory",
  "expiry",
  "findings",
  "recurring",
  "actions",
  "comparison",
  "stores",
  "audit",
];

function normalizeRoleHint(roleHint?: string | null): SuggestionRole | null {
  if (!roleHint || roleHint === "all") return null;
  if (roleHint === "distributor") return "fmcg";
  if (roleHint === "darkstore") return "darkstore";
  if (roleHint === "supermarket") return "supermarket";
  if (roleHint === "fmcg") return "fmcg";
  if (roleHint === "local") return "local";
  return null;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function resolveSuggestionText(
  item: AskAislixSuggestionItem,
  city?: string | null,
): string {
  const cityLabel = city && city !== "all" ? city : null;
  if (cityLabel && item.text.includes("{{city}}")) {
    return item.text.replace(/\{\{city\}\}/g, cityLabel);
  }
  if (item.text.includes("{{city}}")) {
    return item.text.replace(/\{\{city\}\}/g, "my");
  }
  return item.text;
}

function getAvailableLibrary(): AskAislixSuggestionItem[] {
  return ASK_AISLIX_SUGGESTION_LIBRARY.filter((item) =>
    isSuggestionToolAvailable(item.requiredTools),
  );
}

function shuffleWithRng<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickRoleExamples(
  pool: AskAislixSuggestionItem[],
  rng: () => number,
  preferredRole: SuggestionRole | null,
  maxRolePicks: number,
): AskAislixSuggestionItem[] {
  const picked: AskAislixSuggestionItem[] = [];
  const usedCategories = new Set<SuggestionCategory>();
  const usedIds = new Set<string>();

  const roleOrder = preferredRole
    ? [preferredRole, ...ROLE_BUCKETS.filter((r) => r !== preferredRole)]
    : shuffleWithRng(ROLE_BUCKETS, rng);

  for (const role of roleOrder) {
    if (picked.length >= maxRolePicks) break;
    const candidates = shuffleWithRng(
      pool.filter(
        (item) =>
          item.roles.includes(role) &&
          !item.roles.includes("universal") &&
          !usedIds.has(item.id) &&
          !usedCategories.has(item.category),
      ),
      rng,
    );
    if (candidates.length === 0) continue;
    const choice = candidates[0];
    picked.push(choice);
    usedIds.add(choice.id);
    usedCategories.add(choice.category);
  }

  return picked;
}

function pickUniversalExamples(
  pool: AskAislixSuggestionItem[],
  rng: () => number,
  excludeIds: Set<string>,
  count: number,
): AskAislixSuggestionItem[] {
  const picked: AskAislixSuggestionItem[] = [];
  const usedCategories = new Set<SuggestionCategory>();

  const universalPool = pool.filter(
    (item) =>
      item.roles.includes("universal") &&
      !excludeIds.has(item.id),
  );

  for (const category of CATEGORY_PRIORITY) {
    if (picked.length >= count) break;
    const candidates = shuffleWithRng(
      universalPool.filter(
        (item) =>
          item.category === category &&
          !usedCategories.has(item.category) &&
          !picked.some((p) => p.id === item.id),
      ),
      rng,
    );
    if (candidates.length === 0) continue;
    picked.push(candidates[0]);
    usedCategories.add(category);
  }

  if (picked.length < count) {
    const remainder = shuffleWithRng(
      universalPool.filter((item) => !picked.some((p) => p.id === item.id)),
      rng,
    );
    for (const item of remainder) {
      if (picked.length >= count) break;
      if (usedCategories.has(item.category)) continue;
      picked.push(item);
      usedCategories.add(item.category);
    }
  }

  return picked;
}

/** Select a compact, diverse set of suggestion chips for the dashboard. */
export function selectAskAislixSuggestions(
  context: SuggestionSelectContext = {},
): ResolvedAskSuggestion[] {
  const count = context.count ?? 7;
  const pool = getAvailableLibrary();
  if (pool.length === 0) return [];

  const seed =
    context.rotationSeed ??
    Math.floor(Date.now() / (1000 * 60 * 60 * 6)); // rotate every ~6 hours
  const rng = mulberry32(seed);

  const preferredRole = normalizeRoleHint(context.roleHint);
  const rolePickCount = Math.min(3, Math.max(2, Math.floor(count / 2)));
  const universalPickCount = count - rolePickCount;

  const rolePicks = pickRoleExamples(pool, rng, preferredRole, rolePickCount);
  const excludeIds = new Set(rolePicks.map((item) => item.id));
  const universalPicks = pickUniversalExamples(
    pool,
    rng,
    excludeIds,
    universalPickCount,
  );

  const combined = shuffleWithRng([...universalPicks, ...rolePicks], rng);

  return combined.slice(0, count).map((item) => ({
    id: item.id,
    text: resolveSuggestionText(item, context.city),
    icon: item.icon,
    category: item.category,
  }));
}

/** Exported for tests — count of wired suggestions in the library. */
export function getWiredSuggestionCount(): number {
  return getAvailableLibrary().length;
}
