import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { SignOutButton } from "@/components/account/sign-out-button";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

const HOME_BY_ROLE: Record<string, string> = {
  admin: "/admin",
  staff: "/workspace",
  client: "/portal",
};

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const home = HOME_BY_ROLE[profile.role] ?? "/";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 flex h-[60px] items-center justify-between border-b bg-background/80 px-4 backdrop-blur md:px-6">
        <Button variant="ghost" size="sm" render={<Link href={home} />}>
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="text-sm font-medium">{profile.fullName}</span>
            <span className="text-xs text-muted-foreground">{profile.email}</span>
          </div>
          <UserAvatar
            name={profile.fullName}
            email={profile.email}
            avatarUrl={profile.avatarUrl}
            size="sm"
          />
          <SignOutButton>
            <LogOut className="size-4 sm:mr-2" />
            <span className="hidden sm:inline">Sign out</span>
          </SignOutButton>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">{children}</main>
    </div>
  );
}
