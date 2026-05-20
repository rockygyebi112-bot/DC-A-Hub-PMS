import "server-only";

import { createServiceClient } from "@/lib/supabase/server";

import { decryptToken } from "./kobo-crypto";

const BASE_URL =
  process.env.KOBO_API_BASE_URL ?? "https://kc.kobotoolbox.org/api/v2";

export type KoboSubmission = {
  _id: number;
  _uuid: string;
  _submission_time: string;
  [key: string]: unknown;
};

/**
 * Decode a Postgres `bytea` value as returned by supabase-js / PostgREST into a
 * Buffer. PostgREST returns bytea as a `\x`-prefixed hex string (the default
 * `bytea_output` setting). This function also tolerates a value that is already
 * a Buffer/Uint8Array, or a plain hex string without the prefix.
 *
 * The store side (Task 14) writes ciphertext as `'\\x' + buf.toString('hex')`
 * — see kobo-crypto.ts for the storage-format contract.
 */
export function byteaToBuffer(raw: unknown): Buffer {
  if (Buffer.isBuffer(raw)) return raw;
  if (raw instanceof Uint8Array) return Buffer.from(raw);
  if (typeof raw === "string") {
    if (raw.startsWith("\\x")) {
      return Buffer.from(raw.slice(2), "hex");
    }
    // Fallback: bare hex string.
    return Buffer.from(raw, "hex");
  }
  throw new Error(`Unsupported bytea value type: ${typeof raw}`);
}

export async function decryptKoboToken(instrumentId: string): Promise<string> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("evaluation_instruments")
    .select("kobo_api_token_encrypted")
    .eq("id", instrumentId)
    .single();
  if (error) throw new Error(`kobo token lookup: ${error.message}`);
  const raw = data?.kobo_api_token_encrypted;
  if (!raw) throw new Error("No Kobo token configured for instrument");
  const buf = byteaToBuffer(raw);
  return decryptToken(buf);
}

// Hard cap on pages fetched from the Kobo /data endpoint. At pageSize 200 this
// allows 200k submissions — far above the ~2k expected — and exists purely to
// break out if a misbehaving server ignores the `start` param.
const MAX_PAGES = 1000;

export async function* iterateKoboSubmissions(opts: {
  instrumentId: string;
  koboFormId: string;
  since?: string | null;
  pageSize?: number;
}): AsyncGenerator<KoboSubmission, void, void> {
  const token = await decryptKoboToken(opts.instrumentId);
  const pageSize = opts.pageSize ?? 200;
  let start = 0;
  let pages = 0;

  while (true) {
    if (pages >= MAX_PAGES) {
      throw new Error(
        `Kobo pagination exceeded MAX_PAGES (${MAX_PAGES}) — server may be ignoring the start parameter`
      );
    }
    pages += 1;
    const params = new URLSearchParams({
      start: String(start),
      limit: String(pageSize),
    });
    if (opts.since) {
      params.set(
        "query",
        JSON.stringify({ _submission_time: { $gt: opts.since } })
      );
    }
    const url = `${BASE_URL}/assets/${opts.koboFormId}/data/?${params.toString()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Token ${token}`, Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(
        `Kobo fetch ${res.status}: ${await res.text().catch(() => "")}`
      );
    }
    let body: { results?: KoboSubmission[] };
    try {
      body = (await res.json()) as { results?: KoboSubmission[] };
    } catch (err) {
      throw new Error(
        `Kobo fetch ${url}: response body was not valid JSON (${
          err instanceof Error ? err.message : String(err)
        })`
      );
    }
    const batch = body.results ?? [];
    for (const s of batch) yield s;
    if (batch.length < pageSize) return;
    start += batch.length;
  }
}
