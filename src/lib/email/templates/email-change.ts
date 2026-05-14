import { escapeHtml, renderEmailLayout } from "./layout";

/**
 * Supabase's "secure email change" flow requires confirmation from BOTH the
 * current address (to authorise the change) and the new address (to prove
 * ownership). We send two distinct emails so the wording matches the audience.
 */
export function renderEmailChangeCurrent({
  confirmUrl,
  newEmail,
}: {
  confirmUrl: string;
  newEmail: string;
}): { subject: string; html: string; text: string } {
  const html = renderEmailLayout({
    preheader: "Confirm the email change on your DC&A Hub PMS account",
    title: "Confirm email change",
    bodyHtml: `
      <p>We received a request to change the email on your DC&amp;A Hub PMS account to <strong>${escapeHtml(newEmail)}</strong>.</p>
      <p>Click the button below to authorise this change from your current address.</p>
      <p style="font-size:12px;color:#6b7280;">If you didn't request this, ignore this email and your address will not change.</p>
    `,
    cta: { label: "Confirm change", href: confirmUrl },
  });
  const text = `Confirm email change\n\nWe received a request to change the email on your DC&A Hub PMS account to ${newEmail}.\n\nAuthorise the change:\n${confirmUrl}\n\nIf you didn't request this, you can ignore this email.`;
  return { subject: "Confirm email change on DC&A Hub PMS", html, text };
}

export function renderEmailChangeNew({
  confirmUrl,
}: {
  confirmUrl: string;
}): { subject: string; html: string; text: string } {
  const html = renderEmailLayout({
    preheader: "Verify your new email address for DC&A Hub PMS",
    title: "Verify your new email",
    bodyHtml: `
      <p>This address was set as the new login email for a DC&amp;A Hub PMS account. Click the button below to verify it.</p>
      <p style="font-size:12px;color:#6b7280;">If you don't recognise this request, ignore this email.</p>
    `,
    cta: { label: "Verify new email", href: confirmUrl },
  });
  const text = `Verify your new email\n\nThis address was set as the new login email for a DC&A Hub PMS account.\n\nVerify it:\n${confirmUrl}\n\nIf you don't recognise this, you can ignore this email.`;
  return { subject: "Verify your new DC&A Hub PMS email", html, text };
}
