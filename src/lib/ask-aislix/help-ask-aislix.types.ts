import { z } from "zod";

export const HELP_OPERATING_ROLES = [
  "supermarket",
  "fmcg_distributor",
  "local_store",
  "dark_store",
  "warehouse",
] as const;

export type HelpOperatingRole = (typeof HELP_OPERATING_ROLES)[number];

export const HelpAskIntentSchema = z.object({
  operating_role: z.enum(HELP_OPERATING_ROLES),
  topic: z.string().min(1),
  locations: z.object({
    scope: z.enum(["all_my_locations", "specific"]),
    country: z.string().optional(),
    city: z.string().optional(),
    store_ids: z.array(z.string().uuid()).optional(),
    store_names: z.array(z.string()).optional(),
  }),
  product_scope: z
    .object({
      mode: z.enum([
        "all",
        "category",
        "brand",
        "sku",
        "item_code",
        "product_name",
        "variant",
        "batch",
      ]),
      category: z.string().optional(),
      brand: z.string().optional(),
      sku: z.string().optional(),
      item_code: z.string().optional(),
      product_name: z.string().optional(),
      variant: z.string().optional(),
      batch: z.string().optional(),
    })
    .optional(),
  metric: z.string().optional(),
  metric_label: z.string().optional(),
  time_range: z.object({
    preset: z.string(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  group_by: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  optional_filters: z.record(z.string()).optional(),
});

export type HelpAskIntent = z.infer<typeof HelpAskIntentSchema>;

export type HelpAskAuthorizedOptions = {
  stores: Array<{ id: string; name: string; city: string | null; country: string | null }>;
  countries: string[];
  cities: string[];
  categories: string[];
  canViewAllLocations: boolean;
};

export type HelpAskQuestionResult = {
  ok: boolean;
  question: string;
  validatedIntent?: HelpAskIntent;
  error?: string;
};
