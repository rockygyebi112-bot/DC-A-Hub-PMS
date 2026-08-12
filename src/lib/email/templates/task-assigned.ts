import { escapeHtml, renderEmailLayout } from "./layout";

export function renderTaskAssignedEmail({
  taskTitle,
  sectionName,
  dueDate,
  priority,
  assignedBy,
  taskUrl,
}: {
  taskTitle: string;
  sectionName: string | null;
  dueDate: string | null;
  priority: string | null;
  assignedBy: string;
  taskUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `You've been assigned: ${taskTitle}`;

  const detailRows = [
    sectionName ? `<p><strong>Section:</strong> ${escapeHtml(sectionName)}</p>` : "",
    dueDate ? `<p><strong>Due:</strong> ${escapeHtml(dueDate)}</p>` : "",
    priority ? `<p><strong>Priority:</strong> ${escapeHtml(priority)}</p>` : "",
  ].join("");

  const html = renderEmailLayout({
    preheader: `${assignedBy} assigned you a task on the DC&A Hub PMS`,
    title: taskTitle,
    bodyHtml: `
      <p>${escapeHtml(assignedBy)} assigned you a task.</p>
      ${detailRows}
    `,
    cta: { label: "Open task", href: taskUrl },
  });

  const text = [
    taskTitle,
    "",
    `${assignedBy} assigned you a task.`,
    sectionName ? `Section: ${sectionName}` : null,
    dueDate ? `Due: ${dueDate}` : null,
    priority ? `Priority: ${priority}` : null,
    "",
    taskUrl,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return { subject, html, text };
}
