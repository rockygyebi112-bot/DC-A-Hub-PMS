"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCard } from "@/components/ui/auth-card";
import { AuthField } from "@/components/ui/auth-field";
import { AuthAlert } from "@/components/ui/auth-alert";
import { requestPasswordReset } from "./actions";

function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await requestPasswordReset({ email: email.trim() });

    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  const backLink = (
    <Link
      href="/login"
      className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" />
      Back to sign in
    </Link>
  );

  if (sent) {
    return (
      <AuthCard
        title="Check your inbox"
        description="We've sent you a secure link to reset your password"
        footer={backLink}
      >
        <AuthAlert variant="success">
          If an account exists for{" "}
          <span className="font-medium">{email}</span>, a password reset link is
          on its way. Check your inbox (and spam folder).
        </AuthAlert>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      description="We'll email you a secure link to set a new password"
      footer={backLink}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <AuthAlert variant="error">{error}</AuthAlert>}
        <AuthField label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            autoComplete="email"
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
              Sending link...
            </>
          ) : (
            "Send reset link"
          )}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
