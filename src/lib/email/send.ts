import "server-only";

import { getResend, getEmailFrom } from "./client";

export type EmailCategory =
  | "invite"
  | "password_reset"
  | "email_change"
  | "activity_notification";

export type SendEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  /** Stable, unique-per-logical-action key. Prevents duplicate sends on retry. */
  idempotencyKey?: string;
  /** Resend tag for dashboard filtering. */
  category: EmailCategory;
  /** Additional tags (alphanumeric/underscore name & value, ASCII only). */
  extraTags?: Array<{ name: string; value: string }>;
  replyTo?: string | string[];
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Thin wrapper around `resend.emails.send` that enforces our `{ data, error }`
 * handling style, attaches a `category` tag for observability, and threads the
 * Resend idempotency key. Per Resend SDK guidance we do NOT use try/catch
 * around the call - the SDK returns `{ data, error }` rather than throwing for
 * API-level failures.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const resend = getResend();
  const tags = [
    { name: "category", value: params.category },
    ...(params.extraTags ?? []),
  ];

  const { data, error } = await resend.emails.send(
    {
      from: getEmailFrom(),
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
      tags,
    },
    params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : undefined,
  );

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to send email" };
  }
  return { ok: true, id: data.id };
}
