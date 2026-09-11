import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { checkPlatformAdminAccess } from "@/lib/platform-admin.functions";
import { ErrorState } from "@/components/States";

export function PlatformAdminGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const verify = useServerFn(checkPlatformAdminAccess);
  const query = useQuery({
    queryKey: ["platform-admin-access"],
    queryFn: () => verify({ data: {} }),
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (query.isError) {
      void navigate({ to: "/admin/login", replace: true });
    }
  }, [query.isError, navigate]);

  if (query.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-brand" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Admin access required"
        description={
          query.error instanceof Error ? query.error.message : "Sign in with a platform admin account."
        }
      />
    );
  }

  return <>{children}</>;
}
