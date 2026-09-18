import type { HelpAskIntent } from "@/lib/ask-aislix/help-ask-aislix.types";

/** Normalize validated wizard intent into a clear payload for the Question Builder. */
export function buildQuestionBuilderPayload(intent: HelpAskIntent) {
  return {
    operating_model: intent.operating_role,
    operating_context: intent.operating_context,
    user_role: intent.user_role,
    user_context: intent.user_context,
    topic: intent.topic,
    topic_label: intent.topic_label,
    ...(intent.topic_custom ? { topic_custom: intent.topic_custom } : {}),
    location: {
      scope:
        intent.locations.scope === "all_my_locations"
          ? "all_authorized_locations"
          : "specific",
      ...(intent.locations.country ? { country: intent.locations.country } : {}),
      ...(intent.locations.city ? { city: intent.locations.city } : {}),
      ...(intent.locations.store_names?.length
        ? { stores: intent.locations.store_names }
        : {}),
    },
    ...(intent.metric ? { metric: intent.metric, metric_label: intent.metric_label } : {}),
    ...(intent.group_by ? { group_by: intent.group_by } : {}),
    ...(intent.limit && intent.limit > 0 ? { limit: intent.limit } : {}),
    time_period: {
      label: intent.time_range.label,
      from: intent.time_range.from,
      to: intent.time_range.to,
    },
    ...(intent.product_scope ? { product_scope: intent.product_scope } : {}),
    ...(intent.optional_filters ? { filters: intent.optional_filters } : {}),
    ...(intent.custom_user_request ? { custom_user_request: intent.custom_user_request } : {}),
  };
}
