"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { MODULE_LABELS } from "@/lib/constants";
import type { Role, RolePermission, AppModule } from "@/lib/types";

const MODULES: AppModule[] = [
  "executive_dashboard",
  "program_dashboards",
  "data_entry",
  "indicators",
  "learnings",
  "projects",
  "settings",
];

export function PermissionsMatrix() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    const [rolesRes, permsRes] = await Promise.all([
      supabase.from("roles").select("*").order("name"),
      supabase.from("role_permissions").select("*"),
    ]);
    setRoles((rolesRes.data as Role[]) ?? []);
    setPermissions((permsRes.data as RolePermission[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function isAllowed(roleId: string, module: AppModule): boolean {
    const perm = permissions.find(
      (p) => p.role_id === roleId && p.module === module
    );
    return perm?.allowed ?? false;
  }

  function getPermId(roleId: string, module: AppModule): string | undefined {
    return permissions.find(
      (p) => p.role_id === roleId && p.module === module
    )?.id;
  }

  async function togglePermission(roleId: string, module: AppModule) {
    const key = `${roleId}-${module}`;
    setToggling(key);

    const current = isAllowed(roleId, module);
    const permId = getPermId(roleId, module);

    let error;
    if (permId) {
      ({ error } = await supabase
        .from("role_permissions")
        .update({ allowed: !current })
        .eq("id", permId));
    } else {
      ({ error } = await supabase
        .from("role_permissions")
        .insert({ role_id: roleId, module, allowed: true }));
    }

    setToggling(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    await loadData();
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading permissions...</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[140px]">Module</TableHead>
            {roles.map((role) => (
              <TableHead key={role.id} className="text-center min-w-[120px]">
                {role.name}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {MODULES.map((module) => (
            <TableRow key={module}>
              <TableCell className="font-medium">
                {MODULE_LABELS[module]}
              </TableCell>
              {roles.map((role) => {
                const key = `${role.id}-${module}`;
                const allowed = isAllowed(role.id, module);
                return (
                  <TableCell key={role.id} className="text-center">
                    <Switch
                      checked={allowed}
                      onCheckedChange={() => togglePermission(role.id, module)}
                      disabled={toggling === key}
                      size="sm"
                    />
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
