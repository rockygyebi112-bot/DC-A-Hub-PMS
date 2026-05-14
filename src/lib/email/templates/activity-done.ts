import { escapeHtml, renderEmailLayout } from "./layout";

export function renderActivityDoneEmail({
  projectName,
  activityName,
  completedDate,
  narrativeNote,
  portalUrl,
}: {
  projectName: string;
  activityName: string;
  completedDate: string | null;
  narrativeNote: string | null;
  portalUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `[${projectName}] New activity completed: ${activityName}`;
  const html = renderEmailLayout({
    preheader: `${activityName} was completed on ${projectName}`,
    title: activityName,
    bodyHtml: `
      <p><strong>Project:</strong> ${escapeHtml(projectName)}</p>
      <p><strong>Completed:</strong> ${escapeHtml(completedDate ?? "Today")}</p>
      <p>${escapeHtml(narrativeNote ?? "A project activity has been marked complete.")}</p>
    `,
    cta: { label: "Open activity document", href: portalUrl },
  });
  const text = `${activityName}\n\nProject: ${projectName}\nCompleted: ${completedDate ?? "Today"}\n\n${narrativeNote ?? "A project activity has been marked complete."}\n\n${portalUrl}`;
  return { subject, html, text };
}
