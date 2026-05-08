"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  if (error) return { ok: false, error: error.message };

  revalidatePath("/portal", "layout");
  revalidatePath("/workspace", "layout");
  return { ok: true };
}
