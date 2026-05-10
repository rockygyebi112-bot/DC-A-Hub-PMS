"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";

export default function SignUpPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/pending");
  }

  return (
    <Card className="border-0 shadow-2xl rounded-2xl overflow-hidden">
      <CardHeader className="text-center pb-2 pt-8">
        <Image
          src="/srsf-logo.png"
          alt="SRSF"
          width={80}
          height={80}
          className="mx-auto mb-1"
          priority
        />
        <CardTitle className="text-xl font-bold tracking-tight mt-3">Create an account</CardTitle>
        <CardDescription className="text-sm">
          Sign up to request access to the MIS
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSignUp}>
        <CardContent className="space-y-4 px-8">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100">
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="fullName" className="text-xs font-medium text-gray-600">Full Name</Label>
            <Input id="fullName" type="text" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium text-gray-600">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-medium text-gray-600">Password</Label>
            <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-10" autoComplete="new-password" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-xs font-medium text-gray-600">Confirm Password</Label>
            <PasswordInput id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="h-10" autoComplete="new-password" />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 px-8 pb-8">
          <Button
            type="submit"
            className="w-full h-10 bg-srsf-green-500 hover:bg-srsf-green-600 font-semibold shadow-md shadow-srsf-green-500/20 transition-all"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Sign up"}
          </Button>
          <p className="text-xs text-gray-400">
            Already have an account?{" "}
            <Link href="/login" className="text-srsf-purple-500 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
