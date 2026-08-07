import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarCheck, Clock, Mail, MapPin, Send } from "lucide-react";
import { MarketingPage } from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ENQUIRY_INBOX,
  SUPPORT_RESPONSE_TIME,
  countries,
  enquirySubjects,
  submitEnquiry,
  type EnquiryInput,
} from "@/lib/contact";

const searchSchema = z.object({ subject: z.string().optional() });

export const Route = createFileRoute("/contact")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Contact Aislix — Talk to our shelf intelligence team" },
      {
        name: "description",
        content:
          "Contact the Aislix team for sales, API access, support or a guided demo of AI shelf auditing. We reply within one business day.",
      },
      { property: "og:title", content: "Contact Aislix" },
      {
        property: "og:description",
        content: "Reach the Aislix team for demos, pricing, API access and enterprise rollouts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Contact,
});

const formSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(100),
  company: z.string().trim().min(2, "Enter your company name").max(120),
  email: z.string().trim().email("Enter a valid work email").max(255),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a reachable phone number")
    .max(20)
    .regex(/^[+0-9 ()-]+$/, "Phone can contain digits, spaces, +, - and ()"),
  country: z.string().trim().min(2, "Select your country"),
  subject: z.string().trim().min(2, "Select a subject").max(120),
  message: z.string().trim().min(20, "Tell us a little more (20+ characters)").max(2000),
});

const faqs = [
  {
    q: "How quickly will I hear back?",
    a: "Every enquiry reaches our team inbox immediately and we reply within one business day. Enterprise rollout requests are routed straight to a solutions engineer.",
  },
  {
    q: "Can I see Aislix on my own shelf photos?",
    a: "Yes. Book a demo and bring three to five shelf images from your stores — we run them live and walk through detections, share of shelf and out-of-stock alerts.",
  },
  {
    q: "Do you support multi-location retail groups?",
    a: "Enterprise includes unlimited stores and users, a multi-location dashboard, custom AI models, integrations and an SLA with a dedicated account manager.",
  },
  {
    q: "Is there an API for our own systems?",
    a: "Professional and Enterprise include REST API access so scans, inventory results and alerts can flow into your ERP, BI or replenishment tooling.",
  },
  {
    q: "Which regions and languages do you cover?",
    a: "Aislix is used across Indian retail today and supports international deployments. Detection works on packaging in English and major Indian scripts.",
  },
];

function Contact() {
  const { subject: presetSubject } = Route.useSearch();
  const [form, setForm] = useState<EnquiryInput>({
    name: "",
    company: "",
    email: "",
    phone: "",
    country: "India",
    subject: presetSubject ?? "Sales enquiry",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (values: EnquiryInput) => submitEnquiry({ ...values, source: "contact-page" }),
    onSuccess: () => {
      toast.success("Message sent", { description: `Our team will reply from ${ENQUIRY_INBOX}.` });
      setForm((f) => ({ ...f, message: "" }));
    },
    onError: (error: Error) =>
      toast.error("Could not send your message", {
        description: `${error.message} You can email us directly at ${ENQUIRY_INBOX}.`,
      }),
  });

  const set = (key: keyof EnquiryInput) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      const { [key]: _removed, ...rest } = e;
      return rest;
    });
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      toast.error("Please fix the highlighted fields");
      return;
    }
    mutation.mutate(parsed.data);
  };

  return (
    <MarketingPage>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16">
          <p className="text-xs font-medium uppercase tracking-widest text-brand">Contact</p>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Talk to the team behind Aislix shelf intelligence
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Whether you run one Kirana store or a national FMCG portfolio, tell us what you need to
            see on your shelves and we will show you exactly how Aislix delivers it.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-12 sm:px-8 lg:grid-cols-[1.5fr_1fr]">
        <form onSubmit={onSubmit} className="card-surface p-6 sm:p-8" noValidate>
          <h2 className="text-lg font-semibold tracking-tight">Send us a message</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Every enquiry is delivered to our team inbox at {ENQUIRY_INBOX}.
          </p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <FormField label="Name" error={errors['name']} htmlFor="name">
              <Input
                id="name"
                value={form.name}
                maxLength={100}
                autoComplete="name"
                onChange={(e) => set("name")(e.target.value)}
                placeholder="Ananya Sharma"
              />
            </FormField>
            <FormField label="Company name" error={errors['company']} htmlFor="company">
              <Input
                id="company"
                value={form.company}
                maxLength={120}
                autoComplete="organization"
                onChange={(e) => set("company")(e.target.value)}
                placeholder="Metro Retail Group"
              />
            </FormField>
            <FormField label="Work email" error={errors['email']} htmlFor="email">
              <Input
                id="email"
                type="email"
                value={form.email}
                maxLength={255}
                autoComplete="email"
                onChange={(e) => set("email")(e.target.value)}
                placeholder="ananya@company.com"
              />
            </FormField>
            <FormField label="Phone number" error={errors['phone']} htmlFor="phone">
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                maxLength={20}
                autoComplete="tel"
                onChange={(e) => set("phone")(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </FormField>
            <FormField label="Country" error={errors['country']} htmlFor="country">
              <Select value={form.country} onValueChange={set("country")}>
                <SelectTrigger id="country">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Subject" error={errors['subject']} htmlFor="subject">
              <Select value={String(form.subject)} onValueChange={set("subject")}>
                <SelectTrigger id="subject">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {enquirySubjects.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <div className="mt-5">
            <FormField label="Message" error={errors['message']} htmlFor="message">
              <Textarea
                id="message"
                rows={6}
                maxLength={2000}
                value={form.message}
                onChange={(e) => set("message")(e.target.value)}
                placeholder="Tell us about your store network, scan volume and what you want to measure on shelf."
              />
            </FormField>
            <p className="mt-2 text-xs text-muted-foreground">
              {form.message.trim().length}/2000 characters
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button type="submit" variant="brand" className="rounded-xl" disabled={mutation.isPending}>
              <Send className="size-4" />
              {mutation.isPending ? "Sending…" : "Send message"}
            </Button>
            <Button asChild variant="subtle" className="rounded-xl">
              <a href={`mailto:${ENQUIRY_INBOX}`}>
                <Mail className="size-4" /> Email us instead
              </a>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            By sending this form you agree to our{" "}
            <Link to="/privacy" className="text-brand hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </form>

        <div className="space-y-6">
          <div className="card-surface p-6">
            <h2 className="text-sm font-semibold tracking-tight">Reach us directly</h2>
            <ul className="mt-4 space-y-4">
              <li className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Mail className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">Business email</p>
                  <a href={`mailto:${ENQUIRY_INBOX}`} className="text-sm text-brand hover:underline">
                    {ENQUIRY_INBOX}
                  </a>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Clock className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">Response time</p>
                  <p className="text-sm text-muted-foreground">{SUPPORT_RESPONSE_TIME}</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                  <MapPin className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">Office</p>
                  <p className="text-sm text-muted-foreground">
                    Aislix Technologies — India. Full address published once our office opens.
                  </p>
                </div>
              </li>
            </ul>
            <Button asChild variant="brand" className="mt-6 w-full rounded-xl">
              <Link to="/contact" search={{ subject: "Book a demo" }}>
                <CalendarCheck className="size-4" /> Book a demo
              </Link>
            </Button>
          </div>

          <div className="card-surface overflow-hidden">
            <div className="relative grid h-52 place-items-center bg-brand-soft">
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, color-mix(in oklab, var(--brand) 18%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--brand) 18%, transparent) 1px, transparent 1px)",
                  backgroundSize: "34px 34px",
                }}
              />
              <div className="relative text-center">
                <span className="mx-auto grid size-11 place-items-center rounded-xl bg-card text-brand shadow-soft">
                  <MapPin className="size-5" />
                </span>
                <p className="mt-3 text-sm font-medium text-brand">Office map</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Google Maps embed reserved for our office location
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-16 sm:px-8">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Frequently asked</h2>
        <Accordion type="single" collapsible className="mt-5">
          {faqs.map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className="text-left text-sm font-medium">{f.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </MarketingPage>
  );
}

function FormField({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
