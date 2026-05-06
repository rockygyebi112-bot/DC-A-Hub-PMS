"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PendingUsersTable } from "@/components/settings/pending-users-table";
import { ActiveUsersTable } from "@/components/settings/active-users-table";
import { InviteUserModal } from "@/components/settings/invite-user-modal";
import { PermissionsMatrix } from "@/components/settings/permissions-matrix";

export default function SettingsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  function handleRefresh() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <InviteUserModal onInvited={handleRefresh} />
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="roles">Roles &amp; Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pending Users</CardTitle>
            </CardHeader>
            <CardContent>
              <PendingUsersTable onUserUpdated={handleRefresh} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Active Users</CardTitle>
            </CardHeader>
            <CardContent>
              <ActiveUsersTable refreshKey={refreshKey} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Roles &amp; Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <PermissionsMatrix />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
