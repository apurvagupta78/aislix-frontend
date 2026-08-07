import { createFileRoute, redirect } from "@tanstack/react-router";

/** Marketing alias — capability breakdown lives on the home page. */
export const Route = createFileRoute("/features")({
  beforeLoad: () => {
    throw redirect({ to: "/", hash: "platform" });
  },
});
