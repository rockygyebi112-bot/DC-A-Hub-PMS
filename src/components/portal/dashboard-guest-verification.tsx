"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { requestDashboardGuestVerification, verifyDashboardGuest } from "@/lib/unesco-dashboards/guest-link-actions";

export function DashboardGuestVerification({ id, token }: { id: string; token?: string }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-3">
      <p>{token ? "Confirm access to open the dashboard in this browser." : "Request a fresh access link at the invited email address."}</p>
      {token && <Button type="button" disabled={pending} onClick={() => startTransition(async () => {
        if (!(await verifyDashboardGuest(id, token))) setMessage("This verification link has expired or already been used.");
      })}>Open dashboard</Button>}
      <Button type="button" variant="outline" disabled={pending} onClick={() => startTransition(async () => {
        await requestDashboardGuestVerification(id);
        setMessage("Check the invited inbox for a verification link. You can request another after one minute.");
      })}>Email a fresh link</Button>
      <p role="status">{message}</p>
    </div>
  );
}
