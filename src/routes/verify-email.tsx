import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { logout, resendVerificationEmail } from "@/lib/api/auth";
import {
  fetchAuthUser,
  fetchPendingInvite,
  goToAuthRoute,
  isEmailVerifiedServer,
  resolvePostAuthRoute,
} from "@/lib/auth-routing";

export const Route = createFileRoute("/verify-email")({
  validateSearch: (search: Record<string, unknown>): { email?: string; invited?: boolean; org?: string } => {
    const email = search["email"];
    const invited = search["invited"];
    const org = search["org"];
    return {
      ...(typeof email === "string" && email ? { email } : {}),
      ...(invited === true || invited === "1" || invited === "true" ? { invited: true } : {}),
      ...(typeof org === "string" && org ? { org } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Verify your email — Aislix" },
      {
        name: "description",
        content: "Confirm your email address to activate your Aislix shelf intelligence workspace.",
      },
      { property: "og:title", content: "Verify your email — Aislix" },
      {
        property: "og:description",
        content: "Activate your Aislix workspace by verifying your email.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { email: emailFromLink, invited } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState(emailFromLink ?? "");
  const [cooldown, setCooldown] = useState(0);
  const [inviteOrg, setInviteOrg] = useState<string | null>(null);
  const isInvited = Boolean(invited) || Boolean(inviteOrg);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const pending = await fetchPendingInvite().catch(() => null);
      if (!cancelled && pending) setInviteOrg(pending.org_name);
    })();
    return () => {
      cancelled = true;
    };
  }, []);


  // This page NEVER redirects on its own except when the email is confirmed
  // (server-side truth). A pending signup has no session — staying put is
  // correct; AuthGate blocks leaving while unverified.
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const user = await fetchAuthUser();
      if (cancelled) return;
      if (user?.email) setEmail(user.email);
      if (!user) return;
      if (await isEmailVerifiedServer()) {
        const route = await resolvePostAuthRoute();
        if (!cancelled) goToAuthRoute(navigate as never, route);
      }
    };
    void check();
    // Poll only to detect email_confirmed_at flipping in another tab.
    const timer = window.setInterval(() => void check(), 10000);
    const { data } = supabase.auth.onAuthStateChange(() => void check());
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      data.subscription.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const resend = useMutation({
    mutationFn: () => resendVerificationEmail({ email }),
    onSuccess: () => {
      toast.success("Verification email sent again.");
      setCooldown(60);
    },
    onError: (error: Error) =>
      toast.error("Could not resend the email", { description: error.message }),
  });

  const signOut = useMutation({
    mutationFn: () => logout(),
    onSuccess: () => navigate({ to: "/login", replace: true }),
  });

  return (
    <AuthLayout
      title={isInvited ? "Verify your email to join the team" : "Verify your email"}
      subtitle={
        isInvited
          ? "Confirm your email address and you'll join the workspace automatically."
          : "One quick step before your workspace opens."
      }
      footer={
        <>
          Wrong address?{" "}
          <Link to="/signup" className="font-medium text-brand hover:underline">
            Sign up again
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/40 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
            <MailCheck className="size-5" />
          </span>
          <div className="space-y-1">
            {isInvited ? (
              <p className="text-sm text-foreground">
                You were invited to{" "}
                <strong className="font-semibold">{inviteOrg || "an Aislix workspace"}</strong> on
                Aislix. We sent a confirmation email to{" "}
                <strong className="font-semibold">{email || "your email address"}</strong>. Click
                the &ldquo;Confirm your signup&rdquo; link to activate your account — then you&apos;ll
                join the workspace automatically.
              </p>
            ) : (
              <p className="text-sm text-foreground">
                A verification email has been sent to{" "}
                <strong className="font-semibold">{email || "your email address"}</strong>. Please
                check your inbox and click the verification link to continue.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Didn&apos;t get it? Check spam, or click Resend below.
            </p>
          </div>
        </div>


        <Button
          type="button"
          variant="brand"
          size="lg"
          className="w-full"
          disabled={resend.isPending || !email || cooldown > 0}
          onClick={() => resend.mutate()}
        >
          {resend.isPending
            ? "Sending…"
            : cooldown > 0
              ? `Resend available in ${cooldown}s`
              : "Resend verification email"}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="w-full"
          disabled={signOut.isPending}
          onClick={() => signOut.mutate()}
        >
          Sign out
        </Button>
      </div>
    </AuthLayout>
  );
}
