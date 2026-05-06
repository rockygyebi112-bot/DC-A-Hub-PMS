# Performance Management Module — Design Spec
**Date:** 2026-04-16  
**Project:** SRSF MIS (Springboard Road Show Foundation)  
**Approach:** Integrated module within existing Next.js + Supabase MIS

---

## 1. Overview

Performance Management is a new module added to the existing SRSF MIS sidebar. It allows Executive Directors to track org-wide goal progress, Department Managers to set and manage department goals with staff activities, and Staff to log weekly work with proof of completion.

The module is mobile-first — EDs, managers, and staff will primarily access it on their phones.

---

## 2. User Roles & Access

Three roles interact with this module, mapped to the existing `roles` and `role_permissions` system:

| Role | What they see |
|------|--------------|
| **Executive Director** | All departments, all goals, all activity proof, org-wide alerts |
| **Department Manager** | Their department only: goals + all staff activities + staff progress |
| **Staff** | Their department's goals (read-only) + their own assigned activities |

A new `AppModule` entry `"performance"` is added to the existing permissions matrix in Settings.

Departments are not a new concept in the DB — they map to a new `departments` table linked to `user_profiles`. The 5 departments are: MEL, IT, Admin & HR, Finance, Marketing & Comms.

---

## 3. Data Model

Six new Supabase tables:

### `departments`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text | e.g. "MEL Department" |
| `created_at` | timestamptz | |

### `user_departments`
Links users to a department (one user → one department).
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → user_profiles | |
| `department_id` | uuid FK → departments | |

### `performance_goals`
Annual goals broken into quarterly milestones. One goal can span multiple quarters.
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `department_id` | uuid FK | |
| `title` | text | Goal name |
| `description` | text | Optional detail |
| `year` | integer | e.g. 2025 |
| `quarter` | integer | 1–4 (milestone quarter) |
| `due_date` | date | |
| `created_by` | uuid FK → user_profiles | Manager who created it |
| `created_at` | timestamptz | |

### `performance_activities`
Sub-tasks under a goal, assigned to a staff member.
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `goal_id` | uuid FK → performance_goals | |
| `title` | text | Activity name |
| `assigned_to` | uuid FK → user_profiles | |
| `due_date` | date | |
| `status` | — | Computed on-read: `done` if submission exists, `overdue` if `due_date < now()`, else `pending` |
| `created_by` | uuid FK → user_profiles | |
| `created_at` | timestamptz | |

### `activity_submissions`
Proof of work submitted when a staff member marks an activity done.
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `activity_id` | uuid FK → performance_activities | |
| `submitted_by` | uuid FK → user_profiles | |
| `description` | text | Written description of what was done |
| `submitted_at` | timestamptz | |

### `activity_attachments`
Files attached to an activity submission. Stored in Supabase Storage bucket `performance-attachments`.
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `submission_id` | uuid FK → activity_submissions | |
| `file_name` | text | Original filename |
| `file_size` | integer | Bytes |
| `storage_path` | text | Path in Supabase Storage |
| `uploaded_at` | timestamptz | |

---

## 4. Goal Status Logic

Goal status is derived, not stored:

- **On Track** — progress % ≥ expected % for current date within the quarter
- **At Risk** — progress % is 15–30% below expected pace
- **Behind** — progress % is >30% below expected pace, or any activity is overdue

Activity `status` field:
- `pending` — not yet done, due date in the future
- `overdue` — not yet done and `due_date < now()` (computed on-read in the query, no separate cron needed)
- `done` — submission exists

Department progress % = (done activities / total activities) × 100 for the selected quarter.

---

## 5. Three Views

### 5a. Executive Director View (`/performance`)
- **Summary KPI row** — On Track count, At Risk count, Overdue count, Overall % (across all depts, selected quarter)
- **Department list** — one card per department showing: progress %, status pill (On Track / At Risk / Behind), progress bar, done/pending/overdue activity counts, staff count
- **Alerts panel** — feed of overdue activities and departments below pace, newest first
- **Quarter tabs** (Q1–Q4) + year selector in the header
- Tapping a department card navigates to the Manager View for that department

### 5b. Manager View (`/performance/[departmentId]`)
- **App bar** — department name, back button, live summary strip (%, done, pending, overdue)
- **Tab bar** — Goals & Activities / Staff / Alerts
- **Goals & Activities tab** — list of goals for the selected quarter, each expandable to show activity rows. Activities show assignee, due date (colour-coded), proof chip if submitted
- **Staff tab** — one row per staff member: avatar, name, activity count, completion %, mini progress bar
- **Alerts tab** — overdue activities and at-risk goals within this department
- Managers can: add goals, add activities to goals, assign activities to staff

### 5c. Staff View (`/performance/me`)
- **App bar** — staff member name, department, personal summary strip (done/pending/overdue/my %)
- **Week navigator** — scroll back through previous weeks
- **Department goal banner** — read-only view of the parent goal, with dept-level progress bar
- **Activity list** — personal activities for the selected week:
  - **Overdue**: red styling, log-work area expanded by default
  - **Pending**: empty checkbox, "Attach file" + "Mark done" buttons
  - **Done**: strikethrough, collapsed with proof chip + timestamp; expandable to view files + description
- Staff cannot create activities — only log work against assigned ones

---

## 6. Proof of Work

When a staff member marks an activity done, they submit:
1. **Written description** — what they did, blockers, notes (required)
2. **File attachments** — documents, photos, screenshots (optional, multiple allowed)

Files are uploaded to Supabase Storage bucket `performance-attachments` with path: `{department_id}/{goal_id}/{activity_id}/{filename}`.

Managers and EDs can view submitted descriptions and download attached files directly from the activity row.

---

## 7. Notifications & Alerts

Alerts are triggered by three conditions:

| Trigger | Who is notified | Channel |
|---------|----------------|---------|
| Activity due date passes without a submission | Assigned staff (reminder) + their manager | In-app only |
| Department progress falls >30% below expected pace | ED | In-app only |
| Activity is overdue for 3+ days | Manager | In-app only |

In-app alerts are computed on-read — no separate alerts table is needed. The Alerts panel (ED view) and Alerts tab (Manager view) query live activity and goal status to surface current overdue/at-risk items. The bell icon in the app bar shows a red dot when the query returns any active alerts for that user.

Email notifications are out of scope for this phase.

---

## 8. Navigation & Sidebar

A new sidebar item is added to `NAV_ITEMS` in `src/lib/constants.ts`:
```ts
{
  label: "Performance",
  href: "/performance",
  icon: Target, // Lucide icon
  module: "performance",
}
```

`AppModule` type in `src/lib/types.ts` gains `"performance"`.

The permissions matrix in Settings gains a "Performance" row.

Routes:
- `/performance` — ED view (org-wide)
- `/performance/[departmentId]` — Manager view (department drill-down)
- `/performance/me` — Staff view (personal activities)

Access is role-based: staff are redirected from `/performance` and `/performance/[departmentId]` to `/performance/me`.

---

## 9. Mobile-First UI Decisions

- **Bottom navigation bar** on mobile (replaces sidebar) with 5 key items: Dashboard, Programs, Performance, Data Entry, Settings
- **Sticky app bar** uses the SRSF purple gradient (`srsf-purple-800 → srsf-purple-900`) with white text — matches existing sidebar style
- **Font**: Inter (already used via `--font-sans` in `globals.css`)
- **Brand colors**: `srsf-green-500` (#5BBF3A) for positive states, `srsf-purple-600` (#6B2D7B) for interactive elements, amber (#f59e0b) for at-risk, red (#ef4444) for overdue
- **Touch targets**: all interactive elements ≥ 44px tall
- **Sidebar** is shown on desktop (≥ 768px), hidden on mobile in favour of bottom nav

---

## 10. Out of Scope

- Push notifications
- Goal templates or recurring goals
- Comments or threaded discussions on activities
- External stakeholder access
- Reporting/export of performance data (can be added in a later phase)
