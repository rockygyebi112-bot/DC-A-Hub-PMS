"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import { AuthCard } from "@/components/ui/auth-card";
import { AuthField } from "@/components/ui/auth-field";
import { AuthAlert } from "@/components/ui/auth-alert";

function ResetPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // After clicking the email link, /auth/callback exchanged the recovery code
  // for a session and redirected here. If there's no session, the link is
  // stale or already used — send the user back to forgot-password.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/forgot-password?error=link_expired");
        return;
      }
      setEmail(data.user.email ?? null);
      setChecking(false);
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    router.replace("/");
  }

  return (
    <AuthCard
      title="Set a new password"
      description="Choose a strong password to finish resetting your account"
      footer={
        <Link
          href="/login"
          className="font-medium text-muted-foreground hover:text-foreground"
        >
          Back to sign in
        </Link>
      }
    >
      {checking ? (
        <div className="flex justify-center py-8">
          <Spinner size="lg" label="Verifying your reset link" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {email && (
            <p className="text-sm text-muted-foreground">
              Resetting password for{" "}
              <span className="font-medium text-foreground break-words">
                {email}
              </span>
            </p>
          )}
          {error && <AuthAlert variant="error">{error}</AuthAlert>}
          <AuthField label="New password" htmlFor="password">
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={12}
              placeholder="At least 12 characters"
              autoComplete="new-password"
              className="h-10"
            />
          </AuthField>
          <AuthField label="Confirm password" htmlFor="confirm">
            <PasswordInput
              id="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={12}
              placeholder="Re-enter password"
              autoComplete="new-password"
              className="h-10"
            />
          </AuthField>
          <Button
            type="submit"
            className="h-10 w-full font-semibold transition-smooth"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Update password & continue"
            )}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
