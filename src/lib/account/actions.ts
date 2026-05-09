"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/guards";
import { sanitizeFileName, validateUpload } from "@/lib/uploads";
import { getAppUrl } from "@/lib/app-url";
import {
  updateEmailSchema,
  updateNameSchema,
  updatePasswordSchema,
} from "@/lib/account/schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const GENERIC_ERROR = "Something went wrong. Please try again.";

const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const AVATAR_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function avatarExt(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "jpg";
  }
}

function revalidateAll() {
  // The avatar / name shows up in the topbar across every surface.
  revalidatePath("/account");
  revalidatePath("/admin");
  revalidatePath("/workspace");
  revalidatePath("/portal");
}

export async function updateMyName(raw: unknown): Promise<ActionResult> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  const parsed = updateNameSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name" };
  }
  const sb = await createClient();
  const { error } = await sb
    .from("profiles")
    .update({ full_name: parsed.data.full_name })
    .eq("user_id", auth.userId);
  if (error) return { ok: false, error: GENERIC_ERROR };
  revalidateAll();
  return { ok: true };
}

export async function updateMyEmail(raw: unknown): Promise<ActionResult> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  const parsed = updateEmailSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid email" };
  }

  const sb = await createClient();
  const { error } = await sb.auth.updateUser(
    { email: parsed.data.email },
    {
      // Supabase sends a confirmation link to BOTH addresses by default.
      // Route both confirmations through our /auth/confirm token_hash flow so
      // the change works cross-device.
      emailRedirectTo: `${getAppUrl()}/auth/confirm?type=email_change&next=/account`,
    },
  );
  if (error) {
    // Friendly mapping for the most common case.
    if (/already.*registered|already in use/i.test(error.message)) {
      return { ok: false, error: "That email is already in use." };
    }
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidateAll();
  return { ok: true };
}

export async function updateMyPassword(raw: unknown): Promise<ActionResult> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  const parsed = updatePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid password",
    };
  }

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user?.email) return { ok: false, error: "Profile not found" };

  // Verify the current password without touching the active session: spin up
  // a throw-away client with no cookie/session persistence.
  const verifier = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error: signInError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.current_password,
  });
  if (signInError) {
    return { ok: false, error: "Current password is incorrect" };
  }

  const { error } = await sb.auth.updateUser({
    password: parsed.data.new_password,
  });
  if (error) return { ok: false, error: GENERIC_ERROR };

  return { ok: true };
}

export async function uploadMyAvatar(formData: FormData): Promise<ActionResult> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file selected" };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { ok: false, error: "Avatar must be 5 MB or smaller" };
  }
  if (!AVATAR_MIMES.has(file.type.toLowerCase())) {
    return { ok: false, error: "Use a JPG, PNG, WebP or GIF image" };
  }
  // Reuse the centralized validator for filename safety + control-char defence.
  const validation = validateUpload("proof", {
    size: file.size,
    mimeType: file.type,
    fileName: file.name,
  });
  if (!validation.ok && !/Unsupported/.test(validation.error)) {
    // Only treat shared-validator errors that are NOT mime-related as fatal,
    // since we already accept a narrower mime allowlist above.
    return { ok: false, error: validation.error };
  }

  const ext = avatarExt(file.type);
  const objectPath = `${auth.userId}/avatar.${ext}`;
  const safeName = sanitizeFileName(file.name);

  const sb = await createClient();
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await sb.storage
    .from("avatars")
    .upload(objectPath, arrayBuffer, {
      contentType: file.type,
      upsert: true,
      cacheControl: "3600",
      metadata: { original_name: safeName },
    });
  if (uploadError) return { ok: false, error: GENERIC_ERROR };

  // Public URL with cache-busting param so the new image shows immediately.
  const { data: pub } = sb.storage.from("avatars").getPublicUrl(objectPath);
  const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;

  // Clean up any stale objects with a different extension.
  const otherExts = ["jpg", "png", "webp", "gif"].filter((e) => e !== ext);
  await sb.storage
    .from("avatars")
    .remove(otherExts.map((e) => `${auth.userId}/avatar.${e}`));

  const { error: profileError } = await sb
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("user_id", auth.userId);
  if (profileError) return { ok: false, error: GENERIC_ERROR };

  revalidateAll();
  return { ok: true };
}

export async function removeMyAvatar(): Promise<ActionResult> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;

  const sb = await createClient();

  // Best-effort delete of any avatar variant in the user's folder.
  const exts = ["jpg", "png", "webp", "gif"];
  await sb.storage
    .from("avatars")
    .remove(exts.map((e) => `${auth.userId}/avatar.${e}`));

  // Profile self-update can't change role/email/is_active by RLS; avatar_url
  // is allowed. Use service role to also clear when self-update is locked
  // by other constraints.
  const adminSb = createAdminClient();
  const { error } = await adminSb
    .from("profiles")
    .update({ avatar_url: null })
    .eq("user_id", auth.userId);
  if (error) return { ok: false, error: GENERIC_ERROR };

  revalidateAll();
  return { ok: true };
}
