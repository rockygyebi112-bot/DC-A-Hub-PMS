import type {
  ActivityTimelineEvent,
  WorkspaceProof,
} from "@/lib/workspace/queries";
import { formatTimestamp } from "./format";
import type { FeedItem, LifecycleStep } from "./types";

/**
 * Collapse raw `activity_log` events into a UI-friendly chat feed. Only
 * surfaces the actions that carry user intent (notes, uploads, completion)
 * — bookkeeping events like `created`/`assigned` are filtered out because
 * they're already visible in the lifecycle timeline.
 */
export function buildUpdatesFeed(
  events: ActivityTimelineEvent[],
  proofsById: Map<string, WorkspaceProof>,
): FeedItem[] {
  const items: FeedItem[] = [];
  const ordered = [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  for (const event of ordered) {
    const actor = event.actor_name ?? "Team member";
    const email = `${actor.toLowerCase().replace(/\s+/g, ".")}@team`;
    const meta = event.meta as { note?: string; proof_id?: string; count?: number };

    if (event.action === "updated" && meta.note) {
      items.push({
        id: event.id,
        actor,
        email,
        timestamp: formatTimestamp(event.created_at),
        body: meta.note,
        attachments: [],
      });
    } else if (event.action === "proof_added") {
      const proofId = meta.proof_id;
      const attached = proofId
        ? [proofsById.get(proofId)].filter((p): p is WorkspaceProof => !!p)
        : [];
      items.push({
        id: event.id,
        actor,
        email,
        timestamp: formatTimestamp(event.created_at),
        body: `Uploaded ${meta.count ?? 1} document${(meta.count ?? 1) === 1 ? "" : "s"} to this activity.`,
        attachments: attached,
      });
    } else if (event.action === "marked_done") {
      items.push({
        id: event.id,
        actor,
        email,
        timestamp: formatTimestamp(event.created_at),
        body: "Marked this activity as complete.",
        attachments: [],
      });
    }
  }

  return items;
}

/**
 * Build the five-step lifecycle ladder rendered in the right sidebar.
 * Each step's state is derived from the timeline events: a step is `done`
 * if the corresponding event was logged, `current` if it's the most recent
 * milestone for the activity's status, otherwise `future`.
 */
export function buildLifecycle(
  events: ActivityTimelineEvent[],
  status: "not_started" | "in_progress" | "done",
): LifecycleStep[] {
  const find = (actions: string[]) =>
    events.find((e) => actions.includes(e.action));
  const created = find(["created"]);
  const assigned = find(["assigned", "updated"]);
  const started = find(["started"]);
  const proof = find(["proof_added"]);
  const done = find(["marked_done"]);

  const currentKey =
    status === "done"
      ? "completed"
      : proof
        ? "proof"
        : started
          ? "started"
          : assigned
            ? "assigned"
            : created
              ? "created"
              : "created";

  function step(
    key: string,
    label: string,
    src: ActivityTimelineEvent | undefined,
    fallbackState: "done" | "current" | "future",
  ): LifecycleStep {
    const state: "done" | "current" | "future" = src
      ? key === currentKey
        ? "current"
        : "done"
      : fallbackState;
    return {
      key,
      label,
      state,
      when: src?.created_at ?? null,
      actor: src?.actor_name ?? null,
    };
  }

  return [
    step("created", "Activity created", created, "future"),
    step("assigned", "Assigned to team", assigned, "future"),
    step(
      "started",
      "Started",
      started,
      currentKey === "started" ? "current" : "future",
    ),
    step(
      "proof",
      "Document uploaded",
      proof,
      currentKey === "proof" ? "current" : "future",
    ),
    step(
      "completed",
      "Completed",
      done,
      currentKey === "completed" ? "current" : "future",
    ),
  ];
}
