const STORAGE_KEY = "aislix-recent-templates-v1";

export type RecentTemplateEntry = {
  id: string;
  name: string;
  systemKey?: string;
  operatingModel?: string;
  usedAt: string;
};

type Store = Record<string, RecentTemplateEntry[]>;

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Store;
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function recordRecentTemplate(
  userId: string,
  entry: Omit<RecentTemplateEntry, "usedAt">,
) {
  const store = readStore();
  const list = store[userId] ?? [];
  const next: RecentTemplateEntry = { ...entry, usedAt: new Date().toISOString() };
  const filtered = list.filter(
    (t) => t.id !== entry.id && t.systemKey !== entry.systemKey,
  );
  store[userId] = [next, ...filtered].slice(0, 8);
  writeStore(store);
}

export function getRecentTemplates(userId: string | undefined, limit = 5): RecentTemplateEntry[] {
  if (!userId) return [];
  return (readStore()[userId] ?? []).slice(0, limit);
}

export function formatRecentLabel(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}
