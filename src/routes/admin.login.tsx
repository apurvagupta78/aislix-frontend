import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, Shield } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/api/auth";
import { isEmailVerifiedServer } from "@/lib/auth-routing";
import { checkPlatformAdminAccess } from "@/lib/platform-admin.functions";
import { toUserMessage } from "@/lib/api/errors";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Platform Admin — Aislix" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const verifyAdmin = useServerFn(checkPlatformAdminAccess);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const signIn = useMutation({
    mutationFn: async () => {
      await login({ email, password });
      if (!(await isEmailVerifiedServer())) {
        throw new Error("Verify your email before using the admin console.");
      }
      return verifyAdmin({
        data: adminPassword.trim() ? { adminPassword: adminPassword.trim() } : {},
      });
    },
    onSuccess: () => {
      toast.success("Admin access granted");
      void navigate({ to: "/admin", replace: true });
    },
    onError: (error: unknown) =>
      toast.error("Could not sign in", { description: toUserMessage(error) }),
  });

  const disabled =
    signIn.isPending || email.trim().length === 0 || password.length === 0;

  return (
    <AuthLayout
      title="Platform admin"
      subtitle="Sign in with your platform admin account to browse all workspaces, users and scans."
      footer={
        <>
          Not an admin?{" "}
          <Link to="/login" className="font-medium text-brand hover:underline">
            Regular login
          </Link>
        </>
      }
    >
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-brand/20 bg-brand-soft/40 px-3 py-2 text-xs text-muted-foreground">
        <Shield className="size-4 shrink-0 text-brand" />
        Access is limited to emails in <code className="text-foreground">platform_access_grants</code>.
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled) signIn.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="admin-email">Admin email</Label>
          <Input
            id="admin-email"
            type="email"
            autoComplete="email"
            placeholder="you@aislix.com"
            className="h-11 rounded-xl"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-password">Password</Label>
          <div className="relative">
            <Input
              id="admin-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="h-11 rounded-xl pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-console-password">Admin console password (if configured)</Label>
          <Input
            id="admin-console-password"
            type="password"
            autoComplete="off"
            placeholder="Optional extra gate"
            className="h-11 rounded-xl"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
          />
        </div>
        <Button type="submit" variant="brand" className="h-11 w-full rounded-xl" disabled={disabled}>
          {signIn.isPending ? "Signing in…" : "Sign in to admin"}
        </Button>
      </form>
    </AuthLayout>
  );
}
