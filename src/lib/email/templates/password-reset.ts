import { renderEmailLayout } from "./layout";

export function renderPasswordResetEmail({
  resetUrl,
  isInitialSetup,
}: {
  resetUrl: string;
  isInitialSetup?: boolean;
}): { subject: string; html: string; text: string } {
  const title = isInitialSetup ? "Set your password" : "Reset your password";
  const subject = isInitialSetup
    ? "Set your password for DC&A Hub PMS"
    : "Reset your DC&A Hub PMS password";

  const intro = isInitialSetup
    ? "An account has been created for you on DC&A Hub PMS. Use the button below to set your password and sign in."
    : "We received a request to reset the password for your DC&A Hub PMS account. Use the button below to choose a new password.";

  const html = renderEmailLayout({
    preheader: title,
    title,
    bodyHtml: `
      <p>${intro}</p>
      <p style="font-size:12px;color:#6b7280;">If you didn't request this, you can safely ignore this email. This link will expire for security reasons.</p>
    `,
    cta: { label: title, href: resetUrl },
  });

  const text = `${title}\n\n${intro}\n\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`;
  return { subject, html, text };
}
