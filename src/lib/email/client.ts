import "server-only";

import { Resend } from "resend";

let _client: Resend | null = null;

/**
 * Lazily-initialised Resend client. Throws a clear error at first use if the
 * API key is missing, instead of failing silently with an SDK-level "401" the
 * caller cannot easily attribute.
 */
export function getResend(): Resend {
  if (_client) return _client;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not configured. Set it in the environment to send emails.",
    );
  }
  _client = new Resend(apiKey);
  return _client;
}

/**
 * Resolves the verified-domain sender, e.g. `"DC&A Hub PMS <noreply@example.com>"`.
 * Per Resend guidance, `onboarding@resend.dev` is for testing only and must
 * not be used in production; we surface a hard error when the env var is
 * missing in production so a misconfiguration is caught loudly.
 */
export function getEmailFrom(): string {
  const from = process.env.RESEND_FROM_EMAIL;
  if (from) return from;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "RESEND_FROM_EMAIL is not configured. Set a sender on your verified domain.",
    );
  }
  return "DC&A Hub PMS <onboarding@resend.dev>";
}
