'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser, getCoupleContext, getEntitlements } from '@/lib/auth';
import { limitReached, upgradeMessage } from '@/lib/plans';
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

  const supabase = createClient();
  const [{ data: media }, { data: documents }] = await Promise.all([
    supabase.from('media_assets').select('size_bytes').eq('couple_id', coupleId),
    supabase.from('travel_documents').select('file_size').eq('couple_id', coupleId),
  ]);

  const usedBytes =
    ((media ?? []) as any[]).reduce((sum, row) => sum + Number(row.size_bytes ?? 0), 0) +
    ((documents ?? []) as any[]).reduce((sum, row) => sum + Number(row.file_size ?? 0), 0);

  const quotaBytes = quotaMb * 1024 * 1024;
  if (usedBytes + incomingBytes <= quotaBytes) return null;

  const usedMb = Math.round(usedBytes / (1024 * 1024));
  return `Storage full — ${usedMb} MB of ${quotaMb} MB used. Upgrade your plan or delete some files.`;
}

/**
 * Records an uploaded booking document. The file itself is uploaded straight
 * from the browser to Supabase Storage under `<couple_id>/<user_id>/…`, so
 * large PDFs never pass through the Next.js server.
 */
export async function saveTravelDocumentAction(formData: FormData): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Create your relationship space first.' };

  const documentId = String(formData.get('id') ?? '');
  const supabase = createClient();

  if (!documentId) {
    const entitlements = await getEntitlements();
    const { count } = await supabase
      .from('travel_documents')
      .select('id', { count: 'exact', head: true })
      .eq('couple_id', ctx.context.couple.id);
    if (limitReached(entitlements.limits, 'documents', count ?? 0)) {
      return { ok: false, error: upgradeMessage('documents') };
    }
  }

  const incomingBytes = Number(formData.get('file_size') ?? 0);
  if (incomingBytes > 0) {
    const quotaError = await storageQuotaError(ctx.context.couple.id, incomingBytes);
    if (quotaError) return { ok: false, error: quotaError };
  }

  const payload = {
    couple_id: ctx.context.couple.id,
    user_id: ctx.user.id,
    trip_id: String(formData.get('trip_id') ?? '') || null,
    doc_type: String(formData.get('doc_type') ?? 'other'),
    title: String(formData.get('title') ?? '').trim(),
    provider: String(formData.get('provider') ?? '').trim() || null,
    confirmation_code: String(formData.get('confirmation_code') ?? '').trim() || null,
    booking_reference: String(formData.get('booking_reference') ?? '').trim() || null,
    passenger_names: String(formData.get('passenger_names') ?? '').trim() || null,
    origin: String(formData.get('origin') ?? '').trim() || null,
    destination: String(formData.get('destination') ?? '').trim() || null,
    depart_at: String(formData.get('depart_at') ?? '') || null,
    arrive_at: String(formData.get('arrive_at') ?? '') || null,
    check_in: String(formData.get('check_in') ?? '') || null,
    check_out: String(formData.get('check_out') ?? '') || null,
    seat: String(formData.get('seat') ?? '').trim() || null,
    terminal: String(formData.get('terminal') ?? '').trim() || null,
    gate: String(formData.get('gate') ?? '').trim() || null,
    amount_cents: formData.get('amount')
      ? Math.round(Number(formData.get('amount')) * 100)
      : null,
    currency: String(formData.get('currency') ?? ctx.context.couple.currency),
    expires_at: String(formData.get('expires_at') ?? '') || null,
    file_path: String(formData.get('file_path') ?? '') || null,
    file_name: String(formData.get('file_name') ?? '') || null,
    file_mime: String(formData.get('file_mime') ?? '') || null,
    file_size: formData.get('file_size') ? Number(formData.get('file_size')) : null,
    notes: String(formData.get('notes') ?? '').trim() || null,
    is_shared: formData.get('is_shared') !== 'false',
    updated_at: new Date().toISOString(),
  };

  if (!payload.title) return { ok: false, error: 'Give the document a title.' };

  const { error } = documentId
    ? await supabase.from('travel_documents').update(payload).eq('id', documentId)
    : await supabase.from('travel_documents').insert(payload);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/dashboard/documents');
  return { ok: true, message: 'Saved to the vault.' };
}

export async function deleteTravelDocumentAction(documentId: string): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };

  const supabase = createClient();
  const { data: doc } = await supabase
    .from('travel_documents')
    .select('file_path')
    .eq('id', documentId)
    .maybeSingle();

  if ((doc as any)?.file_path) {
    await supabase.storage.from('documents').remove([(doc as any).file_path]);
  }

  const { error } = await supabase.from('travel_documents').delete().eq('id', documentId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/dashboard/documents');
  return { ok: true, message: 'Deleted.' };
}

/** Returns a short-lived signed URL so a private file can be opened. */
export async function getDocumentUrlAction(path: string): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };
  if (!path.startsWith(`${ctx.context.couple.id}/`)) {
    return { ok: false, error: 'That file does not belong to your space.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 300);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data as any).signedUrl };
}

/* ------------------------------------------------------------- Photo gallery */

export async function saveMediaAssetAction(formData: FormData): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Create your relationship space first.' };

  const incomingBytes = Number(formData.get('size_bytes') ?? 0);
  const quotaError = await storageQuotaError(ctx.context.couple.id, incomingBytes);
  if (quotaError) return { ok: false, error: quotaError };

  const supabase = createClient();
  const { error } = await supabase.from('media_assets').insert({
    couple_id: ctx.context.couple.id,
    user_id: ctx.user.id,
    bucket: 'couple-media',
    path: String(formData.get('path') ?? ''),
    file_name: String(formData.get('file_name') ?? 'photo'),
    mime_type: String(formData.get('mime_type') ?? '') || null,
    size_bytes: Number(formData.get('size_bytes') ?? 0),
    kind: String(formData.get('kind') ?? 'photo'),
    album: String(formData.get('album') ?? '').trim() || null,
    caption: String(formData.get('caption') ?? '').trim() || null,
    is_private: formData.get('is_private') === 'true',
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/gallery');
  return { ok: true, message: 'Uploaded.' };
}

export async function deleteMediaAssetAction(assetId: string): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };

  const supabase = createClient();
  const { data: asset } = await supabase
    .from('media_assets')
    .select('path, bucket')
    .eq('id', assetId)
    .maybeSingle();

  if (asset) {
    await supabase.storage
      .from((asset as any).bucket ?? 'couple-media')
      .remove([(asset as any).path]);
  }

  const { error } = await supabase.from('media_assets').delete().eq('id', assetId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/dashboard/gallery');
  return { ok: true, message: 'Deleted.' };
}

export async function getMediaUrlsAction(paths: string[]): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };

  const safe = paths.filter((path) => path.startsWith(`${ctx.context.couple.id}/`));
  if (!safe.length) return { ok: true, data: {} };

  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from('couple-media')
    .createSignedUrls(safe, 3600);

  if (error) return { ok: false, error: error.message };

  const map: Record<string, string> = {};
  for (const item of data ?? []) {
    if ((item as any).path && (item as any).signedUrl) {
      map[(item as any).path] = (item as any).signedUrl;
    }
  }
  return { ok: true, data: map };
}
