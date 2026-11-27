"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { requestDashboardGuestVerification, verifyDashboardGuest } from "@/lib/unesco-dashboards/guest-link-actions";

export function DashboardGuestVerification({ id, token }: { id: string; token?: string }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-3">
      <p>Verify the email address that received this invitation to open the dashboard.</p>
      {token && <Button type="button" disabled={pending} onClick={() => startTransition(async () => {
        if (!(await verifyDashboardGuest(id, token))) setMessage("This verification link has expired or already been used.");
      })}>Verify and open dashboard</Button>}
      <Button type="button" variant="outline" disabled={pending} onClick={() => startTransition(async () => {
        await requestDashboardGuestVerification(id);
        setMessage("Check the invited inbox for a verification link. You can request another after one minute.");
      })}>Email me a verification link</Button>
      <p role="status">{message}</p>
    </div>
  );
}
