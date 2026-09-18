import { z } from "zod";

export const ASK_AISLIX_VISUAL_TYPES = [
  "kpi",
  "bar",
  "line",
  "donut",
  "area",
  "ranking",
  "progress",
  "timeline",
  "table",
  "image_gallery",
  "none",
] as const;

export type AskAislixVisualType = (typeof ASK_AISLIX_VISUAL_TYPES)[number];

export const AskAislixMetricSchema = z.object({
  label: z.string(),
  value: z.string(),
  unit: z.string().optional().default(""),
  trend: z.enum(["up", "down", "flat", "none"]).optional().default("none"),
});

export const AskAislixVisualSchema = z.object({
  type: z.enum(ASK_AISLIX_VISUAL_TYPES),
  title: z.string().optional().default(""),
  data: z.array(z.record(z.unknown())).optional().default([]),
});

export const AskAislixTableSchema = z.object({
  columns: z.array(z.string()).optional().default([]),
  rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))).optional().default([]),
});

export const AskAislixActionSchema = z.object({
  label: z.string(),
  route: z.string(),
  params: z.record(z.string()).optional().default({}),
});

export const AskAislixSourceContextSchema = z.object({
  period: z.string().optional().default(""),
  locations: z.array(z.string()).optional().default([]),
  operating_model: z.string().optional(),
});

/** Model output — signed image URLs are injected server-side after validation. */
export const AskAislixResponseSchema = z.object({
  answer: z.string(),
  summary: z.string().optional().default(""),
  metrics: z.array(AskAislixMetricSchema).optional().default([]),
  visual: AskAislixVisualSchema.optional().default({ type: "none", title: "", data: [] }),
  table: AskAislixTableSchema.optional().default({ columns: [], rows: [] }),
  insights: z.array(z.string()).optional().default([]),
  actions: z.array(AskAislixActionSchema).optional().default([]),
  source_context: AskAislixSourceContextSchema.optional().default({ period: "", locations: [] }),
  follow_up_questions: z.array(z.string()).optional().default([]),
});

export type AskAislixResponse = z.infer<typeof AskAislixResponseSchema>;

export type AskAislixMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AskAislixAttachmentInput = {
  name: string;
  mimeType: string;
  dataBase64: string;
  size: number;
};

export type AskAislixRequest = {
  question: string;
  activeOrgId: string;
  messages?: AskAislixMessage[];
  conversationId?: string;
  attachments?: AskAislixAttachmentInput[];
  /** Owner preview toggle — server validates against allowlisted email. */
  previewDemo?: boolean;
};

export type AskAislixAccessScope = {
  orgId: string;
  userId: string;
  role: string;
  allowedStoreIds: string[];
  allowedCities: string[];
  allowedCountries: string[];
  isOrgAdmin: boolean;
  isManager: boolean;
  /** Assignments where user is assignee or assigner. */
  accessibleAssignmentIds: string[];
  accessibleScanIds: string[];
  /** Assignments explicitly assigned to this user (assignee_id). */
  assignedToUserAssignmentIds: string[];
  /** Scans conducted by this user (shelf_scans.created_by / finalized_by). */
  conductedScanIds: string[];
  /** Assignments linked to conducted scans. */
  conductedAssignmentIds: string[];
  /** When true, responses must be prefixed as demo data. */
  labeledDemo?: boolean;
  /** User's real org (may differ from orgId when viewing showcase data). */
  activeOrgId?: string;
};

export type VisionAsset = {
  scanId: string;
  caption: string;
  mimeType: string;
  base64: string;
};

export type ImageGalleryItem = {
  evidenceId: string;
  scanId: string;
  assignmentId?: string;
  storageBucket: string;
  storagePath: string;
  caption: string;
  capturedAt: string;
  storeName?: string;
  url?: string;
};

export type ToolResult = {
  available: boolean;
  reason?: string;
  data?: unknown;
  /** Pending images — signed after model response, not sent to OpenAI. */
  pendingImages?: ImageGalleryItem[];
  /** Vision assets for Luna analysis — injected before finalize, not in tool JSON. */
  visionImages?: VisionAsset[];
};

export const OUT_OF_SCOPE_MESSAGE =
  "I can help you analyze Aislix retail audit and operations data. Try asking about audits, inventory, expiry, stores, findings, evidence, corrective actions, compliance or performance.";

export const ACCESS_DENIED_MESSAGE =
  "I don't have access to that store or audit under your account.";
