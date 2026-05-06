# Springboard Road Show Foundation — Management Information System (MIS)

## Overview

A web-based MIS for the Springboard Road Show Foundation to track, visualize, and manage data across four core programs: Enterprise Spotlight, Virtual University, Hangout, and ABSA Onboarding. The system provides executive-level and program-level dashboards, centralized data entry with bulk upload, flexible indicator management, a learnings bank, and role-based access control.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind CSS + shadcn/ui |
| Charts | Apache ECharts |
| Auth & Database | Supabase (Auth, PostgreSQL, Row-Level Security) |
| Deployment | Vercel |
| Excel I/O | xlsx library (template generation + file parsing) |

---

## Branding

- **Primary color:** Green (extracted from SRSF logo — ~#5BBF3A range)
- **Secondary color:** Purple (extracted from SRSF logo — ~#6B2D7B range)
- **Accents:** Lighter/darker shades of both for hover states, backgrounds, chart palettes
- **Logo:** SRSF logo displayed in the top-left of the sidebar and on auth screens

---

## System Modules

The MIS has 6 modules accessible via a left sidebar:

1. Executive Dashboard
2. Program Dashboards (submenu: Enterprise Spotlight, Virtual University, Hangout, ABSA Onboarding)
3. Data Entry
4. Indicators Management
5. Learnings
6. Settings

---

## Module 1: Navigation & Layout

### Sidebar (Left)
- Collapsible sidebar with purple background, white text
- Navigation items for all 6 modules
- Program Dashboards has an expandable submenu with 4 program options
- Active state uses green highlight
- On mobile/tablet: collapses into a hamburger menu

### Top Bar
- SRSF logo (left)
- Current module title (center)
- User avatar + role badge + logout (right)

### Main Content Area
- Light gray background with white card panels
- Scrollable, fills remaining space

---

## Module 2: Executive Dashboard

Landing page after login. Aggregates all ED-marked indicators across programs.

### Layout (top to bottom):

**1. Filter bar**
- Program selector buttons (All / individual programs)
- Date range picker

**2. KPI summary row** — Large number cards:
- Total Applications (Enterprise Spotlight)
- Total Episodes — Virtual University
- Total Episodes — Hangout
- Total Participants Onboarded (ABSA)
- Each card: metric value, trend arrow (vs previous period), sparkline

**3. Demographics section** — Side-by-side charts:
- Gender Distribution (stacked bar or donut, by program)
- Age Bracket (grouped bar chart across programs)
- Disability Status (donut, Enterprise + ABSA combined)

**4. Geographic section:**
- Regional Representation (horizontal bar chart ranked by region)
- Region count KPI card

**5. Enterprise Spotlight specifics:**
- Business Registration Status (pie: registered vs unregistered)
- Business Sector (horizontal bar)

**6. Media Programs section** (Virtual University + Hangout):
- Monthly Trend Analysis — Views (dual-line chart, one per program)
- Monthly Episodes Aired (grouped bar)
- Views per Platform (stacked bar: Facebook vs YouTube, per program)

**7. ABSA section:**
- Region breakdown (bar chart)

All charts: interactive tooltips on hover, click to drill into program dashboard.

---

## Module 3: Program Dashboards

### Enterprise Spotlight
- **KPI cards:** Total applications, number of regions
- **Charts:** Regional representation (bar), gender distribution (donut), age bracket (bar), disability status (donut), disability type (bar), ownership type (pie), business longevity (grouped bar by years), business size (bar), funding status (pie), registration status (donut), business sector (horizontal bar)
- Date range filter

### Virtual University
- **KPI cards:** Total episodes, total views (all platforms)
- **Charts:** Monthly trend analysis (line), monthly episodes aired (bar), views per platform (stacked bar), shares/saves (bar), likes (bar), gender (donut), age bracket (bar)
- **Episode data table below charts:** Columns — episode title, date aired, platform, views, shares/saves, likes. Sortable, searchable, exportable to Excel

### Hangout
- Identical structure to Virtual University (same indicators, same chart types, same data table)

### ABSA Onboarding
- **KPI cards:** Total participants onboarded
- **Charts:** Gender (donut), age bracket (bar), region (bar), employment status (pie), disability status (donut)
- Date range filter

### Shared behavior:
- Date range filter at top
- Export button (download as Excel)
- Interactive charts (tooltips, click-to-filter)
- Custom indicators added via Indicators Management auto-appear as new charts/KPI cards

---

## Module 4: Data Entry

Central hub — all data entered here feeds executive and program dashboards.

### Program Selector
Card-based picker with 5 options: Enterprise Spotlight, Virtual University, Hangout, ABSA Onboarding, Learnings.

### Enterprise Spotlight Form
Fields: applicant name, region (dropdown), gender (dropdown), age (number — auto-categorized into bracket), disability status (yes/no), disability type (conditional — shows if disability = yes), ownership type (dropdown), business longevity (years), business size (dropdown), funding status (dropdown), business registered (yes/no), business sector (dropdown), learnings (text area).

### Virtual University Form (weekly)
Fields: episode title, date aired, platform (multi-select: Facebook/YouTube), per-platform views/shares/saves/likes, audience demographics (gender breakdown by count, age bracket breakdown by count), learnings (text area).

### Hangout Form
Identical to Virtual University.

### ABSA Onboarding Form
Fields: participant name, gender, age, region, employment status (dropdown), disability status (yes/no), learnings (text area).

### Learnings Form
Fields: program (dropdown), learning category/theme (dropdown — Operations, Partnerships, Audience Engagement, Impact, etc.), learning title (short text), learning description (rich text area), date of learning.

### Bulk Upload (all programs + learnings)
- **Download Template** button per program — generates pre-formatted Excel with:
  - Column headers matching indicators
  - Dropdown validations where applicable
  - Instructions sheet
- **Upload Data** button — file picker for completed Excel
- On upload:
  1. Validates file structure (correct columns, required fields)
  2. Shows preview table with validation errors highlighted in red
  3. User reviews and confirms → bulk insert to Supabase
  4. Summary: X records imported, Y errors skipped
- Templates available for Learnings too

### Shared behavior:
- Form validation with clear error messages
- Success toast on submit
- Save as Draft for incomplete entries
- Custom indicators (added by admin) appear as additional fields at bottom of form
- Recent entries table below form (last 10 entries, edit/delete actions)

---

## Module 5: Indicators Management

Admin-only portal for managing indicators per program.

### Layout:
- **Program tab bar** at top — select program
- **Indicators table:** indicator name, data type (Numeric/Categorical), options (for categorical), Executive Dashboard visibility (toggle), status (Core/Custom), actions (edit, remove)

### Adding an Indicator
"Add Indicator" button → modal form:
- Indicator name (text)
- Data type (Numeric or Categorical)
- If Categorical: define dropdown options
- Show on Executive Dashboard (toggle)
- Manual value entry (toggle) — accepts manually calculated value rather than auto-computed

On save:
- Appears in table as "Custom"
- Auto-adds field to program's data entry form
- Auto-generates chart on program dashboard (bar for categorical, KPI card for numeric)
- If ED-marked, appears on executive dashboard

### Edit/Remove:
- Core indicators: can edit (rename, toggle ED) but not delete
- Custom indicators: fully editable or removable — removing hides from forms/dashboards but retains historical data

---

## Module 6: Learnings

Dashboard-style display of all captured learnings.

### Layout (top to bottom):

**1. Filters bar**
- Program dropdown (all/specific), date range picker, keyword search, category/theme filter

**2. Summary/Analytics section:**
- KPI cards: total learnings count, learnings this month, most active program
- Theme distribution (donut chart)
- Learnings over time (monthly trend line chart)
- Word cloud from learning descriptions
- Learnings by program (bar chart)

**3. Feed section:**
- Card-based feed of learning entries
- Each card: program tag (color-coded), category badge, title, description preview (expandable), date, submitted by
- Most recent first, paginated (20 per page)
- Click to expand full details in side panel

**4. Export** — Download filtered learnings as Excel

---

## Module 7: Settings

### Authentication Flow
1. Anyone can sign up (email/password via Supabase Auth)
2. After sign up → **"Pending Approval" screen**: SRSF logo + message "Your account is awaiting administrator approval. You'll receive an email once access is granted."
3. Admin sees new sign-ups in Settings under **"Pending Users"** section
4. Admin approves → assigns role → user receives email notification
5. Rejected users get email notification, account deactivated
6. On next login, approved user accesses permitted modules

### Tab 1: User Management
- **Pending Users** section at top: name, email, sign-up date, Approve/Reject actions
- **Active Users** table: name, email, role, status (active/inactive), date added
- Actions: edit role, deactivate/reactivate, remove
- "Invite User" button → modal: email + role → sends Supabase auth invite
- Deactivated users cannot log in; data entry history preserved

### Tab 2: Roles & Permissions

Default permission matrix:

| Permission | Admin | Program Manager | Data Entry Officer | Viewer |
|---|---|---|---|---|
| Executive Dashboard | Yes | Yes | No | Yes |
| Program Dashboards | Yes | Yes | No | Yes |
| Data Entry | Yes | No | Yes | No |
| Indicators Management | Yes | No | No | No |
| Learnings | Yes | Yes | No | Yes |
| Settings | Yes | No | No | No |

- Admin can create custom roles
- Toggle permissions per module via checkboxes
- Program Managers can be scoped to specific programs only
- At least one admin must always exist
- Audit log at bottom: tracks role/permission changes with who, what, when

### Enforcement:
- UI level: sidebar hides restricted modules
- API level: Supabase RLS policies reject unauthorized queries

---

## Database Schema (High-Level)

### Core Tables
- `users` — id, email, name, role_id, status (pending/active/inactive), created_at
- `roles` — id, name, is_system (boolean for default roles)
- `role_permissions` — role_id, module (enum), allowed (boolean)
- `programs` — id, name, slug, description
- `indicators` — id, program_id, name, data_type (numeric/categorical), options (jsonb), is_core, show_on_executive, manual_entry, sort_order, is_active
- `audit_log` — id, user_id, action, details (jsonb), created_at

### Program Data Tables
- `enterprise_spotlight_entries` — id, user_id, data (jsonb — flexible for core + custom indicators), learning, is_draft, created_at
- `virtual_university_entries` — id, user_id, episode_title, date_aired, platforms (jsonb), metrics (jsonb), demographics (jsonb), learning, is_draft, created_at
- `hangout_entries` — same structure as virtual_university_entries
- `absa_onboarding_entries` — id, user_id, data (jsonb), learning, is_draft, created_at
- `learnings` — id, user_id, program_id, category, title, description, learning_date, created_at

### Design Decisions
- **JSONB columns** for entry data: allows custom indicators to be stored without schema migrations
- **Separate tables per program**: cleaner queries, program-specific indexing, avoids one massive table
- **Soft delete on indicators**: removing a custom indicator sets `is_active = false`, historical data preserved
- **RLS policies**: enforce access per user role at the database level

---

## Data Flow

```
Data Entry Form / Bulk Upload
        ↓
   Supabase PostgreSQL
        ↓
   ┌────────────────────┐
   │ Program Dashboards  │ ← all indicators
   │ Executive Dashboard │ ← ED-marked indicators only
   │ Learnings Module    │ ← learning fields from entries + learnings form
   └────────────────────┘
```

All dashboards are read-only views derived from data entry. Single source of truth.

---

## Key Architectural Decisions

1. **Next.js App Router** — file-based routing maps to modules: `/dashboard`, `/programs/[slug]`, `/data-entry`, `/indicators`, `/learnings`, `/settings`
2. **Supabase RLS** — no separate API layer; security enforced at database level
3. **JSONB for flexibility** — custom indicators stored in JSONB columns, no migrations needed for new indicators
4. **Apache ECharts** — Power BI-style rich interactive charts
5. **shadcn/ui + Tailwind** — easy to brand with green/purple palette
6. **Virtual University and Hangout share a data structure** — DRY: single component with program-specific config
7. **Excel I/O via xlsx library** — template generation with validations, upload with preview/validation
