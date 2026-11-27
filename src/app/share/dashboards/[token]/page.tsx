import { notFound } from "next/navigation";
import { DashboardViewer } from "@/components/portal/dashboard-viewer";
import { DashboardGuestVerification } from "@/components/portal/dashboard-guest-verification";
import { getActiveInvitation, guestTokenPattern, matchesGuestSession } from "@/lib/unesco-dashboards/guest-links";
import { unescoDashboards } from "@/lib/unesco-dashboards/routes";

export const dynamic = "force-dynamic";
export const metadata = { title: "UNESCO dashboard invitation", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function GuestDashboardPage({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ verify?: string | string[] }>;
}) {
  const [{ token: id }, { verify }] = await Promise.all([params, searchParams]);
  const invitation = await getActiveInvitation(id);
  if (!invitation) notFound();
  const slug = invitation.dashboard_slug;
  const { title } = unescoDashboards[slug];
  if (!(await matchesGuestSession(id, invitation.session_hash))) {
    return (
      <main className="mx-auto max-w-xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold">{title} invitation</h1>
        <DashboardGuestVerification id={id} token={typeof verify === "string" && guestTokenPattern.test(verify) ? verify : undefined} />
      </main>
    );
  }
  return (
    <main className="mx-auto w-full max-w-7xl p-4">
      <DashboardViewer
        title={title}
        source={`/api/projects/${invitation.project_id}/dashboards/${slug}/content?guest=${id}`}
      />
    </main>
  );
}
