"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import { AuthCard } from "@/components/ui/auth-card";
import { AuthField } from "@/components/ui/auth-field";
import { AuthAlert } from "@/components/ui/auth-alert";

function AcceptInviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // The user lands here after Supabase verified their invite token and our
  // /auth/callback exchanged the code for a session. If there's no session,
  // the link is stale or was already used — send them to login.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login?error=invite_expired");
        return;
      }
      setEmail(data.user.email ?? null);
      setChecking(false);
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
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
      title="Accept your invite"
      description="Set a password to activate your account"
    >
      {checking ? (
        <div className="flex justify-center py-8">
          <Spinner size="lg" label="Verifying your invite" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {email && (
            <p className="text-sm text-muted-foreground">
              Signed in as{" "}
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
              "Set password & continue"
            )}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteForm />
    </Suspense>
  );
}
