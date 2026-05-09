"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AppRole } from "@/lib/auth/require-role";

export function UserRoleSelect({ role }: { role: AppRole }) {
  const [value, setValue] = useState<AppRole>(role);

  return (
    <>
      <input type="hidden" name="role" value={value} />
      <Select value={value} onValueChange={(next) => setValue(next as AppRole)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="admin">Admin</SelectItem>
          <SelectItem value="staff">Staff</SelectItem>
          <SelectItem value="client">Client</SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}
