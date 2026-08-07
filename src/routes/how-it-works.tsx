import { createFileRoute, redirect } from "@tanstack/react-router";

/** Marketing alias — the process walkthrough lives on the home page. */
export const Route = createFileRoute("/how-it-works")({
  beforeLoad: () => {
    throw redirect({ to: "/", hash: "how" });
  },
});
