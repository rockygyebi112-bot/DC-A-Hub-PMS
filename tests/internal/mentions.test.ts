import { describe, it, expect } from 'vitest';
import {
  extractMentionIds,
  parseMentions,
  findMentionQuery,
} from '@/lib/internal/mentions';

const KWAME = '3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607';
const AMA = '7e8d9c0b-1a2b-4c3d-9e8f-0a1b2c3d4e5f';

const mention = (name: string, id: string) => `@[${name}](${id})`;

describe('extractMentionIds', () => {
  it('returns the ids mentioned, in first-appearance order', () => {
    const body = `${mention('Ama Serwaa', AMA)} and ${mention('Kwame Gyebi', KWAME)} please review`;
    expect(extractMentionIds(body)).toEqual([AMA, KWAME]);
  });

  it('de-duplicates someone mentioned more than once', () => {
    const body = `${mention('Kwame Gyebi', KWAME)} see below — ${mention('Kwame Gyebi', KWAME)}`;
    expect(extractMentionIds(body)).toEqual([KWAME]);
  });

  it('ignores bare @names and malformed markup', () => {
    expect(extractMentionIds('@Kwame please look')).toEqual([]);
    expect(extractMentionIds('@[Kwame Gyebi](not-a-uuid)')).toEqual([]);
    expect(extractMentionIds('@[Kwame Gyebi]')).toEqual([]);
    expect(extractMentionIds('email kgyebi112@gmail.com')).toEqual([]);
  });

  it('returns nothing for an empty body', () => {
    expect(extractMentionIds('')).toEqual([]);
  });
});

describe('parseMentions', () => {
  it('segments text before, between, and after mentions', () => {
    const body = `Hi ${mention('Ama Serwaa', AMA)} and ${mention('Kwame Gyebi', KWAME)}!`;
    expect(parseMentions(body)).toEqual([
      { type: 'text', value: 'Hi ' },
      { type: 'mention', id: AMA, name: 'Ama Serwaa' },
      { type: 'text', value: ' and ' },
      { type: 'mention', id: KWAME, name: 'Kwame Gyebi' },
      { type: 'text', value: '!' },
    ]);
  });

  it('returns a single text segment when there are no mentions', () => {
    expect(parseMentions('Just a comment')).toEqual([
      { type: 'text', value: 'Just a comment' },
    ]);
  });

  it('treats markup-shaped text with a bad id as literal text', () => {
    const body = '@[Kwame Gyebi](oops)';
    expect(parseMentions(body)).toEqual([{ type: 'text', value: body }]);
  });
});

describe('findMentionQuery', () => {
  it('opens on @ at the start of the input', () => {
    expect(findMentionQuery('@', 1)).toEqual({ query: '', start: 0 });
    expect(findMentionQuery('@kw', 3)).toEqual({ query: 'kw', start: 0 });
  });

  it('opens on @ that follows whitespace', () => {
    expect(findMentionQuery('Hi @kw', 6)).toEqual({ query: 'kw', start: 3 });
  });

  it('stays closed inside an email address', () => {
    expect(findMentionQuery('kgyebi112@gmail.com', 19)).toBeNull();
    expect(findMentionQuery('mail kgyebi112@gmail', 20)).toBeNull();
  });

  it('allows one internal space so full names can be filtered', () => {
    expect(findMentionQuery('@Kwame Gy', 9)).toEqual({
      query: 'Kwame Gy',
      start: 0,
    });
  });

  it('closes on a second space', () => {
    expect(findMentionQuery('@Kwame Gyebi wrote', 18)).toBeNull();
  });

  it('closes once a mention has been inserted', () => {
    const text = `${mention('Kwame Gyebi', KWAME)} `;
    expect(findMentionQuery(text, text.length)).toBeNull();
  });

  it('ignores an @ that sits after the caret', () => {
    expect(findMentionQuery('hello @kw', 5)).toBeNull();
  });

  it('does not span a line break', () => {
    expect(findMentionQuery('@kw\nnext line', 13)).toBeNull();
  });
});
