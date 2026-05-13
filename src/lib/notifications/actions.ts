"use server";

import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage } from "@/lib/db-errors";

export async function markNotificationsRead() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const now = new Date().toISOString();
  // user_notification_reads not yet in generated types — cast to bypass.
  const client = sb as unknown as {
    from: (table: string) => {
      upsert: (
        row: { user_id: string; last_read_at: string; updated_at: string },
        options?: { onConflict?: string },
      ) => Promise<{ error: { message: string } | null }>;
    };
  };

  const { error } = await client
    .from("user_notification_reads")
    .upsert(
      { user_id: user.id, last_read_at: now, updated_at: now },
      { onConflict: "user_id" },
    );
  if (error) return { ok: false, error: dbErrorMessage(error) };

  // No layout/tag revalidation needed: the bell is now a self-loading
  // client component that refetches /api/notifications/feed itself
  // immediately after this action resolves.
  return { ok: true };
}
