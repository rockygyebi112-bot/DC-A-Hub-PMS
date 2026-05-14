import { notFound } from "next/navigation";
import { ActivityDetailView } from "@/components/workspace/activity-detail-view";
import { getPortalActivity } from "@/lib/portal/queries";
import {
  portalPostActivityUpdate,
  portalUploadActivityDocuments,
} from "@/lib/portal/actions";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export default async function PortalActivityPage({
  params,
}: {
  params: Promise<{ id: string; activityId: string }>;
}) {
  const { id, activityId } = await params;
  const [profile, { activity, proofs, timeline, team }] = await Promise.all([
    getCurrentProfile(),
    getPortalActivity(activityId),
  ]);
  if (!profile) notFound();

  const teamUsers = team
    .map((m) => m.profile)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({ name: p.full_name, email: p.email }));

  async function postUpdate(formData: FormData) {
    "use server";
    return portalPostActivityUpdate(activityId, formData);
  }

  async function upload(formData: FormData) {
    "use server";
    await portalUploadActivityDocuments(activityId, formData);
  }

  return (
    <ActivityDetailView
      activity={activity}
      proofs={proofs}
      timeline={timeline}
      teamUsers={teamUsers}
      user={{
        name: profile.fullName,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
      }}
      baseHref={`/portal/projects/${id}/activities/${activityId}`}
      backHref={`/portal/projects/${id}`}
      backLabel="Back to project"
      postUpdate={postUpdate}
      upload={upload}
      showNotes={false}
      showTimeline={false}
      showResponsible={false}
    />
  );
}
