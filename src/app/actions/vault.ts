'use server';

import { revalidatePath } from 'next/cache';
import { execute, queryOne, uuid, toMysqlDateTime } from '@/lib/db';
import { getSessionUser, getCoupleContext, getEntitlements } from '@/lib/auth';
import { limitReached, upgradeMessage } from '@/lib/plans';
import { deleteFile, fileUrl } from '@/lib/storage';
import type { ActionResult } from '@/app/actions/couple';

async function space() {
  const user = await getSessionUser();
  const context = await getCoupleContext();
  if (!user || !context) return null;
  return { user, context };
}

/**
 * Enforces the plan's storage quota across both the media library and the
 * document vault, so an upload cannot push a space past its allowance.
 */
async function storageQuotaError(coupleId: string, incomingBytes: number): Promise<string | null> {
  const entitlements = await getEntitlements();
  const quotaMb = entitlements.limits.storage_mb;
  if (quotaMb === -1) return null;

  const [media, documents] = await Promise.all([
    queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(size_bytes), 0) AS total FROM media_assets WHERE couple_id = ?`,
      [coupleId]
    ),
    queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(file_size), 0) AS total FROM travel_documents WHERE couple_id = ?`,
      [coupleId]
    ),
  ]);

  const usedBytes = Number(media?.total ?? 0) + Number(documents?.total ?? 0);
  const quotaBytes = quotaMb * 1024 * 1024;
  if (usedBytes + incomingBytes <= quotaBytes) return null;

  const usedMb = Math.round(usedBytes / (1024 * 1024));
  return `Storage full — ${usedMb} MB of ${quotaMb} MB used. Upgrade your plan or delete some files.`;
}

/**
 * Records an uploaded booking document. The file itself is written to disk by
 * POST /api/upload under `documents/<couple_id>/<user_id>/…`; this action only
 * stores the metadata row that points at it.
 */
export async function saveTravelDocumentAction(formData: FormData): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Create your relationship space first.' };

  const documentId = String(formData.get('id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return { ok: false, error: 'Give the document a title.' };

  if (!documentId) {
    const entitlements = await getEntitlements();
    const row = await queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM travel_documents WHERE couple_id = ?`,
      [ctx.context.couple.id]
    );
    if (limitReached(entitlements.limits, 'documents', Number(row?.total ?? 0))) {
      return { ok: false, error: upgradeMessage('documents') };
    }
  }

  const incomingBytes = Number(formData.get('file_size') ?? 0);
  if (incomingBytes > 0 && !documentId) {
    const quotaError = await storageQuotaError(ctx.context.couple.id, incomingBytes);
    if (quotaError) return { ok: false, error: quotaError };
  }

  const values = [
    String(formData.get('trip_id') ?? '') || null,
    String(formData.get('doc_type') ?? 'other'),
    title,
    String(formData.get('provider') ?? '').trim() || null,
    String(formData.get('confirmation_code') ?? '').trim() || null,
    String(formData.get('booking_reference') ?? '').trim() || null,
    String(formData.get('passenger_names') ?? '').trim() || null,
    String(formData.get('origin') ?? '').trim() || null,
    String(formData.get('destination') ?? '').trim() || null,
    toMysqlDateTime(String(formData.get('depart_at') ?? '') || null),
    toMysqlDateTime(String(formData.get('arrive_at') ?? '') || null),
    String(formData.get('check_in') ?? '') || null,
    String(formData.get('check_out') ?? '') || null,
    String(formData.get('seat') ?? '').trim() || null,
    String(formData.get('terminal') ?? '').trim() || null,
    String(formData.get('gate') ?? '').trim() || null,
    formData.get('amount') ? Math.round(Number(formData.get('amount')) * 100) : null,
    String(formData.get('currency') ?? ctx.context.couple.currency),
    String(formData.get('expires_at') ?? '') || null,
    String(formData.get('file_path') ?? '') || null,
    String(formData.get('file_name') ?? '') || null,
    String(formData.get('file_mime') ?? '') || null,
    formData.get('file_size') ? Number(formData.get('file_size')) : null,
    String(formData.get('notes') ?? '').trim() || null,
    formData.get('is_shared') !== 'false',
  ];

  const result = documentId
    ? await execute(
        `UPDATE travel_documents
            SET trip_id = ?, doc_type = ?, title = ?, provider = ?, confirmation_code = ?,
                booking_reference = ?, passenger_names = ?, origin = ?, destination = ?,
                depart_at = ?, arrive_at = ?, check_in = ?, check_out = ?, seat = ?, terminal = ?,
                gate = ?, amount_cents = ?, currency = ?, expires_at = ?, file_path = ?,
                file_name = ?, file_mime = ?, file_size = ?, notes = ?, is_shared = ?
          WHERE id = ? AND couple_id = ?`,
        [...values, documentId, ctx.context.couple.id]
      )
    : await execute(
        `INSERT INTO travel_documents
           (id, couple_id, user_id, trip_id, doc_type, title, provider, confirmation_code,
            booking_reference, passenger_names, origin, destination, depart_at, arrive_at,
            check_in, check_out, seat, terminal, gate, amount_cents, currency, expires_at,
            file_path, file_name, file_mime, file_size, notes, is_shared)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuid(), ctx.context.couple.id, ctx.user.id, ...values]
      );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save the document.' };

  revalidatePath('/dashboard/documents');
  return { ok: true, message: 'Saved to the vault.' };
}

export async function deleteTravelDocumentAction(documentId: string): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };

  const doc = await queryOne<{ file_path: string | null }>(
    `SELECT file_path FROM travel_documents WHERE id = ? AND couple_id = ? LIMIT 1`,
    [documentId, ctx.context.couple.id]
  );
  if (!doc) return { ok: false, error: 'Document not found.' };

  const result = await execute(`DELETE FROM travel_documents WHERE id = ? AND couple_id = ?`, [
    documentId,
    ctx.context.couple.id,
  ]);
  if (!result.ok) return { ok: false, error: result.error ?? 'Could not delete the document.' };

  if (doc.file_path) await deleteFile('documents', doc.file_path);

  revalidatePath('/dashboard/documents');
  return { ok: true, message: 'Deleted.' };
}

/** Returns the authenticated URL a private file is served from. */
export async function getDocumentUrlAction(path: string): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };
  if (!path.startsWith(`${ctx.context.couple.id}/`)) {
    return { ok: false, error: 'That file does not belong to your space.' };
  }
  return { ok: true, data: fileUrl('documents', path) };
}

/* ------------------------------------------------------------- Photo gallery */

export async function saveMediaAssetAction(formData: FormData): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Create your relationship space first.' };

  const path = String(formData.get('path') ?? '');
  if (!path) return { ok: false, error: 'Upload a file first.' };

  const incomingBytes = Number(formData.get('size_bytes') ?? 0);
  const quotaError = await storageQuotaError(ctx.context.couple.id, incomingBytes);
  if (quotaError) return { ok: false, error: quotaError };

  const result = await execute(
    `INSERT INTO media_assets
       (id, couple_id, user_id, bucket, path, file_name, mime_type, size_bytes, kind, album, caption, is_private)
     VALUES (?, ?, ?, 'couple-media', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuid(),
      ctx.context.couple.id,
      ctx.user.id,
      path,
      String(formData.get('file_name') ?? 'photo'),
      String(formData.get('mime_type') ?? '') || null,
      incomingBytes,
      String(formData.get('kind') ?? 'photo'),
      String(formData.get('album') ?? '').trim() || null,
      String(formData.get('caption') ?? '').trim() || null,
      formData.get('is_private') === 'true',
    ]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save the photo.' };
  revalidatePath('/dashboard/gallery');
  return { ok: true, message: 'Uploaded.' };
}

export async function deleteMediaAssetAction(assetId: string): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };

  const asset = await queryOne<{ path: string; bucket: string }>(
    `SELECT path, bucket FROM media_assets WHERE id = ? AND couple_id = ? LIMIT 1`,
    [assetId, ctx.context.couple.id]
  );
  if (!asset) return { ok: false, error: 'Photo not found.' };

  const result = await execute(`DELETE FROM media_assets WHERE id = ? AND couple_id = ?`, [
    assetId,
    ctx.context.couple.id,
  ]);
  if (!result.ok) return { ok: false, error: result.error ?? 'Could not delete the photo.' };

  await deleteFile(asset.bucket ?? 'couple-media', asset.path);

  revalidatePath('/dashboard/gallery');
  return { ok: true, message: 'Deleted.' };
}

/** Maps stored object paths to the authenticated URLs that serve them. */
export async function getMediaUrlsAction(paths: string[]): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };

  const map: Record<string, string> = {};
  for (const path of paths) {
    if (path.startsWith(`${ctx.context.couple.id}/`)) {
      map[path] = fileUrl('couple-media', path);
    }
  }
  return { ok: true, data: map };
}

/** Toggles the favourite flag on a photo. */
export async function toggleFavoriteMediaAction(
  assetId: string,
  favorite: boolean
): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };

  const result = await execute(
    `UPDATE media_assets SET is_favorite = ? WHERE id = ? AND couple_id = ?`,
    [favorite, assetId, ctx.context.couple.id]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not update the photo.' };
  revalidatePath('/dashboard/gallery');
  return { ok: true };
}
