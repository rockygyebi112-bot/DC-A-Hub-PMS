# Staff Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins and managers to assign existing users to a department so they appear as assignable staff when creating performance activities.

**Architecture:** Two new UI actions are added to the existing Manager view's Staff tab: an "Add Staff" button that opens a modal listing active users not yet in the department (inserting into `user_departments`), and a "Remove" button on each staff row (deleting from `user_departments`). No new pages or tables — `user_departments` already exists. The modal also lets the admin mark a user as department manager via the `is_manager` boolean.

**Tech Stack:** Next.js 16 App Router, Supabase JS v2, Tailwind CSS v4, shadcn/ui (base-ui — `asChild` is broken, Select `onValueChange` receives `string | null` — always add `?? ""`), Lucide React.

---

## File Map

### New files
| Path | Purpose |
|------|---------|
| `src/components/performance/manage-staff-modal.tsx` | Modal: pick an active user + set is_manager → insert into `user_departments` |

### Modified files
| Path | What changes |
|------|-------------|
| `src/components/performance/staff-progress-tab.tsx` | Add "Add Staff" button + Remove button per row; accept `departmentId` and `onReload` props |
| `src/components/performance/manager-dashboard.tsx` | Pass `departmentId` and `onReload` to `StaffProgressTab` |

---

## Task 1: Manage Staff Modal

**Files:**
- Create: `src/components/performance/manage-staff-modal.tsx`

This modal fetches all active `user_profiles` that do **not** already have a row in `user_departments` for this department. The admin picks one from a dropdown, optionally toggles "Department Manager", then clicks Add — which inserts a row into `user_departments`.

- [ ] **Step 1: Create the modal file**

```tsx
// src/components/performance/manage-staff-modal.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { UserProfile } from "@/lib/types";

interface ManageStaffModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  departmentId: string;
}

export function ManageStaffModal({
  open,
  onClose,
  onAdded,
  departmentId,
}: ManageStaffModalProps) {
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [isManager, setIsManager] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    async function fetchAvailable() {
      setLoadingUsers(true);
      const supabase = createClient();

      // Users already in this department
      const { data: existing } = await supabase
        .from("user_departments")
        .select("user_id")
        .eq("department_id", departmentId);

      const existingIds = (existing ?? []).map((r: { user_id: string }) => r.user_id);

      // All active users
      const { data: allUsers } = await supabase
        .from("user_profiles")
        .select("id, full_name, email, role_id, status, created_at, updated_at")
        .eq("status", "active")
        .order("full_name");

      // Filter out already-assigned users
      const filtered = (allUsers ?? []).filter(
        (u: UserProfile) => !existingIds.includes(u.id)
      );

      setAvailableUsers(filtered as UserProfile[]);
      setSelectedUserId("");
      setIsManager(false);
      setLoadingUsers(false);
    }

    fetchAvailable();
  }, [open, departmentId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId) return;

    setSaving(true);
    const supabase = createClient();

    const { error } = await supabase.from("user_departments").insert({
      user_id: selectedUserId,
      department_id: departmentId,
      is_manager: isManager,
    });

    if (error) {
      toast.error("Failed to add staff: " + error.message);
    } else {
      toast.success("Staff member added to department");
      onAdded();
      onClose();
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Staff to Department</DialogTitle>
        </DialogHeader>

        {loadingUsers ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Loading users…
          </p>
        ) : availableUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            All active users are already assigned to this department.
          </p>
        ) : (
          <form onSubmit={handleAdd} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="staff-select">Select staff member *</Label>
              <select
                id="staff-select"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                required
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Choose a user…</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} — {u.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="is-manager"
                type="checkbox"
                checked={isManager}
                onChange={(e) => setIsManager(e.target.checked)}
                className="size-4 rounded border-input"
              />
              <Label htmlFor="is-manager" className="cursor-pointer">
                Department Manager
              </Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !selectedUserId}>
                {saving ? "Adding…" : "Add to Department"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/Users/ishma/Desktop/springboard-mis
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/performance/manage-staff-modal.tsx
git commit -m "feat: add manage staff modal (assign users to department)"
```

---

## Task 2: Update StaffProgressTab

**Files:**
- Modify: `src/components/performance/staff-progress-tab.tsx`

Add two things:
1. An "Add Staff" button at the top that opens `ManageStaffModal`
2. A "Remove" button on each staff row that deletes the `user_departments` record

The component needs two new props: `departmentId: string` and `onReload: () => void`.

- [ ] **Step 1: Replace the full file content**

```tsx
// src/components/performance/staff-progress-tab.tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManageStaffModal } from "./manage-staff-modal";
import type { StaffMemberProgress } from "@/hooks/use-performance-manager";

interface StaffProgressTabProps {
  staff: StaffMemberProgress[];
  departmentId: string;
  onReload: () => void;
}

export function StaffProgressTab({
  staff,
  departmentId,
  onReload,
}: StaffProgressTabProps) {
  const [addOpen, setAddOpen] = useState(false);

  async function removeStaff(userId: string, name: string) {
    if (!confirm(`Remove ${name} from this department?`)) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("user_departments")
      .delete()
      .eq("user_id", userId)
      .eq("department_id", departmentId);

    if (error) {
      toast.error("Failed to remove: " + error.message);
    } else {
      toast.success(`${name} removed from department`);
      onReload();
    }
  }

  return (
    <div className="space-y-3">
      {/* Add Staff button */}
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <UserPlus className="size-4 mr-1.5" />
          Add Staff
        </Button>
      </div>

      {staff.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No staff assigned to this department yet. Click "Add Staff" to assign someone.
        </div>
      ) : (
        staff.map((s) => (
          <div
            key={s.user.id}
            className="flex items-center gap-4 rounded-xl border border-border/60 bg-white p-4"
          >
            <div className="size-9 rounded-full bg-[#6B2D7B] text-white flex items-center justify-center text-sm font-semibold shrink-0">
              {s.user.full_name.charAt(0).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{s.user.full_name}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#5BBF3A]"
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {s.done}/{s.total}
                </span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-[#6B2D7B]">{s.pct}%</p>
              {s.overdue > 0 && (
                <p className="text-xs text-red-500">{s.overdue} overdue</p>
              )}
            </div>

            <button
              onClick={() => removeStaff(s.user.id, s.user.full_name)}
              className="shrink-0 text-muted-foreground hover:text-red-500 transition-colors"
              title="Remove from department"
            >
              <X className="size-4" />
            </button>
          </div>
        ))
      )}

      <ManageStaffModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={onReload}
        departmentId={departmentId}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: error — `StaffProgressTab` is called in `manager-dashboard.tsx` without the new props. Fix that in Task 3.

- [ ] **Step 3: Commit (after Task 3 fixes the TS error)**

Hold the commit until Task 3 is done. Both files go in the same commit.

---

## Task 3: Update ManagerDashboard

**Files:**
- Modify: `src/components/performance/manager-dashboard.tsx`

Pass `departmentId` and `onReload` to `<StaffProgressTab>`.

Current line (line 153 of `manager-dashboard.tsx`):
```tsx
{activeTab === "Staff" && <StaffProgressTab staff={staff} />}
```

- [ ] **Step 1: Update the StaffProgressTab call in `manager-dashboard.tsx`**

Change:
```tsx
{activeTab === "Staff" && <StaffProgressTab staff={staff} />}
```

To:
```tsx
{activeTab === "Staff" && (
  <StaffProgressTab
    staff={staff}
    departmentId={departmentId}
    onReload={reload}
  />
)}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit Tasks 2 and 3 together**

```bash
git add src/components/performance/staff-progress-tab.tsx src/components/performance/manager-dashboard.tsx
git commit -m "feat: add staff management UI (add/remove staff from department)"
```

---

## Task 4: Verify End-to-End

No code changes — verify the feature works.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Assign a user to a department**

1. Navigate to `/performance/[departmentId]` as Admin
2. Click the "Staff" tab
3. Click "Add Staff"
4. Confirm the modal lists all active users
5. Select a user, optionally tick "Department Manager", click "Add to Department"
6. Modal closes, staff row appears in the list with 0/0 progress

- [ ] **Step 3: Verify activity assignment works**

1. Go to "Goals & Activities" tab
2. Expand a goal → click "Add activity"
3. Open the "Assign to" dropdown — the newly added staff member should appear
4. Complete the form and save — activity appears in the goal

- [ ] **Step 4: Remove a staff member**

1. Back on the "Staff" tab, click the ✕ on the staff row
2. Confirm the prompt — row disappears
3. Open "Add activity" again — the removed user is gone from the dropdown

- [ ] **Step 5: Commit final state**

```bash
git add -A
git commit -m "feat: complete staff management for performance module"
```
