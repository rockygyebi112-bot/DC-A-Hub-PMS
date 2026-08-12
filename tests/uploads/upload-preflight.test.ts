import { describe, it, expect } from 'vitest';
import { tooLarge } from '@/components/internal/task-documents-card';
import { MAX_PROOF_BYTES } from '@/lib/uploads';

/** A File of a given size without allocating the bytes. */
const sized = (name: string, size: number): File =>
  Object.defineProperty(new File([], name), 'size', { value: size });

describe('tooLarge (upload pre-flight)', () => {
  it('passes a batch within the cap', () => {
    expect(tooLarge([sized('report.pdf', 2 * 1024 * 1024)])).toBeNull();
    expect(
      tooLarge([sized('a.pdf', 5 * 1024 * 1024), sized('b.pdf', 5 * 1024 * 1024)]),
    ).toBeNull();
  });

  it('names the offending file when one exceeds the per-file cap', () => {
    const reason = tooLarge([sized('huge.pdf', MAX_PROOF_BYTES + 1)]);
    expect(reason).toContain('huge.pdf');
  });

  it('catches a batch whose total exceeds the cap even when each file is legal', () => {
    // Each file is under MAX_PROOF_BYTES, so per-file validation would let
    // these through — but the Server Action body limit applies to the batch.
    const half = Math.ceil(MAX_PROOF_BYTES * 0.6);
    const reason = tooLarge([sized('a.pdf', half), sized('b.pdf', half)]);
    expect(reason).toContain('2 files');
  });
});
