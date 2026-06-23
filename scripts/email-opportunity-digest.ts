/**
 * Email the latest opportunity-scanner digest to the DC&A Hub team.
 *
 * Standalone CLI / scheduled-run script (does NOT import the app's
 * `server-only` email layer). Reuses the same env vars the PMS uses:
 *   - RESEND_API_KEY      (required)
 *   - RESEND_FROM_EMAIL   (verified-domain sender, e.g. "DC&A Hub <scanner@dcahub.com>")
 *
 * Usage:
 *   npx tsx scripts/email-opportunity-digest.ts                # newest digest -> default recipients
 *   npx tsx scripts/email-opportunity-digest.ts --to rgyebi@dcahub.com   # override recipients (comma-sep)
 *   npx tsx scripts/email-opportunity-digest.ts path/to/digest.md        # send a specific file
 */
import { config as loadEnv } from "dotenv";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Resend } from "resend";

loadEnv({ path: ".env.local" });

const DEFAULT_RECIPIENTS = [
  "rgyebi@dcahub.com",
  "fapedo@dcahub.com",
  "sapanya@dcahub.com",
];

const SCANS_DIR = "opportunity-scans";

/** Parse CLI args: an optional digest path, and an optional `--to a@b,c@d`. */
function parseArgs(argv: string[]): { file?: string; to: string[] } {
  let to = DEFAULT_RECIPIENTS;
  let file: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--to") {
      to = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    } else if (!argv[i].startsWith("--")) {
      file = argv[i];
    }
  }
  return { file, to };
}

/** Newest `*-digest.md` in the scans dir, or null if none. */
function latestDigest(): string | null {
  let entries: string[];
  try {
    entries = readdirSync(SCANS_DIR);
  } catch {
    return null;
  }
  const digests = entries.filter((f) => f.endsWith("-digest.md")).sort();
  if (digests.length === 0) return null;
  return path.join(SCANS_DIR, digests[digests.length - 1]);
}

/** Minimal, dependency-free Markdown -> HTML (headings, bold, links, lists, hr). */
function mdToHtml(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
  const out: string[] = [];
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (/^### /.test(line)) out.push(`<h3>${inline(line.slice(4))}</h3>`);
    else if (/^## /.test(line)) out.push(`<h2>${inline(line.slice(3))}</h2>`);
    else if (/^# /.test(line)) out.push(`<h1>${inline(line.slice(2))}</h1>`);
    else if (/^---+$/.test(line)) out.push("<hr/>");
    else if (/^[-*] /.test(line)) out.push(`<li>${inline(line.slice(2))}</li>`);
    else if (line === "") out.push("");
    else out.push(`<p>${inline(line)}</p>`);
  }
  return `<div style="font-family:system-ui,Arial,sans-serif;font-size:14px;line-height:1.5;color:#1c1c1c;max-width:720px">${out.join(
    "\n",
  )}</div>`;
}

async function main() {
  const { file, to } = parseArgs(process.argv.slice(2));
  const digestPath = file ?? latestDigest();
  if (!digestPath) {
    console.error(`No digest found in ${SCANS_DIR}/. Run the opportunity-scanner first.`);
    process.exit(1);
  }

  const markdown = readFileSync(digestPath, "utf8");
  const firstLine = markdown.split(/\r?\n/)[0]?.replace(/^#\s*/, "").trim();
  const subject = firstLine || `DC&A Hub Opportunity Scan — ${path.basename(digestPath)}`;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set (check .env.local).");
    process.exit(1);
  }
  if (!from) {
    console.error("RESEND_FROM_EMAIL is not set (must be a verified-domain sender).");
    process.exit(1);
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to,
    subject,
    html: mdToHtml(markdown),
    text: markdown,
    tags: [{ name: "category", value: "opportunity_digest" }],
  });

  if (error || !data) {
    console.error("Send failed:", error?.message ?? "unknown error");
    process.exit(1);
  }
  console.log(`Sent "${subject}"`);
  console.log(`  file: ${digestPath}`);
  console.log(`  to:   ${to.join(", ")}`);
  console.log(`  id:   ${data.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
