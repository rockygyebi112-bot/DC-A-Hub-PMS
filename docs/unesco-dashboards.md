# UNESCO portal dashboards

Set `UNESCO_PROJECT_ID` to the existing UNESCO project's UUID from the PMS project URL. Keep the project UUID and the two dashboard slugs stable when updating the snapshots.

In a private deployment build workspace, place the supplied HTML files at:

- `private/unesco-dashboards/UNESCO_Youth_in_Work.html`
- `private/unesco-dashboards/UNESCO_Participant_Trajectory.html`

Use those same filenames when replacing the HTML. The authenticated content handler reads the corresponding file at runtime. For packaged builds, include the files in the private build workspace before building so Next.js can trace them into the server function. The files are Git-ignored because the snapshots contain restricted project data. Keep them outside the public directory and outside browser bundles.

The portal path is **Your projects → UNESCO → Dashboards**. The shareable page paths are `/portal/projects/unesco/dashboards/youth-in-work` and `/portal/projects/unesco/dashboards/participant-trajectory`. Existing UUID-based links are also supported. The server resolves the `unesco` alias using the configured project ID.

Both dashboards require an active account and explicit UNESCO project membership for their portal routes. Project managers can grant dashboard-only access by email to either dashboard.

## Email invitations

Apply migration `0051_unesco_dashboard_guest_links.sql` before deploying. UNESCO project managers can send and revoke dashboard-specific invitations by email. Recipients can verify the invited mailbox and open the invited dashboard without a PMS account. Invitations expire after seven days and verification links expire after 15 minutes. Revocation blocks new page and HTML requests. Recipients who have already loaded or saved the report can retain that copy. Participant Trajectory includes participant names and interview details. Its invitations grant access only to that dashboard.
