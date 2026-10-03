import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { logout } from "@/lib/api/auth";

export const Route = createFileRoute("/logout")({
  head: () => ({ meta: [{ title: "Signing out — Aislix" }] }),
  component: LogoutPage,
});

function LogoutPage() {
  const navigate = useNavigate();
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    let cancelled = false;
    void logout()
      .catch(() => undefined)
      .finally(() => {
        if (cancelled) return;
        queryClient.clear();
        void navigate({ to: "/login", replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, queryClient]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
      Signing out…
    </div>
  );
}
