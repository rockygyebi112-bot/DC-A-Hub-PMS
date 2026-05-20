import { describe, expect, it } from 'vitest';
import { mapKoboSubmission } from '@/lib/evaluations/mapper';

const submission = {
  _id: 12345,
  _uuid: 'abc-uuid',
  _submission_time: '2026-05-19T10:00:00Z',
  s0_a4: 'Northern',
  s0_a5: 'Tamale',
  s0_a7: 'Sagnarigu',
  s1_a1: 'female',
  s1_a2: '34',
  s7_qc_status: 'approved',
} as Record<string, unknown>;

const schemaConfig = {
  s0_a4: 'region',
  s0_a5: 'district',
  s0_a7: 'community',
  s1_a1: 'gender',
  s1_a2: 'age',
  s7_qc_status: 'qc_status',
};

describe('mapKoboSubmission', () => {
  it('maps semantic fields out of raw', () => {
    const row = mapKoboSubmission(submission, schemaConfig, 'inst-1');
    expect(row.instrument_id).toBe('inst-1');
    expect(row.kobo_submission_uuid).toBe('abc-uuid');
    expect(row.kobo_submission_id).toBe(12345);
    expect(row.region).toBe('Northern');
    expect(row.district).toBe('Tamale');
    expect(row.community).toBe('Sagnarigu');
    expect(row.gender).toBe('female');
    expect(row.age).toBe(34);
    expect(row.qc_status).toBe('approved');
    expect(row.raw).toEqual(submission);
  });

  it('defaults qc_status to pending when not mapped', () => {
    const { qc_status } = mapKoboSubmission(
      submission, { _id: 'kobo_submission_id' }, 'inst-1');
    expect(qc_status).toBe('pending');
  });

  it('coerces age to int and tolerates missing fields', () => {
    const row = mapKoboSubmission(
      { _id: 1, _uuid: 'u', _submission_time: '2026-05-19T10:00:00Z' },
      schemaConfig, 'inst-1');
    expect(row.age).toBeNull();
    expect(row.region).toBeNull();
  });
});
