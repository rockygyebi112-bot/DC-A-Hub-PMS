-- 0039_pgsodium_kobo_token.sql (fallback)
--
-- pgsodium not usable on this Supabase tier. Although the pgsodium extension
-- is installed and pgsodium.crypto_aead_det_encrypt/_decrypt exist, every
-- key_uuid-based overload internally reads pgsodium.key, and SELECT on that
-- table is granted only to pgsodium_keymaker / supabase_admin. Neither
-- postgres nor service_role can read it, and a migration cannot grant the
-- pgsodium_keyiduser/pgsodium_keymaker roles to postgres ("permission denied
-- to grant role"). A SECURITY DEFINER wrapper owned by postgres therefore
-- still fails with "permission denied for table key". The only usable
-- overload takes a raw key bytea but is granted solely to supabase_admin.
--
-- App-level encryption is used instead: the ingestion module reads
-- KOBO_TOKEN_ENC_KEY (32 bytes, base64) from env and AES-256-GCM
-- encrypts/decrypts via node:crypto. Column type stays bytea so the
-- production migration path matches the dev path once pgsodium is enabled.
--
-- Task 8's kobo.ts branches on whether public.kobo_token_get exists; with
-- this fallback it does not, so kobo.ts uses the app-level path.
--
-- This statement also drops any kobo_token_*/_diag_* helper functions that an
-- earlier pgsodium attempt of this migration may have left on the database,
-- so re-running this migration leaves a clean state.

drop function if exists public.kobo_token_set(uuid, text);
drop function if exists public.kobo_token_get(uuid);
drop function if exists public._diag_0039();
drop function if exists public._diag2_0039();
drop function if exists public._diag3_0039();

select 1;
