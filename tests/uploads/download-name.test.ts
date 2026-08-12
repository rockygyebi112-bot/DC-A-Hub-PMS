import { describe, it, expect } from 'vitest';
import { withDownloadName } from '@/lib/uploads';

const SIGNED =
  'https://x.supabase.co/storage/v1/object/sign/proofs/internal/tasks/t1/33b91fce-DARE_Work.pdf?token=abc.def';

describe('withDownloadName', () => {
  it('appends the download name to a signed URL that already has a query', () => {
    expect(withDownloadName(SIGNED, 'DARE Work Enabling Data.pdf')).toBe(
      `${SIGNED}&download=DARE%20Work%20Enabling%20Data.pdf`,
    );
  });

  it('starts the query when the URL has none', () => {
    expect(withDownloadName('https://x.co/file', 'Report.pdf')).toBe(
      'https://x.co/file?download=Report.pdf',
    );
  });

  it('encodes characters that would otherwise split the query', () => {
    // encodeURI leaves & and # intact, which truncates the filename and can
    // break the token that precedes it — encodeURIComponent does not.
    expect(withDownloadName(SIGNED, 'Q1 & Q2 #final.pdf')).toBe(
      `${SIGNED}&download=Q1%20%26%20Q2%20%23final.pdf`,
    );
  });

  it('leaves the URL alone when there is no name to apply', () => {
    expect(withDownloadName(SIGNED, '')).toBe(SIGNED);
    expect(withDownloadName(SIGNED, '   ')).toBe(SIGNED);
  });
});
