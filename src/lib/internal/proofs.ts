'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { currentUserId } from '@/lib/auth/session';
import { requireRole } from '@/lib/auth/require-role-server';
import { dbErrorMessage } from '@/lib/db-errors';
import {
  validateUpload,
  sanitizeFileName,
  checkUploadContent,
} from '@/lib/uploads';
import type { ActionResult } from '@/lib/action-result';

const STAFF = ['admin', 'staff'] as const;

function revalidateTask(taskId: string) {
  revalidatePath(`/workspace/internal/${taskId}`);
}

function note(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

// ---------- documents ----------

/**
 * Upload one or more documents to an internal task. Mirrors the project-side
 * `uploadProofs`: validates each file (size, MIME allowlist, byte-level
 * content sniff) before any upload so a batch never lands half-written, then
 * stores under `internal/tasks/{taskId}/...` in the shared `proofs` bucket.
 */
export async function uploadInternalTaskProofs(
  taskId: string,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireRole([...STAFF]);
  if (!auth.ok) return auth;

  const files = formData
    .getAll('proofs')
    .filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length === 0) return { ok: false, error: 'Choose at least one file' };

  // Validate every file up-front so we never upload partial batches.
  for (const file of files) {
    const validation = validateUpload('proof', {
      size: file.size,
      mimeType: file.type,
      fileName: file.name,
    });
    if (!validation.ok) return { ok: false, error: validation.error };
    // Byte-level guard against HTML/SVG/script/executable content that slips
    // past the declared-MIME allowlist (served from the storage origin).
    const danger = await checkUploadContent(file);
    if (danger) return { ok: false, error: 'This file type is not allowed' };
  }

  const sb = await createClient();
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: 'Not authenticated' };

  const caption = note(formData, 'caption') || null;
  for (const file of files) {
    const safeName = sanitizeFileName(file.name);
    const path = `internal/tasks/${taskId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await sb.storage
      .from('proofs')
      .upload(path, file, {
        contentType: file.type || 'application/octet-stream',
      });
    if (uploadError) return { ok: false, error: dbErrorMessage(uploadError) };

    const { error: insertError } = await sb.from('internal_task_proofs').insert({
      task_id: taskId,
      file_path: path,
      file_name: safeName,
      mime_type: file.type || null,
      size_bytes: file.size,
      caption,
      uploaded_by: userId,
    });
    if (insertError) {
      // Best-effort cleanup so we don't leave an orphaned object behind.
      await sb.storage.from('proofs').remove([path]);
      return { ok: false, error: dbErrorMessage(insertError) };
    }
  }

  revalidateTask(taskId);
  return { ok: true };
}

/** Remove a document (storage object + row). Author or admin only (RLS). */
export async function deleteInternalTaskProof(
  taskId: string,
  proofId: string,
): Promise<ActionResult> {
  const auth = await requireRole([...STAFF]);
  if (!auth.ok) return auth;
  const sb = await createClient();

  const { data: proof } = await sb
    .from('internal_task_proofs')
    .select('file_path')
    .eq('id', proofId)
    .maybeSingle();

  const { error } = await sb.from('internal_task_proofs').delete().eq('id', proofId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (proof?.file_path) {
    await sb.storage.from('proofs').remove([proof.file_path]);
  }

  revalidateTask(taskId);
  return { ok: true };
}

/**
 * Mint a short-lived (5 min) signed URL for an internal document. Staff-only,
 * so no client-style password/audit gate — RLS already restricts the read.
 */
export async function requestInternalProofAccess(
  proofId: string,
): Promise<ActionResult<{ url: string; fileName: string }>> {
  const auth = await requireRole([...STAFF]);
  if (!auth.ok) return auth;
  const sb = await createClient();

  const { data: proof, error } = await sb
    .from('internal_task_proofs')
    .select('file_path, file_name')
    .eq('id', proofId)
    .maybeSingle();
  if (error || !proof) return { ok: false, error: 'Document not found' };

  const { data: signed } = await sb.storage
    .from('proofs')
    .createSignedUrl(proof.file_path, 5 * 60);
  if (!signed?.signedUrl) {
    return { ok: false, error: 'Could not resolve document URL' };
  }
  return {
    ok: true,
    data: { url: signed.signedUrl, fileName: proof.file_name },
  };
}

// ---------- task-level comments ----------

export async function postInternalTaskComment(
  taskId: string,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireRole([...STAFF]);
  if (!auth.ok) return auth;
  const body = note(formData, 'body');
  if (!body) return { ok: false, error: 'Write something first.' };

  const sb = await createClient();
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: 'Not authenticated' };

  const { error } = await sb.from('internal_task_comments').insert({
    task_id: taskId,
    author_user_id: userId,
    body,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateTask(taskId);
  return { ok: true };
}

export async function deleteInternalTaskComment(
  taskId: string,
  commentId: string,
): Promise<ActionResult> {
  const auth = await requireRole([...STAFF]);
  if (!auth.ok) return auth;
  const sb = await createClient();
  const { error } = await sb
    .from('internal_task_comments')
    .delete()
    .eq('id', commentId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateTask(taskId);
  return { ok: true };
}

// ---------- per-document comments ----------

export async function addInternalProofComment(
  taskId: string,
  proofId: string,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireRole([...STAFF]);
  if (!auth.ok) return auth;
  const body = note(formData, 'body');
  if (!body) return { ok: false, error: 'Write something first.' };

  const sb = await createClient();
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: 'Not authenticated' };

  const { error } = await sb.from('internal_task_proof_comments').insert({
    proof_id: proofId,
    author_user_id: userId,
    body,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateTask(taskId);
  return { ok: true };
}

export async function deleteInternalProofComment(
  taskId: string,
  commentId: string,
): Promise<ActionResult> {
  const auth = await requireRole([...STAFF]);
  if (!auth.ok) return auth;
  const sb = await createClient();
  const { error } = await sb
    .from('internal_task_proof_comments')
    .delete()
    .eq('id', commentId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateTask(taskId);
  return { ok: true };
}
