import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export default async function PortalHome() {
  const profile = await getCurrentProfile();
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">DC&A Hub PMS — Client Portal</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Signed in as {profile?.fullName ?? "unknown"} ({profile?.email}).
      </p>
      <p className="mt-4">Project view coming in Plan 4.</p>
    </main>
  );
}
