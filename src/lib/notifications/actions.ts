"use server";

import { revalidatePath, revalidateTag } from "next/cache";
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

  // Bust the per-user cached notification feed so the bell reflects the new
  // last_read_at on the very next navigation.
  // Next.js 16 requires a profile arg on revalidateTag; 'max' evicts the
  // tagged cache entry as aggressively as possible (matches the prior
  // single-arg behaviour from Next 15).
  revalidateTag(`notifications-${user.id}`, "max");
  revalidatePath("/portal", "layout");
  revalidatePath("/workspace", "layout");
  return { ok: true };
}
