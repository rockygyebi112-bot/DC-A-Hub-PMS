alter table public.unesco_dashboard_guest_links
  alter column email drop not null,
  add constraint unesco_dashboard_guest_links_email_verification
  check (
    email is not null or (
      challenge_hash is null and challenge_expires_at is null and session_hash is null
    )
  );
