/** Resolve wizard time presets to YYYY-MM-DD boundaries (inclusive). */
export function resolveHelpTimeRange(preset: string, customFrom?: string, customTo?: string): {
  preset: string;
  from: string;
  to: string;
} {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const today = startOfDay(now);

  if (preset === "custom") {
    const from = customFrom?.slice(0, 10) ?? fmt(today);
    const to = customTo?.slice(0, 10) ?? fmt(today);
    return { preset, from, to: to >= from ? to : from };
  }

  if (preset === "today") return { preset, from: fmt(today), to: fmt(today) };

  if (preset === "yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return { preset, from: fmt(y), to: fmt(y) };
  }

  if (preset === "7d" || preset === "14d" || preset === "30d") {
    const days = preset === "7d" ? 7 : preset === "14d" ? 14 : 30;
    const from = new Date(today);
    from.setDate(from.getDate() - (days - 1));
    return { preset, from: fmt(from), to: fmt(today) };
  }

  if (preset === "this_week") {
    const from = new Date(today);
    const dow = from.getDay();
    const offset = dow === 0 ? 6 : dow - 1;
    from.setDate(from.getDate() - offset);
    return { preset, from: fmt(from), to: fmt(today) };
  }

  if (preset === "last_week") {
    const end = new Date(today);
    const dow = end.getDay();
    const offset = dow === 0 ? 6 : dow - 1;
    end.setDate(end.getDate() - offset - 1);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return { preset, from: fmt(start), to: fmt(end) };
  }

  if (preset === "this_month") {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return { preset, from: fmt(from), to: fmt(today) };
  }

  if (preset === "last_month") {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    return { preset, from: fmt(from), to: fmt(to) };
  }

  if (preset === "this_quarter") {
    const q = Math.floor(today.getMonth() / 3);
    const from = new Date(today.getFullYear(), q * 3, 1);
    return { preset, from: fmt(from), to: fmt(today) };
  }

  const fallbackFrom = new Date(today);
  fallbackFrom.setDate(fallbackFrom.getDate() - 6);
  return { preset: preset || "7d", from: fmt(fallbackFrom), to: fmt(today) };
}
