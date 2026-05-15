"use client";

import { Suspense } from "react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import Link from "next/link";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
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

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/");
  }

  return (
    <div className="relative bg-card border rounded-2xl shadow-card-elevated overflow-hidden">
      <div className="h-[3px] bg-gradient-to-r from-primary via-primary/70 to-secondary" />
      <div className="flex flex-col items-center gap-2 px-6 sm:px-8 pt-6 text-center">
        <Image
          src="/logo.png"
          alt="DC&A Hub"
          width={220}
          height={64}
          className="h-16 w-auto"
          priority
        />
        <p className="text-[11px] text-muted-foreground">Sign in to continue</p>
      </div>
      <form onSubmit={handleLogin}>
        <div className="space-y-4 px-6 sm:px-8 pt-6">
          {(error || errorParam) && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/30">
              {error || errorMessages[errorParam!] || "An error occurred."}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</Label>
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
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</Label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete="current-password"
              className="h-10"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>
        <div className="flex flex-col gap-4 px-6 sm:px-8 pt-5 pb-8">
          <Button
            type="submit"
            className="w-full h-10 font-semibold transition-smooth"
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
        </div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
