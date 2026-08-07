import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resendVerificationEmail, verifyEmail } from "@/lib/account";

export const Route = createFileRoute("/verify-email")({
  validateSearch: (search: Record<string, unknown>): { token?: string; email?: string } => {
    const token = search['token'];
    const email = search['email'];
    return {
      ...(typeof token === "string" && token ? { token } : {}),
      ...(typeof email === "string" && email ? { email } : {}),
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
      { property: "og:description", content: "Activate your Aislix workspace by verifying your email." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { token: tokenFromLink, email } = Route.useSearch();
  const navigate = useNavigate();
  const [token, setToken] = useState(tokenFromLink ?? "");

  const verify = useMutation({
    mutationFn: () => verifyEmail({ token }),
    onSuccess: () => {
      toast.success("Email verified", { description: "Your workspace is ready." });
      navigate({ to: "/dashboard" });
    },
    onError: (error: Error) => toast.error("Verification failed", { description: error.message }),
  });

  const resend = useMutation({
    mutationFn: () => resendVerificationEmail({ email: email ?? "" }),
    onSuccess: () => toast.success("Verification email sent"),
    onError: (error: Error) => toast.error("Could not resend email", { description: error.message }),
  });

  return (
    <AuthLayout
      title="Verify your email"
      subtitle={
        email
          ? `We sent a verification code to ${email}. Enter it below to activate your workspace.`
          : "Enter the verification code from your email to activate your workspace."
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
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (token) verify.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="token">Verification code</Label>
          <Input
            id="token"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste the code from your email"
            className="h-11 rounded-xl"
          />
        </div>
        <Button
          type="submit"
          variant="brand"
          size="lg"
          className="w-full"
          disabled={verify.isPending || !token}
        >
          {verify.isPending ? "Verifying…" : "Verify email"}
        </Button>
        <Button
          type="button"
          variant="subtle"
          size="lg"
          className="w-full"
          disabled={resend.isPending || !email}
          onClick={() => resend.mutate()}
        >
          {resend.isPending ? "Sending…" : "Resend verification email"}
        </Button>
        <Button asChild variant="ghost" size="lg" className="w-full" type="button">
          <Link to="/login">Back to log in</Link>
        </Button>
      </form>
    </AuthLayout>
  );
}
