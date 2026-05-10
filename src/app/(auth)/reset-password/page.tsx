"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

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
    <div className="relative bg-card border rounded-2xl shadow-card-elevated overflow-hidden">
      <div className="h-[3px] bg-gradient-to-r from-primary via-primary/70 to-secondary" />
      <div className="flex items-center gap-3 px-6 sm:px-8 pt-6">
        <Image
          src="/logo.png"
          alt="DC&A Hub"
          width={44}
          height={44}
          className="rounded-lg"
          priority
        />
        <div>
          <h1 className="font-heading text-lg font-bold tracking-tight text-foreground">
            Set a new password
          </h1>
          <p className="text-[11px] text-muted-foreground">
            Choose a strong password to finish resetting your account
          </p>
        </div>
      </div>

      {checking ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-6 sm:px-8 pt-6">
            {email && (
              <p className="text-xs text-muted-foreground">
                Resetting password for{" "}
                <span className="font-medium text-foreground">{email}</span>
              </p>
            )}
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/30">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                New password
              </Label>
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
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="confirm"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Confirm password
              </Label>
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
            </div>
          </div>
          <div className="flex flex-col gap-3 px-6 sm:px-8 pt-5 pb-8">
            <Button
              type="submit"
              className="w-full h-10 font-semibold transition-smooth"
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
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Back to sign in
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
