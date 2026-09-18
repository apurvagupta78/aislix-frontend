import {
  GROUP_BY_LABELS,
  HELP_ROLE_CARDS,
  HELP_TIME_PRESETS,
  TOPICS_BY_ROLE,
} from "@/lib/ask-aislix/help-ask-aislix.config";
import type { HelpAskIntent } from "@/lib/ask-aislix/help-ask-aislix.types";

function humanizeTopic(topic: string, role: HelpAskIntent["operating_role"]): string {
  const match = TOPICS_BY_ROLE[role].find((t) => t.id === topic);
  return match?.label ?? topic.replace(/_/g, " ");
}

function locationPhrase(intent: HelpAskIntent): string {
  const { locations } = intent;
  if (locations.scope === "all_my_locations") {
    return "across my authorized locations";
  }
  if (locations.store_names?.length) {
    return `for ${locations.store_names.join(", ")}`;
  }
  if (locations.city) {
    return `in ${locations.city}`;
  }
  if (locations.country) {
    return `in ${locations.country}`;
  }
  return "across my authorized locations";
}

function productPhrase(intent: HelpAskIntent): string | null {
  const scope = intent.product_scope;
  if (!scope || scope.mode === "all") return null;

  if (scope.brand) return `for ${scope.brand} products`;
  if (scope.category) return `in the ${scope.category} category`;
  if (scope.sku) return `for SKU ${scope.sku}`;
  if (scope.item_code) return `for item code ${scope.item_code}`;
  if (scope.product_name) return `for ${scope.product_name}`;
  if (scope.variant) return `for ${scope.variant} variants`;
  if (scope.batch) return `for batch ${scope.batch}`;

  const extra = intent.optional_filters ?? {};
  if (extra.brand) return `for ${extra.brand} products`;
  if (extra.category) return `in the ${extra.category} category`;

  return null;
}

function timePhrase(intent: HelpAskIntent): string {
  const preset = HELP_TIME_PRESETS.find((p) => p.id === intent.time_range.preset);
  if (preset && preset.id !== "custom") return `over ${preset.label.toLowerCase()}`;
  if (intent.time_range.from === intent.time_range.to) {
    return `on ${intent.time_range.from}`;
  }
  return `from ${intent.time_range.from} to ${intent.time_range.to}`;
}

function groupingPhrase(intent: HelpAskIntent): string | null {
  const parts: string[] = [];
  if (intent.limit && intent.limit > 0) {
    parts.push(`show me the top ${intent.limit}`);
  }
  if (intent.group_by) {
    const label = GROUP_BY_LABELS[intent.group_by] ?? `by ${intent.group_by}`;
    parts.push(`grouped ${label.toLowerCase()}`);
  }
  return parts.length ? parts.join(", ") : null;
}

/** Build a natural-language question locally — no OpenAI call required. */
export function formatHelpAskQuestion(intent: HelpAskIntent): string {
  const roleLabel = HELP_ROLE_CARDS.find((r) => r.id === intent.operating_role)?.label ?? "stores";
  const topicLabel = humanizeTopic(intent.topic, intent.operating_role);
  const metricLabel = intent.metric_label ?? intent.metric?.replace(/_/g, " ");
  const location = locationPhrase(intent);
  const product = productPhrase(intent);
  const time = timePhrase(intent);
  const grouping = groupingPhrase(intent);

  const subject = metricLabel
    ? `${metricLabel} for ${topicLabel.toLowerCase()}`
    : topicLabel.toLowerCase();

  let question = `Show me ${subject} ${location}`;

  if (product) {
    question += ` ${product}`;
  }

  question += ` ${time}`;

  if (grouping) {
    question += `, ${grouping}`;
  }

  question += `.`;

  // Light role context when useful for Ask Aislix disambiguation.
  if (intent.operating_role !== "supermarket") {
    question = question.replace(
      /\.$/,
      ` across my ${roleLabel.toLowerCase()} scope.`,
    );
  }

  return question.replace(/\s+/g, " ").trim();
}
