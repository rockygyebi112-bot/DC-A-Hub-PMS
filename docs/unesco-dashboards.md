# UNESCO portal dashboards

Set `UNESCO_PROJECT_ID` to the existing UNESCO project's UUID from the PMS project URL. Keep the project UUID and the two dashboard slugs stable when updating the snapshots.

In a private deployment build workspace, place the supplied HTML files at:

- `private/unesco-dashboards/UNESCO_Youth_in_Work.html`
- `private/unesco-dashboards/UNESCO_Participant_Trajectory.html`

Use those same filenames when replacing the HTML. The authenticated content handler reads the corresponding file at runtime. For packaged builds, include the files in the private build workspace before building so Next.js can trace them into the server function. The files are Git-ignored because the snapshots contain restricted project data. Keep them outside the public directory and outside browser bundles.

The portal path is **Your projects → UNESCO → Dashboards**. The shareable page paths are `/portal/projects/<UNESCO_PROJECT_ID>/dashboards/youth-in-work` and `/portal/projects/<UNESCO_PROJECT_ID>/dashboards/participant-trajectory`.

Youth in Work requires an active account, an explicit project membership, and the PMS evaluation reporting policy's `can_access_project` check. Participant Trajectory denies access until a participant-level permission is confirmed. Apply the same permission in the shared access function for the list, page and HTML response.
