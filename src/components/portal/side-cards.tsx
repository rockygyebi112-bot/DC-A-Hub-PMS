import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  HeadphonesIcon,
  ImageIcon,
  Megaphone,
  Paperclip,
  Play,
} from "lucide-react";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import type {
  PortalActivityFeedItem,
  PortalAnnouncement,
  PortalDocument,
  PortalManager,
} from "@/lib/portal/queries";
import { cn } from "@/lib/utils";

/* -------------------- helpers -------------------- */

function formatRelative(iso: string) {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const week = Math.floor(day / 7);
  return `${week}w ago`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function PortalSection({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[14px] border bg-card shadow-card">
      <header className="flex items-center justify-between border-b px-5 py-3.5">
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          {title}
        </h2>
        {href && (
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            View all
            <ArrowRight className="size-3" />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

/* -------------------- Announcements -------------------- */

const ANNOUNCEMENT_STYLES: Record<
  string,
  { tone: string; icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  marked_done: {
    tone: "bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
    label: "completed",
  },
  proof_added: {
    tone: "bg-blue-50 text-blue-700",
    icon: Paperclip,
    label: "Proof uploaded",
  },
  started: {
    tone: "bg-amber-50 text-amber-700",
    icon: Play,
    label: "Activity started",
  },
};

function announcementCopy(item: PortalAnnouncement) {
  const meta = ANNOUNCEMENT_STYLES[item.action] ?? {
    tone: "bg-muted text-muted-foreground",
    icon: Megaphone,
    label: item.action,
  };
  let title = "Project update";
  let description = "";
  if (item.action === "marked_done" && item.activity_name) {
    title = `${item.activity_name} completed`;
    description = item.phase_name ? `Phase: ${item.phase_name}` : "Activity completed";
  } else if (item.action === "proof_added" && item.activity_name) {
    title = `New proof: ${item.activity_name}`;
    description = "A new file was attached as evidence.";
  } else if (item.action === "started" && item.activity_name) {
    title = `${item.activity_name} started`;
    description = item.phase_name ? `Phase: ${item.phase_name}` : "Work in progress";
  }
  return { ...meta, title, description };
}

export function AnnouncementsCard({
  items,
  projectId,
}: {
  items: PortalAnnouncement[];
  projectId: string;
}) {
  return (
    <PortalSection
      title="Announcements"
      href={`/portal/projects/${projectId}#announcements`}
    >
      {items.length === 0 ? (
        <div className="px-5 py-8 text-center text-xs text-muted-foreground">
          No announcements yet.
        </div>
      ) : (
        <ul className="divide-y">
          {items.slice(0, 4).map((item) => {
            const { tone, icon: Icon, title, description } = announcementCopy(item);
            return (
              <li
                key={item.id}
                className="flex items-start gap-3 px-5 py-3"
              >
                <span
                  className={cn(
                    "mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg",
                    tone,
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium leading-snug">
                    {title}
                  </p>
                  {description && (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                      {description}
                    </p>
                  )}
                </div>
                <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">
                  {formatRelative(item.created_at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </PortalSection>
  );
}

/* -------------------- Key documents -------------------- */

function fileTypePill(name: string, mime: string | null) {
  const ext = name.split(".").pop()?.toUpperCase() ?? "";
  const knownExt = ["PDF", "XLSX", "DOCX", "CSV", "PPTX", "PNG", "JPG", "JPEG"];
  if (knownExt.includes(ext)) return ext === "JPEG" ? "JPG" : ext;
  if (mime?.includes("pdf")) return "PDF";
  if (mime?.includes("sheet")) return "XLSX";
  if (mime?.includes("word")) return "DOCX";
  if (mime?.startsWith("image/")) return "IMG";
  return "FILE";
}

function fileIcon(pill: string) {
  if (pill === "PDF") return { Icon: FileText, color: "text-red-600 bg-red-50" };
  if (pill === "XLSX" || pill === "CSV")
    return { Icon: FileSpreadsheet, color: "text-emerald-600 bg-emerald-50" };
  if (pill === "DOCX")
    return { Icon: FileText, color: "text-blue-600 bg-blue-50" };
  if (pill === "IMG" || pill === "JPG" || pill === "PNG")
    return { Icon: ImageIcon, color: "text-purple-600 bg-purple-50" };
  return { Icon: FileText, color: "text-muted-foreground bg-muted" };
}

export function KeyDocumentsCard({
  documents,
  projectId,
}: {
  documents: PortalDocument[];
  projectId: string;
}) {
  return (
    <PortalSection
      title="Key documents"
      href={`/portal/projects/${projectId}#documents`}
    >
      {documents.length === 0 ? (
        <div className="px-5 py-8 text-center text-xs text-muted-foreground">
          No documents shared yet.
        </div>
      ) : (
        <ul className="divide-y">
          {documents.slice(0, 4).map((doc) => {
            const isLink = doc.kind === "link";
            const pill = isLink ? "LINK" : fileTypePill(doc.file_name, doc.mime_type);
            const { Icon, color } = isLink
              ? { Icon: FileText, color: "text-muted-foreground bg-muted" }
              : fileIcon(pill);
            const href = isLink ? doc.url ?? "#" : doc.signedUrl ?? "#";
            const displayName = doc.activity_name ?? doc.file_name;
            return (
              <li
                key={doc.id}
                className="flex items-center gap-3 px-5 py-3"
              >
                <span
                  className={cn(
                    "inline-flex size-8 shrink-0 items-center justify-center rounded-lg",
                    color,
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium">
                    {displayName}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="rounded border px-1.5 py-px font-mono text-[10px] font-semibold tracking-wide">
                      {pill}
                    </span>
                    <span>{formatDate(doc.created_at)}</span>
                  </div>
                </div>
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={`Download ${doc.file_name}`}
                >
                  <Download className="size-3.5" />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </PortalSection>
  );
}

/* -------------------- Recent activity -------------------- */

const ACTIVITY_DOT: Record<string, string> = {
  marked_done: "bg-emerald-500",
  proof_added: "bg-blue-500",
  started: "bg-amber-500",
};

function recentActivityCopy(item: PortalActivityFeedItem) {
  const actor = item.actor_name ?? "Team";
  if (item.action === "marked_done" && item.activity_name) {
    return `${actor} completed ${item.activity_name}`;
  }
  if (item.action === "started" && item.activity_name) {
    return `${actor} started ${item.activity_name}`;
  }
  if (item.action === "proof_added" && item.activity_name) {
    return `${actor} uploaded proof for ${item.activity_name}`;
  }
  return `${actor} updated the project`;
}

export function RecentActivityCard({
  items,
  projectId,
}: {
  items: PortalActivityFeedItem[];
  projectId: string;
}) {
  return (
    <PortalSection
      title="Recent activity"
      href={`/portal/projects/${projectId}#activity`}
    >
      {items.length === 0 ? (
        <div className="px-5 py-8 text-center text-xs text-muted-foreground">
          No recent activity.
        </div>
      ) : (
        <ul className="divide-y sm:grid sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
          {items.slice(0, 3).map((item) => (
            <li key={item.id} className="flex items-start gap-3 px-5 py-3">
              <UserAvatar
                name={item.actor_name ?? "Team"}
                email={item.actor_name ?? "team"}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm leading-snug">
                  <span className="font-medium">{item.actor_name ?? "Team"}</span>{" "}
                  <span className="text-muted-foreground">
                    {recentActivityCopy(item).replace(item.actor_name ?? "Team", "").trim()}
                  </span>
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      ACTIVITY_DOT[item.action] ?? "bg-muted-foreground/40",
                    )}
                  />
                  <span className="text-[11px] text-muted-foreground">
                    {formatRelative(item.created_at)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PortalSection>
  );
}

/* -------------------- Need help -------------------- */

export function NeedHelpCard({ manager }: { manager: PortalManager | null }) {
  const href = manager ? `mailto:${manager.email}` : "mailto:support@dca-hub.com";
  return (
    <section className="rounded-[14px] border bg-card p-5 shadow-card">
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <HeadphonesIcon className="size-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h3 className="font-heading text-sm font-semibold tracking-tight">
              Need help?
            </h3>
            <p className="text-xs text-muted-foreground">
              Reach out to the project team for any questions or support you may need.
            </p>
          </div>
          <Link
            href={href}
            className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
          >
            <HeadphonesIcon className="size-3.5" />
            Contact project team
          </Link>
        </div>
      </div>
    </section>
  );
}
