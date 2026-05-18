"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/guards";
import { sanitizeFileName, validateUpload } from "@/lib/uploads";
import { getAppUrl } from "@/lib/app-url";
import { sendEmail } from "@/lib/email/send";
import {
  renderEmailChangeCurrent,
  renderEmailChangeNew,
} from "@/lib/email/templates/email-change";
import {
  updateEmailSchema,
  updateNameSchema,
  updatePasswordSchema,
} from "@/lib/account/schemas";
import {
  checkRateLimit,
  logPasswordVerifyAttempt,
  rateLimitMessage,
} from "@/lib/rate-limit";

import type { ActionResult } from "@/lib/action-result";

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

type SniffedMime = "image/jpeg" | "image/png" | "image/webp" | "image/gif" | null;

/**
 * Inspect the first bytes of an upload and return the actual image type, or
 * null if the bytes don't match any of our supported image signatures.
 * `file.type` (the Content-Type the client sends) is fully attacker-controlled —
 * a malicious client can claim `image/png` while shipping a PE / shell-script
 * body, which lands in our public bucket at a predictable path. Magic-byte
 * sniffing is the defense.
 *
 * Signatures:
 *   - JPEG  : FF D8 FF
 *   - PNG   : 89 50 4E 47 0D 0A 1A 0A
 *   - GIF   : 47 49 46 38 (37|39) 61   ("GIF87a" / "GIF89a")
 *   - WebP  : 52 49 46 46 .... 57 45 42 50  ("RIFF????WEBP")
 */
function sniffImageMime(bytes: Uint8Array): SniffedMime {
  if (bytes.length < 12) return null;
  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  // GIF87a / GIF89a
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }
  // WebP: "RIFF" + 4 size bytes + "WEBP"
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function revalidateAll() {
  // Only the /account page needs server revalidation here. The forms in
  // `src/components/account/*` call `router.refresh()` on success, which
  // re-renders the topbar (in the surface the user is currently viewing)
  // without nuking the whole /admin, /workspace, and /portal trees.
  revalidatePath("/account");
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
  const { data: { user } } = await sb.auth.getUser();
  const currentEmail = user?.email;
  if (!currentEmail) return { ok: false, error: GENERIC_ERROR };

  // Same address - nothing to do.
  if (currentEmail.toLowerCase() === parsed.data.email.toLowerCase()) {
    return { ok: true };
  }

  // C-4: rate limit (3 / hour) — separate bucket from pwd-verify so an
  // account-takeover bot can't burn the email-change budget by attacking
  // proof access.
  const rlEmail = await checkRateLimit(
    "email-change",
    auth.userId,
    3,
    3600,
  );
  if (!rlEmail.ok) {
    return {
      ok: false,
      error: rateLimitMessage(rlEmail.retryAfterSeconds, "Too many email change requests"),
    };
  }

  // H-12: re-auth with the current password before mailing change links.
  // Mirrors updateMyPassword — a throw-away client so the real session is
  // untouched even on a successful verify.
  const verifier = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: currentEmail,
    password: parsed.data.current_password,
  });
  await logPasswordVerifyAttempt({
    userId: auth.userId,
    email: currentEmail,
    success: !verifyError,
    context: "email_change",
  });
  if (verifyError) {
    return { ok: false, error: "Current password is incorrect" };
  }

  const admin = createAdminClient();
  const appUrl = getAppUrl();
  const redirectTo = `${appUrl}/auth/callback?next=/account`;

  // Supabase's "Secure email change" flow requires confirmation links sent
  // to BOTH the current and new addresses. We generate each link via the
  // admin API (no Supabase-side email is sent) and deliver them ourselves
  // through Resend so both messages use our verified domain and templates.
  const [currentLink, newLink] = await Promise.all([
    admin.auth.admin.generateLink({
      type: "email_change_current",
      email: currentEmail,
      newEmail: parsed.data.email,
      options: { redirectTo },
    }),
    admin.auth.admin.generateLink({
      type: "email_change_new",
      email: currentEmail,
      newEmail: parsed.data.email,
      options: { redirectTo },
    }),
  ]);

  if (currentLink.error || newLink.error) {
    const msg = (currentLink.error ?? newLink.error)?.message ?? "";
    if (/already.*registered|already in use|exists/i.test(msg)) {
      return { ok: false, error: "That email is already in use." };
    }
    return { ok: false, error: GENERIC_ERROR };
  }

  const currentHashed = currentLink.data.properties?.hashed_token;
  const newHashed = newLink.data.properties?.hashed_token;
  if (!currentHashed || !newHashed) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const buildUrl = (token: string) => {
    const params = new URLSearchParams({
      token_hash: token,
      type: "email_change",
      next: "/account",
    });
    return `${appUrl}/auth/confirm?${params.toString()}`;
  };

  const stamp = Date.now();
  const tplCurrent = renderEmailChangeCurrent({
    confirmUrl: buildUrl(currentHashed),
    newEmail: parsed.data.email,
  });
  const tplNew = renderEmailChangeNew({ confirmUrl: buildUrl(newHashed) });

  const [resCurrent, resNew] = await Promise.all([
    sendEmail({
      to: currentEmail,
      subject: tplCurrent.subject,
      html: tplCurrent.html,
      text: tplCurrent.text,
      category: "email_change",
      idempotencyKey: `email-change-current/${auth.userId}/${stamp}`,
      extraTags: [{ name: "audience", value: "current" }],
    }),
    sendEmail({
      to: parsed.data.email,
      subject: tplNew.subject,
      html: tplNew.html,
      text: tplNew.text,
      category: "email_change",
      idempotencyKey: `email-change-new/${auth.userId}/${stamp}`,
      extraTags: [{ name: "audience", value: "new" }],
    }),
  ]);

  if (!resCurrent.ok || !resNew.ok) {
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

  // C-4: rate limit (5 / 10 min).
  const rlPwd = await checkRateLimit(
    "pwd-verify",
    `change:${auth.userId}`,
    5,
    600,
  );
  if (!rlPwd.ok) {
    return {
      ok: false,
      error: rateLimitMessage(rlPwd.retryAfterSeconds, "Too many password attempts"),
    };
  }

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
  await logPasswordVerifyAttempt({
    userId: auth.userId,
    email: user.email,
    success: !signInError,
    context: "password_change",
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

  const safeName = sanitizeFileName(file.name);

  const sb = await createClient();
  const arrayBuffer = await file.arrayBuffer();

  // Magic-byte sniff. `file.type` is client-supplied and not trustworthy —
  // a hostile uploader can claim `image/png` and ship an executable body,
  // which would otherwise land in the public bucket at a predictable
  // path. Reject anything whose actual bytes don't match one of our
  // supported image formats, and use the SNIFFED mime for storage so
  // downstream consumers can't be fooled by a mismatched header either.
  const head = new Uint8Array(arrayBuffer.slice(0, 16));
  const sniffed = sniffImageMime(head);
  if (!sniffed) {
    return { ok: false, error: "Use a JPG, PNG, WebP or GIF image" };
  }
  if (sniffed !== file.type.toLowerCase()) {
    // Soft warning: the client lied about content-type. We still use the
    // sniffed value below; this log helps spot abusive clients.
    console.warn("[avatar] content-type mismatch", {
      claimed: file.type,
      sniffed,
    });
  }

  const ext = avatarExt(sniffed);
  const objectPath = `${auth.userId}/avatar.${ext}`;
  const { error: uploadError } = await sb.storage
    .from("avatars")
    .upload(objectPath, arrayBuffer, {
      contentType: sniffed,
      upsert: true,
      // Short cache: predictable path (userId/avatar.ext) means a privacy
      // bug or a deactivated user's old image can otherwise linger in CDN
      // caches for an hour (M-13). 5 minutes still saves repeat loads.
      cacheControl: "300",
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

  // Profile self-update is allowed by RLS for avatar_url (M-5: no longer
  // routes through service role).
  const { error } = await sb
    .from("profiles")
    .update({ avatar_url: null })
    .eq("user_id", auth.userId);
  if (error) return { ok: false, error: GENERIC_ERROR };

  revalidateAll();
  return { ok: true };
}
