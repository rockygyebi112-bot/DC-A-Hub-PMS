"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { UserAvatar } from "./user-avatar";
import { createClient } from "@/lib/supabase/client";

export function UserDropdown({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function signOut() {
    startTransition(async () => {
      const sb = createClient();
      await sb.auth.signOut();
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-2 px-2">
            <UserAvatar email={email} name={name} size="sm" />
            <span className="hidden md:inline text-sm">{name}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 flex flex-col gap-0.5 border-b mb-1 pb-2">
          <span className="text-sm font-medium">{name}</span>
          <span className="text-xs text-muted-foreground">{email}</span>
        </div>
        <DropdownMenuItem disabled>
          <User className="mr-2 size-4" /> Account (coming soon)
        </DropdownMenuItem>
        <div className="my-1 border-t" />
        <DropdownMenuItem onClick={signOut} disabled={pending}>
          <LogOut className="mr-2 size-4" />
          {pending ? "Signing out..." : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
