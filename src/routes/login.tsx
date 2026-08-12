import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/api/auth";
import { goToAuthRoute, isEmailVerifiedServer, resolvePostAuthRoute } from "@/lib/auth-routing";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";
import { toUserMessage } from "@/lib/api/errors";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — Aislix Shelf Intelligence" },
      { name: "description", content: "Log in to your Aislix workspace to run and review AI shelf audits." },
      { property: "og:title", content: "Log in — Aislix" },
      { property: "og:description", content: "Access your Aislix retail shelf intelligence workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const signIn = useMutation({
    mutationFn: () => login({ email, password }),
    onSuccess: async () => {
      if (!(await isEmailVerifiedServer())) {
        navigate({ to: "/verify-email", search: { email: email.trim() }, replace: true });
        return;
      }
      toast.success("Welcome back");
      goToAuthRoute(navigate as never, await resolvePostAuthRoute());
    },
    onError: (error: unknown) =>
      toast.error("Could not sign in", { description: toUserMessage(error) }),
  });

  const disabled = signIn.isPending || email.trim().length === 0 || password.length === 0;

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to continue auditing your shelves."
      footer={
        <>
          New to Aislix?{" "}
          <Link to="/signup" className="font-medium text-brand hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled) signIn.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            className="h-11 rounded-xl"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className="h-11 rounded-xl"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-end pt-1">
          <Link to="/forgot-password" className="text-sm text-brand hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button variant="brand" size="lg" className="w-full" type="submit" disabled={disabled}>
          {signIn.isPending ? "Signing in…" : "Log in"}
        </Button>
      </form>
      <div className="mt-5">
        <SocialAuthButtons />
      </div>
    </AuthLayout>
  );
}
