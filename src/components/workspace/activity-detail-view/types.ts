import type {
  ActivityTimelineEvent,
  WorkspaceProof,
} from "@/lib/workspace/queries";
import type { ToastFormResult } from "@/components/ui/toast-form";

/**
 * Activity input shape — matches what `getActivity` returns. We accept a
 * loose shape so the same component can render data fetched by either the
 * workspace or portal pages without duplicating the type.
 */
export type ActivityForView = {
  id: string;
  phase_id: string;
  name: string;
  description: string | null;
  deliverable: string | null;
  responsible: string | null;
  planned_date: string | null;
  completed_date: string | null;
  narrative_note: string | null;
  status: "not_started" | "in_progress" | "done";
  visibility: "client_visible" | "internal";
  phase: {
    id: string;
    name: string;
    project: { id: string; name: string } | null;
  } | null;
};

export type PhaseOption = { id: string; name: string };

export type ActivityDetailViewProps = {
  activity: ActivityForView;
  proofs: WorkspaceProof[];
  timeline: ActivityTimelineEvent[];
  teamUsers: { name: string; email: string }[];
  user: { name: string; email: string; avatarUrl: string | null };
  baseHref: string;
  backHref: string;
  backLabel: string;
  /**
   * Required for posting messages from the chat-style composer. If omitted
   * the composer is hidden (read-only view).
   */
  postUpdate?: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  /** Required for the paperclip in the composer to actually upload. */
  upload?: (formData: FormData) => void | Promise<void>;

  // Edit mode (workspace only). Omit any of these to hide the action.
  isEditing?: boolean;
  phases?: PhaseOption[];
  save?: (formData: FormData) => Promise<ToastFormResult | void>;
  markComplete?: () => void | Promise<void>;
  reopen?: () => void | Promise<void>;
  deleteAction?: () => Promise<{ ok: boolean; error?: string }>;
  deleteRedirectTo?: string;

  // Visibility toggles for sections that don't apply to every audience.
  showNotes?: boolean;
  showTimeline?: boolean;
  /**
   * Whether to surface the per-activity "Responsible team" assignment.
   * Defaults to true (workspace/admin). The client portal passes false
   * because internal task assignment is a DC&A delivery detail, not
   * something the client should see.
   */
  showResponsible?: boolean;
};

export type FeedItem = {
  id: string;
  actor: string;
  email: string;
  timestamp: string;
  body: string;
  attachments: WorkspaceProof[];
};

export type LifecycleStep = {
  key: string;
  label: string;
  state: "done" | "current" | "future";
  when: string | null;
  actor: string | null;
};
