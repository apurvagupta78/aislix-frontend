import { createFileRoute, redirect } from "@tanstack/react-router";

/** Demo requests are handled by the contact form with a pre-filled subject. */
export const Route = createFileRoute("/demo")({
  beforeLoad: () => {
    throw redirect({ to: "/contact", search: { subject: "Book a demo" } });
  },
});
