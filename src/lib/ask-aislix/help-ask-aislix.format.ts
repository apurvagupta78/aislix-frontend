import {
  GROUP_BY_LABELS,
  HELP_TIME_PRESETS,
  TOPICS_BY_ROLE,
} from "@/lib/ask-aislix/help-ask-aislix.config";
import type { HelpAskIntent } from "@/lib/ask-aislix/help-ask-aislix.types";

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

  if (scope.brand) return `for ${scope.brand}`;
  if (scope.category) return `in the ${scope.category} category`;
  if (scope.sku) return `for SKU ${scope.sku}`;
  if (scope.item_code) return `for item code ${scope.item_code}`;
  if (scope.product_name) return `for ${scope.product_name}`;
  if (scope.variant) return `for ${scope.variant} variants`;
  if (scope.batch) return `for batch ${scope.batch}`;

  const extra = intent.optional_filters ?? {};
  if (extra.brand) return `for ${extra.brand}`;
  if (extra.category) return `in the ${extra.category} category`;

  return null;
}

function groupingPhrase(intent: HelpAskIntent): string | null {
  const parts: string[] = [];
  if (intent.limit && intent.limit > 0 && !intent.custom_user_request?.trim()) {
    parts.push(`show me the top ${intent.limit}`);
  }
  if (intent.group_by) {
    const label = GROUP_BY_LABELS[intent.group_by] ?? `by ${intent.group_by}`;
    parts.push(`broken down ${label.toLowerCase()}`);
  }
  return parts.length ? parts.join(", ") : null;
}

/** Local fallback when OpenAI question builder is unavailable. */
export function formatHelpAskQuestion(intent: HelpAskIntent): string {
  const topicLabel =
    intent.topic_label ||
    TOPICS_BY_ROLE[intent.operating_role].find((t) => t.id === intent.topic)?.label ||
    intent.topic.replace(/_/g, " ");
  const metricLabel = intent.metric_label ?? intent.metric?.replace(/_/g, " ");
  const location = locationPhrase(intent);
  let product = productPhrase(intent);
  if (!product && intent.optional_filters?.brand) {
    product = `for ${intent.optional_filters.brand}`;
  } else if (!product && intent.optional_filters?.category) {
    product = `in the ${intent.optional_filters.category} category`;
  }
  const time = intent.time_range.label.toLowerCase();
  const grouping = groupingPhrase(intent);

  const subject = metricLabel
    ? `${metricLabel.toLowerCase()} for ${topicLabel.toLowerCase()}`
    : topicLabel.toLowerCase();

  const custom = intent.custom_user_request?.trim();

  if (custom) {
    let question = `${intent.user_context.replace(/\.$/, "")}, ${custom.replace(/\.$/, "")}`;
    if (location !== "across my authorized locations") {
      question += ` (${location})`;
    }
    question += ` over ${time}`;
    if (grouping) question += `, ${grouping}`;
    return `${question.replace(/\s+/g, " ").trim()}.`;
  }

  let question = `${intent.user_context.replace(/\.$/, "")}, show me ${subject} ${location}`;

  if (product) {
    question += ` ${product}`;
  }

  question += ` over ${time}`;

  if (grouping) {
    question += `, ${grouping}`;
  }

  return `${question.replace(/\s+/g, " ").trim()}.`;
}
