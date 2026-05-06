# Project Modal Redesign Prompt

Use this prompt to reproduce the redesigned project activity modal system in a design tool or image model.

```text
Design a high-fidelity UI for a project management MIS web app. The task is to redesign the entire project activity modal system.

Core hierarchy:
- Milestone -> Activity -> Sub-activity
- Maximum depth is 2
- Sub-activities are leaf tasks and must NEVER show any control that allows adding another sub-activity

Create 4 coordinated desktop-and-mobile-ready screens:
1. Parent activity detail slide-over
2. Sub-activity detail slide-over
3. Create/Edit activity modal
4. Create/Edit sub-activity modal

Use this sample content:
- Project: Nkabom Collaborative
- Milestone: Integration & Program Setup
- Activity/Sub-activity title: Align mindset component with training program

UX requirements:
- Parent activity detail view should include:
  - breadcrumb
  - large title
  - type badge: Activity
  - status chip
  - priority chip
  - owner
  - due date
  - edit, delete, close actions
  - sub-activities section with an inline "Add sub-activity" action
  - compact sub-activity list/table with status, title, owner, due date, proof count, last update
  - proof of activity section
  - post update card
  - update history timeline

- Sub-activity detail view should include:
  - breadcrumb
  - large title
  - type badge: Sub-activity
  - status chip
  - priority chip
  - owner
  - due date
  - edit, delete, close actions
  - parent activity context card with "View parent"
  - proof of activity section
  - post update card
  - update history timeline
  - absolutely NO "Add sub-activity" action and NO child-task section

- Create/Edit activity modal should:
  - feel structured, modern, and calm
  - include title, description, milestone, owner, due date, priority
  - not force the user to think about nesting unless they intentionally chose activity creation flow
  - feel like creating a container/planning item

- Create/Edit sub-activity modal should:
  - inherit parent activity and milestone context
  - show parent and milestone as locked context chips or read-only fields
  - include title, description, owner, due date, priority
  - feel like creating an executable leaf task

Visual direction:
- clean, premium operations dashboard
- not generic shadcn or default SaaS
- no purple
- no dark-mode bias
- use warm neutrals, soft stone backgrounds, muted borders, deep green brand accent, amber for medium priority, red for blocked/high risk, blue for in progress
- rounded corners, intentional spacing, subtle section contrast, clear typography hierarchy
- accessible contrast and clear hover, selected, and disabled states

Important product behaviors to express visually:
- proof is required before a leaf task can be marked Done
- parent activities roll up progress from sub-activities
- sub-activities are execution tasks, not containers
- the UI must make the hierarchy obvious at a glance

Output:
- one polished design system direction
- all 4 screens
- desktop and mobile behavior
- empty states, overdue state, blocked state, proof-missing state, completed state
- realistic labels, buttons, chips, helper text, and microcopy
```
