/**
 * Turns a scan's executive summary (markdown sections) into three plain sentences for
 * dashboard cards: what went well, what needs attention, and what to do next.
 */

import { hideModelNames } from "@/lib/ai-display-text";

export type SummaryInsights = { good: string; attention: string; nextAction: string };

export const FALLBACK_INSIGHTS: SummaryInsights = {
  good: "Shelf execution captured for this audit.",
  attention: "Review findings and planogram gaps in the full report.",
  nextAction: "Open the audit and assign corrective actions where needed.",
};

/** Markdown and list markup removed; whitespace collapsed. */
export function plainText(value: string): string {
  return value
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s*(?:[-*+•]|\d+[.)])\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, "$1$2")
    .replace(/[*_`]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sections(markdown: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  let current = "";
  for (const raw of markdown.split(/\r?\n/)) {
    const heading = raw.match(/^\s{0,3}#{1,6}\s*(.+?)\s*#*\s*$/);
    if (heading) {
      current = heading[1]!.toLowerCase();
      out.set(current, []);
      continue;
    }
    const line = plainText(raw);
    if (!line) continue;
    const list = out.get(current) ?? [];
    list.push(line);
    out.set(current, list);
  }
  return out;
}

function find(map: Map<string, string[]>, ...names: string[]): string[] {
  for (const [title, lines] of map) {
    if (names.some((n) => title.includes(n))) return lines;
  }
  return [];
}

function unique(lines: string[]): string[] {
  const seen = new Set<string>();
  return lines.filter((l) => {
    const k = l.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function sentence(text: string): string {
  const t = text.trim().replace(/\s*[.;]+$/, "");
  return t ? `${t.charAt(0).toUpperCase()}${t.slice(1)}.` : "";
}

const NEGATIVE = /risk|pending|mismatch|missing|below|shortfall|gap|issue|fail|wrong|critical|unreadable|verify/i;
const NO_ACTIONS = /^no (automated )?(next )?actions?\b|^no structured findings/i;

function riskLevel(lines: string[]): string | null {
  for (const l of lines) {
    const m = l.match(/execution risk:\s*([A-Z_]+)/i);
    if (m) return m[1]!.toUpperCase();
  }
  return null;
}

/** Plain-language insights from a structured executive summary; falls back to sentence splitting. */
export function summaryInsights(executiveSummary: unknown): SummaryInsights {
  if (typeof executiveSummary !== "string" || !executiveSummary.trim()) return FALLBACK_INSIGHTS;
  const text = hideModelNames(executiveSummary.trim());

  if (!/^\s{0,3}#{1,6}\s/m.test(text)) {
    const parts = plainText(text)
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      good: parts[0] ?? FALLBACK_INSIGHTS.good,
      attention: parts[1] ?? FALLBACK_INSIGHTS.attention,
      nextAction: parts[2] ?? FALLBACK_INSIGHTS.nextAction,
    };
  }

  const map = sections(text);
  const findings = find(map, "executive findings", "key findings");
  const kpis = find(map, "kpi summary");
  const risk = find(map, "risk");
  const issues = find(map, "execution issues").filter((l) => !/^no .*recorded/i.test(l));
  const next = unique(find(map, "next action", "recommended")).filter((l) => !NO_ACTIONS.test(l));

  const positive = findings.find((l) => !NEGATIVE.test(l));
  const products = kpis.find((l) => /^products identified/i.test(l));
  const brands = kpis.find((l) => /^brands identified/i.test(l));
  const good =
    positive ??
    (products ? [products, brands].filter(Boolean).join(" · ") : null) ??
    FALLBACK_INSIGHTS.good;

  const level = riskLevel([...findings, ...risk]);
  const concerns = unique([
    ...issues,
    ...risk.filter((l) => !/execution risk:/i.test(l)),
    ...findings.filter((l) => NEGATIVE.test(l) && !/execution risk:/i.test(l)),
  ]);
  let attention: string;
  if (concerns.length) {
    const lead = level && level !== "NONE" ? `${level.charAt(0)}${level.slice(1).toLowerCase()} execution risk: ` : "";
    attention = sentence(`${lead}${concerns[0]}`) + (concerns.length > 1 ? ` (+${concerns.length - 1} more)` : "");
  } else if (level && level !== "NONE") {
    attention = sentence(`${level.charAt(0)}${level.slice(1).toLowerCase()} execution risk — see the full report`);
  } else {
    attention = "Nothing flagged in this audit.";
  }

  const nextAction = next.length
    ? next.slice(0, 2).map(sentence).join(" ")
    : level && level !== "NONE"
      ? FALLBACK_INSIGHTS.nextAction
      : "No action needed — the full report has product-level detail.";

  return { good: sentence(good), attention, nextAction };
}
