"use client";

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import Image from "next/image";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const errorParam = searchParams.get("error");
  const errorMessages: Record<string, string> = {
    auth: "Authentication failed. Please try again.",
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
          <h1 className="font-heading text-lg font-bold tracking-tight text-foreground">DC&A Hub PMS</h1>
          <p className="text-[11px] text-muted-foreground">Sign in to continue</p>
        </div>
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
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete="current-password"
              className="h-10"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={remember}
              onCheckedChange={(v) => setRemember(v === true)}
            />
            <span className="text-xs text-muted-foreground">Remember me</span>
          </label>
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
