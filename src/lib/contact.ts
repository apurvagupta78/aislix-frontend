// Contact / enquiry backend contract. Enquiries will be persisted in Supabase
// and emailed to hello@aislix.com by the FastAPI service on Railway. No email
// sending happens client-side and nothing is faked here.

import { api } from "./api/client";

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

/** POST /contact/enquiries — stores the enquiry and emails {@link ENQUIRY_INBOX}. */
export function submitEnquiry(input: EnquiryInput): Promise<EnquiryResponse> {
  return api.post<EnquiryResponse>(
    "/contact/enquiries",
    { ...input, deliver_to: ENQUIRY_INBOX },
    { anonymous: true },
  );
}

/** POST /contact/demo — books a demo slot request for the sales team. */
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
