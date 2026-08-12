import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { resetPassword } from "@/lib/account";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>): { token?: string } => {
    const token = search['token'] ?? search['token_hash'] ?? search['code'];
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

type LinkState = "checking" | "ready" | "expired";

function ResetPasswordPage() {
  const { token: tokenFromLink } = Route.useSearch();
  const navigate = useNavigate();
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  // The recovery link signs the user in (hash tokens or ?token_hash=). Resolve
  // that session here so the form never asks for a code the email never sent.
  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setLinkState("ready");
        return;
      }

      if (tokenFromLink) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenFromLink,
          type: "recovery",
        });
        if (cancelled) return;
        setLinkState(error ? "expired" : "ready");
        return;
      }

      setLinkState("expired");
    };

    // Give the Supabase client a moment to consume the URL hash on first paint.
    const timer = setTimeout(() => void resolve(), 400);
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !cancelled) setLinkState("ready");
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, [tokenFromLink]);

  const mutation = useMutation({
    mutationFn: () => resetPassword({ token: tokenFromLink ?? "", new_password: password }),
    onSuccess: () => {
      toast.success("Password updated", { description: "Log in with your new password." });
      navigate({ to: "/login" });
    },
    onError: (error: Error) => toast.error("Reset failed", { description: error.message }),
  });

  const mismatch = confirm.length > 0 && confirm !== password;
  const tooShort = password.length > 0 && password.length < 8;

  return (
    <AuthLayout
      title="Set a new password"
      subtitle={
        linkState === "expired"
          ? "This reset link is no longer valid."
          : "Choose a new password for your Aislix account."
      }
      footer={
        <>
          Need a new link?{" "}
          <Link to="/forgot-password" className="font-medium text-brand hover:underline">
            Request another
          </Link>
        </>
      }
    >
      {linkState === "checking" && (
        <p className="text-sm text-muted-foreground">Verifying your reset link…</p>
      )}

      {linkState === "expired" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Your password reset link has expired or was already used. Request a new link and open it
            from the same browser.
          </div>
          <Button asChild variant="brand" size="lg" className="w-full">
            <Link to="/forgot-password">Send a new reset link</Link>
          </Button>
          <Button asChild variant="subtle" size="lg" className="w-full">
            <Link to="/login">Back to log in</Link>
          </Button>
        </div>
      )}

      {linkState === "ready" && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!mismatch && !tooShort && password) mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-11 rounded-xl"
            />
            {tooShort && (
              <p className="text-xs text-destructive">Use at least 8 characters.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
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
            disabled={mutation.isPending || mismatch || tooShort || !password}
          >
            {mutation.isPending ? "Updating…" : "Update password"}
          </Button>
          <Button asChild variant="subtle" size="lg" className="w-full" type="button">
            <Link to="/login">Back to log in</Link>
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
