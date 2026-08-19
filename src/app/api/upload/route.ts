import { NextResponse, type NextRequest } from 'next/server';
import { queryOne } from '@/lib/db';
import { getSessionUser, getCoupleContext, isAdminRole } from '@/lib/auth';
import { getEntitlements } from '@/lib/auth';
import {
  BUCKET_RULES,
  buildObjectPath,
  fileUrl,
  isBucket,
  saveFile,
  type Bucket,
} from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/** Buckets only an admin may write to. */
const ADMIN_BUCKETS: Bucket[] = ['blog', 'site'];

/**
 * Receives one file per request and writes it under the caller's own folder.
 * Nothing here trusts a client-supplied path: the object path is always built
 * from the session's couple id and user id.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Send the file as multipart/form-data.' }, { status: 400 });
  }

  const bucketName = String(form.get('bucket') ?? 'couple-media');
  if (!isBucket(bucketName)) {
    return NextResponse.json({ error: 'Unknown upload area.' }, { status: 400 });
  }
  const bucket: Bucket = bucketName;

  if (ADMIN_BUCKETS.includes(bucket) && !isAdminRole(user.profile.role)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Choose a file to upload.' }, { status: 400 });
  }

  const rules = BUCKET_RULES[bucket];
  if (file.size > rules.maxBytes) {
    return NextResponse.json(
      { error: `Files in this area must be under ${Math.round(rules.maxBytes / 1024 / 1024)} MB.` },
      { status: 413 }
    );
  }

  // Private buckets are namespaced by couple, so membership is required.
  let coupleId: string | null = null;
  if (bucket === 'couple-media' || bucket === 'documents') {
    const context = await getCoupleContext();
    if (!context) {
      return NextResponse.json(
        { error: 'Create your relationship space before uploading.' },
        { status: 403 }
      );
    }
    coupleId = context.couple.id;

    const quotaError = await storageQuotaError(coupleId, file.size);
    if (quotaError) return NextResponse.json({ error: quotaError }, { status: 413 });
  }

  const objectPath = buildObjectPath({
    coupleId,
    userId: user.id,
    fileName: file.name,
    prefix: String(form.get('prefix') ?? 'file'),
  });

  const stored = await saveFile({ bucket, objectPath, file });
  if (!stored.ok) return NextResponse.json({ error: stored.error }, { status: 400 });

  return NextResponse.json({
    ok: true,
    bucket,
    path: objectPath,
    url: fileUrl(bucket, objectPath),
    fileName: stored.stored.fileName,
    mimeType: stored.stored.mimeType,
    size: stored.stored.size,
  });
}

/** Mirrors the quota check in the vault actions so uploads fail before writing. */
async function storageQuotaError(coupleId: string, incomingBytes: number) {
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
  if (usedBytes + incomingBytes <= quotaMb * 1024 * 1024) return null;

  const usedMb = Math.round(usedBytes / (1024 * 1024));
  return `Storage full — ${usedMb} MB of ${quotaMb} MB used. Upgrade your plan or delete some files.`;
}
