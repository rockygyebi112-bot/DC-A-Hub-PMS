import { describe, expect, it } from 'vitest';
import { resolveAssignmentRecipients } from '@/lib/internal/notification-recipients';

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

  it('ignores empty-string ids from unfilled form fields', () => {
    expect(resolveAssignmentRecipients(['', ALICE], ACTOR)).toEqual([ALICE]);
  });

  it('handles an empty assignee list', () => {
    expect(resolveAssignmentRecipients([], ACTOR)).toEqual([]);
  });
});
