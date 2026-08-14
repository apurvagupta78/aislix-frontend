import { createFileRoute } from "@tanstack/react-router";
import { LegalDoc } from "@/components/legal/LegalDoc";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { property: "og:url", content: "https://aislix.com/help" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Help & Backend Setup — Aislix" },
      {
        name: "description",
        content:
          "Find your SUPABASE_URL, understand how Aislix connects to backend services, and how service-role access is kept secure on Lovable Cloud.",
      },
      { property: "og:title", content: "Aislix Help & Backend Setup" },
      {
        property: "og:description",
        content:
          "Where to find your Supabase URL and how backend service access is handled securely.",
      },
    ],
    links: [{ rel: "canonical", href: "https://aislix.com/help" }],
  }),
  component: () => (
    <LegalDoc
      title="Help & Backend Setup"
      updated="14 August 2026"
      intro="This page explains how to locate your project's Supabase URL and how Aislix handles secure backend service access on Lovable Cloud."
      sections={[
        {
          heading: "Where to find SUPABASE_URL",
          body: [
            "Your Supabase project URL is the endpoint that connects the Aislix frontend to the Lovable Cloud database, auth and storage services.",
            "It is available in two places in your project:",
          ],
          bullets: [
            "In the .env file at the project root: look for SUPABASE_URL or VITE_SUPABASE_URL.",
            "In Project Settings → Backend: the public URL of your connected Lovable Cloud backend is listed under the Supabase connection details.",
          ],
        },
        {
          heading: "What SUPABASE_URL looks like",
          body: [
            "The URL follows this pattern:",
            "https://<project-ref>.supabase.co",
            "The project reference is a short random string. The full URL is the same value stored in VITE_SUPABASE_URL so the browser client can reach the database.",
          ],
        },
        {
          heading: "SUPABASE_SERVICE_ROLE_KEY",
          body: [
            "The service role key has full admin access to your backend and bypasses Row Level Security. For security reasons, it is not available for export or viewing in Lovable Cloud projects.",
            "You do not need to copy it into your code. If your application needs to perform admin operations, use a server function and import the supabaseAdmin client from the generated server integration. The platform injects the service role key at runtime inside the secure server environment only.",
          ],
        },
        {
          heading: "How backend access is handled securely",
          body: [
            "Aislix separates public browser code from privileged backend code using TanStack Start server functions.",
          ],
          bullets: [
            "Browser requests use the publishable (anon) key with Row Level Security policies, so users can only read or write their own workspace data.",
            "Privileged actions run in createServerFn handlers that execute only on the server. The service role key is read from environment variables inside these handlers and never reaches the browser.",
            "Server functions that need the current user's identity use the Supabase auth middleware, which validates the bearer token and runs queries with that user's RLS permissions.",
            "External AI and billing services are called from the server side, so API keys, webhooks and signing secrets are never exposed to the frontend.",
          ],
        },
        {
          heading: "Connecting to Railway FastAPI",
          body: [
            "The Aislix AI scan pipeline is powered by a Railway FastAPI backend. The frontend does not call it directly. Instead, the server function forwards images and metadata to the backend using the AISLIX_AI_API_URL configured in the project environment.",
            "This keeps scan credentials and any future API keys out of the browser bundle.",
          ],
        },
        {
          heading: "Need help?",
          body: [
            "If your project reports a missing Supabase environment variable, reconnect the backend in Project Settings, then rebind secrets. For other backend questions, email hello@aislix.com.",
          ],
        },
      ]}
    />
  ),
});
