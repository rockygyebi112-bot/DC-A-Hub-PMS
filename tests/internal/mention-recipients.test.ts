import { describe, it, expect } from 'vitest';
import { resolveMentionRecipients } from '@/lib/internal/notification-recipients';

const KWAME = '3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607';
const AMA = '7e8d9c0b-1a2b-4c3d-9e8f-0a1b2c3d4e5f';
const KOFI = '11112222-3333-4444-5555-666677778888';

describe('resolveMentionRecipients', () => {
  it('notifies everyone mentioned', () => {
    expect(resolveMentionRecipients([KWAME, AMA], KOFI)).toEqual([KWAME, AMA]);
  });

  it('never notifies you about your own comment', () => {
    expect(resolveMentionRecipients([KWAME, AMA], KWAME)).toEqual([AMA]);
  });

  it('sends one notification when someone is mentioned twice', () => {
    expect(resolveMentionRecipients([AMA, AMA], KOFI)).toEqual([AMA]);
  });

  it('is safe on a comment with no mentions', () => {
    expect(resolveMentionRecipients([], KOFI)).toEqual([]);
  });

  it('drops empty ids rather than passing them to the insert', () => {
    expect(resolveMentionRecipients(['', AMA], KOFI)).toEqual([AMA]);
  });
});
