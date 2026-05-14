/**
 * Minimal, self-contained inline-styled email layout. Inline styles only -
 * many mail clients strip <style> blocks. Kept intentionally plain so it
 * renders consistently across Gmail / Outlook / Apple Mail.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderEmailLayout({
  preheader,
  title,
  bodyHtml,
  cta,
  footerNote,
}: {
  preheader: string;
  title: string;
  bodyHtml: string;
  cta?: { label: string; href: string };
  footerNote?: string;
}): string {
  const safePre = escapeHtml(preheader);
  const safeTitle = escapeHtml(title);
  const ctaBlock = cta
    ? `<p style="margin:24px 0;">
        <a href="${cta.href}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px;">
          ${escapeHtml(cta.label)}
        </a>
      </p>
      <p style="margin:16px 0;font-size:12px;color:#6b7280;">
        Or paste this link into your browser:<br>
        <span style="word-break:break-all;color:#374151;">${cta.href}</span>
      </p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${safePre}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f4f6;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
            <tr>
              <td style="height:4px;background:linear-gradient(90deg,#111827,#374151);"></td>
            </tr>
            <tr>
              <td style="padding:28px 32px 8px 32px;">
                <h1 style="margin:0 0 12px 0;font-size:18px;font-weight:700;color:#111827;">${safeTitle}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px 32px;font-size:14px;line-height:1.6;color:#374151;">
                ${bodyHtml}
                ${ctaBlock}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px 32px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
                ${footerNote ? escapeHtml(footerNote) : "DC&amp;A Hub PMS"}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
