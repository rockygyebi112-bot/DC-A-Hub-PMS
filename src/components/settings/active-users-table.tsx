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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserX, UserCheck, Users } from "lucide-react";
import type { UserProfile, Role } from "@/lib/types";
import { TableSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { EmptyState } from "@/components/ui/empty-state";

interface ActiveUsersTableProps {
  refreshKey: number;
}

export function ActiveUsersTable({ refreshKey }: ActiveUsersTableProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const supabase = createClient();

    const [usersRes, rolesRes] = await Promise.all([
      supabase
        .from("user_profiles")
        .select("*, role:roles(*)")
        .in("status", ["active", "inactive"])
        .order("created_at", { ascending: false }),
      supabase.from("roles").select("*").order("name"),
    ]);

    setUsers((usersRes.data as UserProfile[]) || []);
    setRoles((rolesRes.data as Role[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  async function updateRole(userId: string, roleId: string) {
    const supabase = createClient();
    const {
      data: { user: actor },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("user_profiles")
      .update({ role_id: roleId, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (!error && actor) {
      await supabase.from("audit_log").insert({
        user_id: actor.id,
        action: "role_changed",
        details: { new_role_id: roleId, subject_user_id: userId },
      });
      loadData();
    }
  }

  async function toggleStatus(userId: string, currentStatus: string) {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    const supabase = createClient();
    const {
      data: { user: actor },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("user_profiles")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (!error && actor) {
      await supabase.from("audit_log").insert({
        user_id: actor.id,
        action: newStatus === "active" ? "user_reactivated" : "user_deactivated",
        details: { subject_user_id: userId },
      });
      loadData();
    }
  }

  if (loading) return <TableSkeleton rows={4} cols={6} />;

  if (users.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No active users"
        description="Users who have been approved will appear here."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Joined</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">
              {user.full_name || "\u2014"}
            </TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>
              <Select
                value={user.role_id ?? ""}
                onValueChange={(value: string | null) => { if (value) updateRole(user.id, value); }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Assign role">
                    {user.role?.name ?? "No role"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Badge
                variant={user.status === "active" ? "default" : "secondary"}
                className={
                  user.status === "active"
                    ? "bg-srsf-green-100 text-srsf-green-700"
                    : ""
                }
              >
                {user.status}
              </Badge>
            </TableCell>
            <TableCell>
              {new Date(user.created_at).toLocaleDateString()}
            </TableCell>
            <TableCell>
              <Button
                size="sm"
                variant="outline"
                onClick={() => toggleStatus(user.id, user.status)}
              >
                {user.status === "active" ? (
                  <>
                    <UserX className="w-4 h-4 mr-1" /> Deactivate
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4 mr-1" /> Reactivate
                  </>
                )}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
