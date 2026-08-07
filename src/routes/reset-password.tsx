import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/lib/account";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>): { token?: string } => {
    const token = search['token'];
    return typeof token === "string" && token ? { token } : {};
  },
  head: () => ({
    meta: [
      { title: "Set a new password — Aislix" },
      {
        name: "description",
        content: "Choose a new password to regain access to your Aislix shelf intelligence workspace.",
      },
      { property: "og:title", content: "Set a new password — Aislix" },
      { property: "og:description", content: "Complete your Aislix password reset." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token: tokenFromLink } = Route.useSearch();
  const navigate = useNavigate();
  const [token, setToken] = useState(tokenFromLink ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const mutation = useMutation({
    mutationFn: () => resetPassword({ token, new_password: password }),
    onSuccess: () => {
      toast.success("Password updated", { description: "Log in with your new password." });
      navigate({ to: "/login" });
    },
    onError: (error: Error) => toast.error("Reset failed", { description: error.message }),
  });

  const mismatch = confirm.length > 0 && confirm !== password;

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Paste the code from your reset email and choose a new password."
      footer={
        <>
          Need a new link?{" "}
          <Link to="/forgot-password" className="font-medium text-brand hover:underline">
            Request another
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!mismatch && token && password) mutation.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="token">Reset code</Label>
          <Input
            id="token"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste the code from your email"
            className="h-11 rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="h-11 rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input
            id="confirm"
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            className="h-11 rounded-xl"
          />
          {mismatch && <p className="text-xs text-destructive">Passwords do not match.</p>}
        </div>
        <Button
          type="submit"
          variant="brand"
          size="lg"
          className="w-full"
          disabled={mutation.isPending || mismatch || !token || !password}
        >
          {mutation.isPending ? "Updating…" : "Update password"}
        </Button>
        <Button asChild variant="subtle" size="lg" className="w-full" type="button">
          <Link to="/login">Back to log in</Link>
        </Button>
      </form>
    </AuthLayout>
  );
}
