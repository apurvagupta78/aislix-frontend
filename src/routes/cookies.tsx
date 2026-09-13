import { createFileRoute } from "@tanstack/react-router";
import { LegalDoc } from "@/components/legal/LegalDoc";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { property: "og:url", content: "https://aislix.com/cookies" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Cookie Policy — Aislix" },
      {
        name: "description",
        content:
          "The cookies Aislix uses: essential authentication cookies, analytics, functional preferences, and how to change your cookie preferences.",
      },
      { property: "og:title", content: "Aislix Cookie Policy" },
      {
        property: "og:description",
        content: "Essential, analytics and functional cookies, plus how to manage preferences.",
      },
      
      
    ],
    links: [{ rel: "canonical", href: "https://aislix.com/cookies" }],
  }),
  component: () => (
    <LegalDoc
      title="Cookie Policy"
      updated="1 August 2026"
      intro="Aislix uses a small number of cookies and equivalent browser storage to keep you signed in, remember your workspace preferences and understand how the product is used. This page lists each category and how to control it."
      sections={[
        {
          heading: "Essential cookies",
          body: [
            "These cannot be switched off because the platform cannot operate without them.",
          ],
          bullets: [
            "Session and refresh tokens that keep you authenticated in your workspace.",
            "CSRF and security tokens that protect form submissions.",
            "Load-balancing and rate-limit identifiers used to keep the service stable.",
          ],
        },
        {
          heading: "Analytics cookies",
          body: [
            "Optional. Aggregated, first-party product analytics tell us which screens are used, where audits fail and where the interface causes friction. We do not build advertising profiles and we do not sell analytics data.",
          ],
        },
        {
          heading: "Functional cookies",
          body: [
            "Optional. These remember choices that make the product comfortable to use.",
          ],
          bullets: [
            "Light, dark or system appearance preference.",
            "Selected store, date range and dashboard filters.",
            "Sidebar collapsed state and table density.",
            "Dismissed onboarding hints and banners.",
          ],
        },
        {
          heading: "Cookie preferences",
          body: [
            "You can accept or reject optional cookies at any time; essential cookies remain active. Rejecting analytics and functional cookies does not limit any shelf-auditing feature, but layout and filter preferences will reset between sessions.",
            "You can also clear or block cookies in your browser settings. Doing so signs you out and clears saved preferences. Questions about cookies: hello@aislix.com.",
          ],
        },
      ]}
    />
  ),
});
