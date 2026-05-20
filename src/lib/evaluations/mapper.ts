import { QC_STATUSES } from './schemas';

/** Accepts any record of Kobo fields; required keys of `KoboSubmission`
 * (`_id`, `_uuid`, `_submission_time`) are read defensively (coerced to
 * string) so partial inputs are tolerated. */
type RawSubmission = Record<string, unknown>;

export type MappedResponse = {
  instrument_id: string;
  kobo_submission_uuid: string;
  kobo_submission_id: number | null;
  submitted_at: string;
  raw: RawSubmission;
  region: string | null;
  district: string | null;
  cluster: string | null;
  community: string | null;
  gender: string | null;
  age: number | null;
  qc_status: (typeof QC_STATUSES)[number];
};

const QC_VALUES = new Set<string>(QC_STATUSES);

function pick(
  sub: RawSubmission,
  schemaConfig: Record<string, string>,
  target: string,
): unknown {
  for (const [koboKey, semantic] of Object.entries(schemaConfig)) {
    if (semantic === target) return sub[koboKey];
  }
  return undefined;
}

function asString(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  return String(v);
}

function asInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

function asQcStatus(v: unknown): MappedResponse['qc_status'] {
  if (typeof v === 'string' && QC_VALUES.has(v)) {
    return v as MappedResponse['qc_status'];
  }
  return 'pending';
}

export function mapKoboSubmission(
  sub: RawSubmission,
  schemaConfig: Record<string, string>,
  instrumentId: string,
): MappedResponse {
  return {
    instrument_id: instrumentId,
    kobo_submission_uuid: String(sub._uuid),
    kobo_submission_id: asInt(sub._id),
    submitted_at: String(sub._submission_time),
    raw: sub,
    region: asString(pick(sub, schemaConfig, 'region')),
    district: asString(pick(sub, schemaConfig, 'district')),
    cluster: asString(pick(sub, schemaConfig, 'cluster')),
    community: asString(pick(sub, schemaConfig, 'community')),
    gender: asString(pick(sub, schemaConfig, 'gender')),
    age: asInt(pick(sub, schemaConfig, 'age')),
    qc_status: asQcStatus(pick(sub, schemaConfig, 'qc_status')),
  };
}
