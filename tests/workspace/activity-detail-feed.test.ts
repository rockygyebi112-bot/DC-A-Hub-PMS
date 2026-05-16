import { describe, it, expect } from "vitest";
import {
  buildLifecycle,
  buildUpdatesFeed,
} from "@/components/workspace/activity-detail-view/feed";
import type {
  ActivityTimelineEvent,
  WorkspaceProof,
} from "@/lib/workspace/queries";

function event(
  partial: Partial<ActivityTimelineEvent> & {
    id: string;
    action: string;
    created_at: string;
  },
): ActivityTimelineEvent {
  return {
    actor_name: "Alice",
    meta: {},
    ...partial,
  };
}

function proof(id: string, overrides: Partial<WorkspaceProof> = {}): WorkspaceProof {
  return {
    id,
    activity_id: "a1",
    kind: "file",
    file_path: null,
    file_name: `${id}.pdf`,
    mime_type: "application/pdf",
    size_bytes: 1024,
    caption: null,
    url: null,
    created_at: "2026-05-01T00:00:00Z",
    signedUrl: null,
    ...overrides,
  };
}

describe("buildUpdatesFeed", () => {
  it("returns an empty list when there are no events", () => {
    expect(buildUpdatesFeed([], new Map())).toEqual([]);
  });

  it("ignores actions without UI surface (created, assigned, started)", () => {
    const events = [
      event({ id: "1", action: "created", created_at: "2026-05-10T00:00:00Z" }),
      event({ id: "2", action: "assigned", created_at: "2026-05-11T00:00:00Z" }),
      event({ id: "3", action: "started", created_at: "2026-05-12T00:00:00Z" }),
    ];
    expect(buildUpdatesFeed(events, new Map())).toEqual([]);
  });

  it("surfaces a note when action is 'updated' with meta.note", () => {
    const events = [
      event({
        id: "1",
        action: "updated",
        created_at: "2026-05-10T00:00:00Z",
        meta: { note: "Progress update" },
      }),
    ];
    const feed = buildUpdatesFeed(events, new Map());
    expect(feed).toHaveLength(1);
    expect(feed[0].body).toBe("Progress update");
    expect(feed[0].attachments).toEqual([]);
  });

  it("skips 'updated' events that lack a note", () => {
    const events = [
      event({
        id: "1",
        action: "updated",
        created_at: "2026-05-10T00:00:00Z",
        meta: {},
      }),
    ];
    expect(buildUpdatesFeed(events, new Map())).toEqual([]);
  });

  it("orders newest-first regardless of input order", () => {
    const events = [
      event({
        id: "old",
        action: "marked_done",
        created_at: "2026-05-01T00:00:00Z",
      }),
      event({
        id: "new",
        action: "marked_done",
        created_at: "2026-05-15T00:00:00Z",
      }),
      event({
        id: "mid",
        action: "marked_done",
        created_at: "2026-05-10T00:00:00Z",
      }),
    ];
    const feed = buildUpdatesFeed(events, new Map());
    expect(feed.map((f) => f.id)).toEqual(["new", "mid", "old"]);
  });

  it("attaches a proof by id when meta.proof_id resolves", () => {
    const p = proof("p1");
    const events = [
      event({
        id: "1",
        action: "proof_added",
        created_at: "2026-05-10T00:00:00Z",
        meta: { proof_id: "p1", count: 1 },
      }),
    ];
    const feed = buildUpdatesFeed(events, new Map([["p1", p]]));
    expect(feed).toHaveLength(1);
    expect(feed[0].attachments).toEqual([p]);
    expect(feed[0].body).toMatch(/Uploaded 1 document/);
  });

  it("pluralises the upload count when count > 1", () => {
    const events = [
      event({
        id: "1",
        action: "proof_added",
        created_at: "2026-05-10T00:00:00Z",
        meta: { count: 3 },
      }),
    ];
    expect(buildUpdatesFeed(events, new Map())[0].body).toMatch(
      /Uploaded 3 documents/,
    );
  });

  it("renders without attachments when the proof has been deleted", () => {
    const events = [
      event({
        id: "1",
        action: "proof_added",
        created_at: "2026-05-10T00:00:00Z",
        meta: { proof_id: "missing" },
      }),
    ];
    expect(buildUpdatesFeed(events, new Map())[0].attachments).toEqual([]);
  });

  it("derives a default actor name when actor_name is null", () => {
    const events = [
      event({
        id: "1",
        action: "marked_done",
        created_at: "2026-05-10T00:00:00Z",
        actor_name: null,
      }),
    ];
    const feed = buildUpdatesFeed(events, new Map());
    expect(feed[0].actor).toBe("Team member");
  });
});

describe("buildLifecycle", () => {
  it("returns five steps in canonical order", () => {
    const steps = buildLifecycle([], "not_started");
    expect(steps.map((s) => s.key)).toEqual([
      "created",
      "assigned",
      "started",
      "proof",
      "completed",
    ]);
  });

  it("marks all steps as future when there are no events and status is not_started", () => {
    const steps = buildLifecycle([], "not_started");
    expect(steps.every((s) => s.state === "future")).toBe(true);
  });

  it("flips 'completed' to current as soon as status is done, even before the log catches up", () => {
    // When the user marks an activity done, the status flips immediately but
    // the `marked_done` activity_log row may not have replicated yet. The
    // lifecycle has to surface "Completed — in progress" right away, not
    // wait for the event, otherwise the UI looks broken to the actor.
    const steps = buildLifecycle([], "done");
    const completed = steps.find((s) => s.key === "completed")!;
    expect(completed.state).toBe("current");
  });

  it("marks an event-backed step as 'done' when it is not the current key", () => {
    const events = [
      event({ id: "c", action: "created", created_at: "2026-05-01T00:00:00Z" }),
      event({ id: "s", action: "started", created_at: "2026-05-02T00:00:00Z" }),
      event({
        id: "d",
        action: "marked_done",
        created_at: "2026-05-03T00:00:00Z",
      }),
    ];
    const steps = buildLifecycle(events, "done");
    expect(steps.find((s) => s.key === "created")!.state).toBe("done");
    expect(steps.find((s) => s.key === "started")!.state).toBe("done");
    expect(steps.find((s) => s.key === "completed")!.state).toBe("current");
  });

  it("propagates when + actor onto event-backed steps", () => {
    const events = [
      event({
        id: "c",
        action: "created",
        created_at: "2026-05-01T00:00:00Z",
        actor_name: "Bob",
      }),
    ];
    const step = buildLifecycle(events, "not_started").find(
      (s) => s.key === "created",
    )!;
    expect(step.when).toBe("2026-05-01T00:00:00Z");
    expect(step.actor).toBe("Bob");
  });

  it("uses 'proof' as the current key when a proof_added event exists but completion has not happened", () => {
    const events = [
      event({
        id: "p",
        action: "proof_added",
        created_at: "2026-05-02T00:00:00Z",
        meta: { proof_id: "p1" },
      }),
    ];
    const steps = buildLifecycle(events, "in_progress");
    expect(steps.find((s) => s.key === "proof")!.state).toBe("current");
  });
});
