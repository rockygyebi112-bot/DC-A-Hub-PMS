"use client";

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
    <div className="relative bg-black/90 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
      <div className="h-[3px] bg-gradient-to-r from-sky-500 to-cyan-400" />
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
          <h1 className="text-lg font-bold tracking-tight text-white">DC&A Hub PMS</h1>
          <p className="text-[11px] text-white/50">Sign in to continue</p>
        </div>
      </div>
      <form onSubmit={handleLogin}>
        <div className="space-y-4 px-6 sm:px-8 pt-6">
          {(error || errorParam) && (
            <div className="p-3 text-sm text-red-300 bg-red-900/30 rounded-lg border border-red-500/30">
              {error || errorMessages[errorParam!] || "An error occurred."}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium text-white/70">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-medium text-white/70">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={remember}
              onCheckedChange={(v) => setRemember(v === true)}
              className="border-white/30"
            />
            <span className="text-xs text-white/70">Remember me</span>
          </label>
        </div>
        <div className="flex flex-col gap-4 px-6 sm:px-8 pt-5 pb-8">
          <Button
            type="submit"
            className="w-full h-10 bg-gradient-to-r from-sky-500 to-cyan-400 hover:from-sky-600 hover:to-cyan-500 font-semibold text-white shadow-[0_4px_16px_rgba(14,165,233,0.4)] transition-all"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
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
