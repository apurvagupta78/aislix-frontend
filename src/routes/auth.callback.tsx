import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ensureOAuthWorkspace } from "@/lib/api/auth";
import { goToAuthRoute, resolvePostAuthRoute } from "@/lib/auth-routing";
import { convertLandingSession, loadLandingSessionId } from "@/lib/landing-audit-api";


export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [
      { title: "Confirming your email — Aislix" },
      {
        name: "description",
        content: "Finishing email confirmation for your Aislix workspace.",
      },
      { property: "og:title", content: "Confirming your email — Aislix" },
      { property: "og:description", content: "Finishing email confirmation for Aislix." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      // The Supabase client parses the link's hash / code on load.
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;
      if (error || !data.session) {
        toast.error("Verification link expired. Sign in to resend.");
        void navigate({ to: "/login", replace: true });
        return;
      }
      const landingSessionId = loadLandingSessionId();
      if (landingSessionId && data.session.user?.id) {
        // Best-effort landing-demo attribution; failures never block auth.
        void convertLandingSession(landingSessionId, data.session.user.id);
      }
      try {
        await ensureOAuthWorkspace();
      } catch {
        // workspace creation is retried on the next authenticated read
      }
      await supabase.auth.getUser();

      const route = await resolvePostAuthRoute();
      if (!cancelled) goToAuthRoute(navigate as never, route);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="size-6 animate-spin text-brand" />
        <h1 className="text-base font-semibold tracking-tight">Confirming your email…</h1>
        <p className="text-sm text-muted-foreground">This only takes a moment.</p>
      </div>
    </main>
  );
}
