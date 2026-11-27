"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { unescoDashboards, type UnescoDashboardSlug } from "@/lib/unesco-dashboards/routes";
import { inviteDashboardGuest, revokeDashboardGuest } from "@/lib/unesco-dashboards/guest-link-actions";

type Invitation = { id: string; email: string; expires_at: string };

export function DashboardGuestLink({ projectId, slug, invitations }: { projectId: string; slug: UnescoDashboardSlug; invitations: Invitation[] }) {
  const [entries, setEntries] = useState(invitations);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function invite() {
    startTransition(async () => {
      try {
        const result = await inviteDashboardGuest(projectId, slug, email);
        if (!result.invitation) return setMessage(result.error ?? "The invitation could not be created.");
        const invitation = result.invitation;
        setEntries((current) => [...current.filter((item) => item.id !== invitation.id), invitation]);
        setEmail("");
        setMessage(result.sent ? "Invitation sent." : "Invitation saved. Email delivery failed. Submit the address again to retry.");
      } catch {
        setMessage("The invitation could not be created.");
      }
    });
  }

  function revoke(id: string) {
    startTransition(async () => {
      try {
        const result = await revokeDashboardGuest(projectId, slug, id);
        if (result.error) return setMessage(result.error);
        setEntries((current) => current.filter((item) => item.id !== id));
        setMessage("Invitation revoked.");
      } catch {
        setMessage("The invitation could not be revoked.");
      }
    });
  }

  return (
    <section className="space-y-3 rounded border p-3">
      <h2 className="font-semibold">Manage {unescoDashboards[slug].title} invitations</h2>
      <p className="text-sm">Invited guests verify their email and receive access for seven days. Sending a new invitation to the same address resets its access.</p>
      <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => { event.preventDefault(); invite(); }}>
        <Input className="w-full sm:w-64" type="email" aria-label="Guest email address" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <Button type="submit" size="sm" disabled={pending}>Send invitation</Button>
      </form>
      <ul className="space-y-2">
        {entries.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="break-all">{entry.email}</span>
            <span className="text-muted-foreground">Expires {entry.expires_at.slice(0, 10)} UTC</span>
            <Button type="button" size="sm" variant="outline" aria-label={`Revoke invitation for ${entry.email}`} disabled={pending} onClick={() => revoke(entry.id)}>Revoke</Button>
          </li>
        ))}
      </ul>
      <p role="status" className="text-sm">{message}</p>
    </section>
  );
}
