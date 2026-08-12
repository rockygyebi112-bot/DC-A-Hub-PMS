import { describe, expect, it } from 'vitest';
import { resolveAssignmentRecipients } from '@/lib/internal/notification-recipients';
import { renderTaskAssignedEmail } from '@/lib/email/templates/task-assigned';

const ACTOR = '11111111-1111-1111-1111-111111111111';
const ALICE = '22222222-2222-2222-2222-222222222222';
const BOB = '33333333-3333-3333-3333-333333333333';

describe('resolveAssignmentRecipients', () => {
  it('returns the assignees other than the actor', () => {
    expect(resolveAssignmentRecipients([ALICE, BOB], ACTOR)).toEqual([ALICE, BOB]);
  });

  it('drops the actor so nobody is notified of their own action', () => {
    expect(resolveAssignmentRecipients([ACTOR, ALICE], ACTOR)).toEqual([ALICE]);
  });

  it('returns an empty list when the actor is the only assignee', () => {
    expect(resolveAssignmentRecipients([ACTOR], ACTOR)).toEqual([]);
  });

  it('deduplicates repeated ids so nobody gets two emails', () => {
    expect(resolveAssignmentRecipients([ALICE, ALICE, BOB], ACTOR)).toEqual([ALICE, BOB]);
  });

  it('preserves the order the assignees were picked in', () => {
    expect(resolveAssignmentRecipients([BOB, ALICE], ACTOR)).toEqual([BOB, ALICE]);
  });

  it('ignores falsy ids rather than trusting callers to pre-filter', () => {
    expect(resolveAssignmentRecipients(['', ALICE], ACTOR)).toEqual([ALICE]);
  });

  it('handles an empty assignee list', () => {
    expect(resolveAssignmentRecipients([], ACTOR)).toEqual([]);
  });
});

describe('renderTaskAssignedEmail', () => {
  const base = {
    taskTitle: 'Draft the UNICEF inception report',
    sectionName: 'Business Development',
    dueDate: '2026-08-20',
    priority: 'high',
    assignedBy: 'Ama Mensah',
    taskUrl: 'https://pms.example.com/workspace/internal/abc-123',
  };

  it('puts the task title in the subject', () => {
    expect(renderTaskAssignedEmail(base).subject).toBe(
      "You've been assigned: Draft the UNICEF inception report",
    );
  });

  it('includes section, due date, priority and assigner in the html', () => {
    const { html } = renderTaskAssignedEmail(base);
    expect(html).toContain('<strong>Section:</strong> Business Development');
    expect(html).toContain('<strong>Due:</strong> 2026-08-20');
    expect(html).toContain('<strong>Priority:</strong> high');
    expect(html).toContain('Ama Mensah');
    expect(html).toContain(base.taskUrl);
  });

  it('omits optional rows when they are null', () => {
    const { html, text } = renderTaskAssignedEmail({
      ...base, sectionName: null, dueDate: null, priority: null,
    });
    expect(html).not.toContain('Due:');
    expect(html).not.toContain('Priority:');
    expect(html).not.toContain('Section:');
    expect(text).not.toContain('Due:');
  });

  it('escapes html in the task title', () => {
    const { html } = renderTaskAssignedEmail({
      ...base, taskTitle: 'Fix <script>alert(1)</script> bug',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('produces a plain-text alternative ending in the link', () => {
    const { text } = renderTaskAssignedEmail(base);
    expect(text.startsWith(base.taskTitle)).toBe(true);
    expect(text.trimEnd().endsWith(base.taskUrl)).toBe(true);
  });

  it('lists the populated fields in the plain-text alternative', () => {
    const { text } = renderTaskAssignedEmail(base);
    expect(text).toContain('Section: Business Development');
    expect(text).toContain('Due: 2026-08-20');
    expect(text).toContain('Priority: high');
  });

  it('escapes html in the assigner name', () => {
    const { html } = renderTaskAssignedEmail({
      ...base, assignedBy: 'Ama <b>Mensah</b>',
    });
    expect(html).toContain('Ama &lt;b&gt;Mensah&lt;/b&gt;');
  });

  it('leaves the subject unescaped so mail clients show real characters', () => {
    const { subject } = renderTaskAssignedEmail({
      ...base, taskTitle: 'R&D review',
    });
    expect(subject).toBe("You've been assigned: R&D review");
  });
});
