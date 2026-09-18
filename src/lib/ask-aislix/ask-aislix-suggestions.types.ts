/** Operating-model tags for suggestion metadata (not permission scopes). */
export type SuggestionRole =
  | "supermarket"
  | "fmcg"
  | "distributor"
  | "local"
  | "darkstore"
  | "warehouse"
  | "universal";

export type SuggestionCategory =
  | "evidence"
  | "trend"
  | "inventory"
  | "expiry"
  | "findings"
  | "actions"
  | "comparison"
  | "audit"
  | "stores"
  | "recurring";

export type SuggestionIcon =
  | "image"
  | "trend"
  | "inventory"
  | "expiry"
  | "findings"
  | "actions"
  | "comparison"
  | "audit"
  | "stores"
  | "recurring";

export type AskAislixSuggestionItem = {
  id: string;
  text: string;
  roles: SuggestionRole[];
  category: SuggestionCategory;
  icon: SuggestionIcon;
  /** Ask Aislix tools that must exist and be wired for this example. */
  requiredTools: string[];
};

export type ResolvedAskSuggestion = {
  id: string;
  text: string;
  icon: SuggestionIcon;
  category: SuggestionCategory;
};
