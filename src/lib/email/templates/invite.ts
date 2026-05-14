import { escapeHtml, renderEmailLayout } from "./layout";

export function renderInviteEmail({
  inviteUrl,
  inviterName,
  recipientName,
}: {
  inviteUrl: string;
  inviterName?: string;
  recipientName?: string;
}): { subject: string; html: string; text: string } {
  const greeting = recipientName ? `Hi ${recipientName},` : "Hi there,";
  const byline = inviterName
    ? `${inviterName} has invited you to DC&A Hub PMS.`
    : "You have been invited to DC&A Hub PMS.";

  const html = renderEmailLayout({
    preheader: "Accept your invitation to DC&A Hub PMS",
    title: "You're invited to DC&A Hub PMS",
    bodyHtml: `
      <p>${escapeHtml(greeting)}</p>
      <p>${escapeHtml(byline)} Click the button below to set your password and finish creating your account.</p>
      <p style="font-size:12px;color:#6b7280;">This invitation link will expire for security reasons. If you weren't expecting this email you can safely ignore it.</p>
    `,
    cta: { label: "Accept invitation", href: inviteUrl },
  });

  const text = `${greeting}\n\n${byline}\n\nAccept your invitation:\n${inviteUrl}\n\nIf you weren't expecting this, you can ignore this email.`;

  return { subject: "You're invited to DC&A Hub PMS", html, text };
}
