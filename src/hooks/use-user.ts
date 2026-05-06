"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile, RolePermission, AppModule } from "@/lib/types";

interface UseUserReturn {
  user: UserProfile | null;
  permissions: RolePermission[];
  loading: boolean;
  hasAccess: (module: AppModule) => boolean;
  isMELManager: boolean;
  signOut: () => Promise<void>;
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*, role:roles(*)")
        .eq("id", authUser.id)
        .single();

      if (profile) {
        setUser(profile as UserProfile);

        if (profile.role_id) {
          const { data: perms } = await supabase
            .from("role_permissions")
            .select("*")
            .eq("role_id", profile.role_id);

          setPermissions((perms as RolePermission[]) || []);
        }
      }

      setLoading(false);
    }

    loadUser();
  }, []);

  function hasAccess(module: AppModule): boolean {
    return permissions.some((p) => p.module === module && p.allowed);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const roleName = (user as { role?: { name?: string } } | null)?.role?.name;
  const isMELManager = roleName === "Admin" || roleName === "Program Manager";

  return { user, permissions, loading, hasAccess, isMELManager, signOut };
}
