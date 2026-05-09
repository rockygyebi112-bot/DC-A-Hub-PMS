"use client";

export const dynamic = "force-dynamic";

import { Suspense, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo },
    );

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
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
            Reset your password
          </h1>
          <p className="text-[11px] text-muted-foreground">
            We&apos;ll email you a secure link to set a new password
          </p>
        </div>
      </div>

      {sent ? (
        <div className="px-6 sm:px-8 pt-6 pb-8 space-y-4">
          <div className="p-3 text-sm rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800">
            If an account exists for <span className="font-medium">{email}</span>, a
            password reset link is on its way. Check your inbox (and spam folder).
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <ArrowLeft className="size-3.5" />
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-6 sm:px-8 pt-6">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/30">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Email
              </Label>
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
                  Sending link...
                </>
              ) : (
                "Send reset link"
              )}
            </Button>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Back to sign in
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
