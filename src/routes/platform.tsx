import { createFileRoute, redirect } from "@tanstack/react-router";

/** Marketing alias — the platform overview lives on the home page. */
export const Route = createFileRoute("/platform")({
  beforeLoad: () => {
    throw redirect({ to: "/", hash: "platform" });
  },
});
