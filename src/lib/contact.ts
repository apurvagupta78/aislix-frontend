// Contact / enquiry backend contract. Enquiries are persisted directly in
// Supabase's contact_submissions table (anonymous inserts are allowed by RLS).

import { supabase } from "@/integrations/supabase/client";
import { getUser } from "@/lib/db/context";
import { ApiError } from "@/lib/api/errors";

export const ENQUIRY_INBOX = "hello@aislix.com";
export const SALES_INBOX = "sales@aislix.com";
export const SUPPORT_RESPONSE_TIME = "Within 1 business day (Mon–Fri, 10:00–19:00 IST)";

export const enquirySubjects = [
  "Sales enquiry",
  "Book a demo",
  "API access",
  "Documentation",
  "Help & support",
  "Billing question",
  "Partnership",
  "Other",
] as const;

export type EnquirySubject = (typeof enquirySubjects)[number] | string;

export type EnquiryInput = {
  name: string;
  company: string;
  email: string;
  phone: string;
  country: string;
  subject: EnquirySubject;
  message: string;
  /** Optional marketing attribution, e.g. the page the form was opened from. */
  source?: string;
};

export type EnquiryResponse = { id: string; received_at?: string; delivered_to?: string };

/** Inserts a real row into contact_submissions. */
export async function submitEnquiry(input: EnquiryInput): Promise<EnquiryResponse> {
  const user = await getUser().catch(() => null);
  const messageParts = [input.message, input.country ? `Country: ${input.country}` : null, input.source ? `Source: ${input.source}` : null].filter(
    Boolean,
  );

  const { data, error } = await supabase
    .from("contact_submissions")
    .insert({
      name: input.name,
      email: input.email,
      company: input.company || null,
      phone: input.phone || null,
      topic: input.subject,
      message: messageParts.join("\n\n"),
      user_id: user?.id ?? null,
    })
    .select("id, created_at")
    .single();

  if (error) {
    throw new ApiError({ message: error.message || "Could not submit your enquiry.", kind: "server", status: 500 });
  }

  return { id: data.id, received_at: data.created_at, delivered_to: ENQUIRY_INBOX };
}

/** Books a demo slot request for the sales team. */
export function requestDemo(input: EnquiryInput): Promise<EnquiryResponse> {
  return submitEnquiry({ ...input, subject: "Book a demo" });
}

export const countries = [
  "India",
  "United Arab Emirates",
  "Singapore",
  "United Kingdom",
  "United States",
  "Australia",
  "Canada",
  "Germany",
  "Saudi Arabia",
  "Other",
] as const;
