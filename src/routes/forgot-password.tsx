import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/account";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — Aislix" },
      {
        name: "description",
        content: "Request a secure password reset link for your Aislix shelf intelligence workspace.",
      },
      { property: "og:title", content: "Reset your password — Aislix" },
      {
        property: "og:description",
        content: "Request a password reset link for your Aislix account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");

  const mutation = useMutation({
    mutationFn: (value: string) => requestPasswordReset({ email: value }),
    onSuccess: () => toast.success("Reset link sent", { description: `Check ${email} for the link.` }),
    onError: (error: Error) => toast.error("Could not send reset link", { description: error.message }),
  });

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter your work email and we'll send you a secure reset link."
      footer={
        <>
          Remembered it?{" "}
          <Link to="/login" className="font-medium text-brand hover:underline">
            Back to log in
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (email) mutation.mutate(email);
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="h-11 rounded-xl"
          />
        </div>
        <Button
          type="submit"
          variant="brand"
          size="lg"
          className="w-full"
          disabled={mutation.isPending || !email}
        >
          {mutation.isPending ? "Sending…" : "Send reset link"}
        </Button>
        <Button asChild variant="subtle" size="lg" className="w-full" type="button">
          <Link to="/reset-password">I already have a reset code</Link>
        </Button>
      </form>
    </AuthLayout>
  );
}
