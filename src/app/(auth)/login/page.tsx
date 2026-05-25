"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthCard } from "@/components/ui/auth-card";
import { AuthField } from "@/components/ui/auth-field";
import { AuthAlert } from "@/components/ui/auth-alert";

// Map raw Supabase error messages to copy that is safe to show end users.
// Anything we don't recognise falls back to a neutral message so we never leak
// provider internals (status codes, table names, rate-limit specifics, etc.).
function friendlyAuthError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials")) {
    return "That email and password don't match. Please try again.";
  }
  if (m.includes("email not confirmed")) {
    return "Please confirm your email address before signing in. Check your inbox for the confirmation link.";
  }
  if (m.includes("too many") || m.includes("rate")) {
    return "Too many sign-in attempts. Please wait a minute and try again.";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "We couldn't reach the server. Check your connection and try again.";
  }
  return "We couldn't sign you in. Please try again, or contact support if the problem continues.";
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();

  const errorParam = searchParams.get("error");
  const errorMessages: Record<string, string> = {
    auth: "Authentication failed. Please try again.",
    invite_expired:
      "Your invite link has expired or was already used. Please ask an admin to send a new invite.",
    link_expired:
      "That password reset link has expired or was already used. Request a new one below.",
  };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Hint for the Supabase client: when "Remember me" is off we'd prefer a
    // session that doesn't outlive the tab. Read by the browser client to
    // decide between localStorage (persist) and sessionStorage (tab-only).
    try {
      window.sessionStorage.setItem("auth:remember", remember ? "1" : "0");
    } catch {
      // sessionStorage may be unavailable (private mode, quota) — non-fatal.
    }

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(friendlyAuthError(authError.message));
      setLoading(false);
      return;
    }

    // Hard navigation, not router.push: a soft navigation would replay the
    // App Router's cached RSC result for "/" — which, from the logged-out
    // state, is a redirect back to /login — causing a login loop. A full
    // load forces a fresh server request that sees the new auth cookie.
    window.location.assign("/");
  }

  return (
    <AuthCard
      title="Sign in"
      description="Sign in to continue to DC&A Hub"
      footer={
        <Link
          href="/forgot-password"
          className="font-medium text-primary hover:underline"
        >
          Forgot password?
        </Link>
      }
    >
      <form onSubmit={handleLogin} className="space-y-4">
        {(error || errorParam) && (
          <AuthAlert variant="error">
            {error || errorMessages[errorParam!] || "An error occurred."}
          </AuthAlert>
        )}
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
        <AuthField label="Password" htmlFor="password">
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            autoComplete="current-password"
            className="h-10"
          />
        </AuthField>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="size-4 rounded border-border accent-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          Keep me signed in on this device
        </label>
        <Button
          type="submit"
          className="h-10 w-full font-semibold transition-smooth"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
