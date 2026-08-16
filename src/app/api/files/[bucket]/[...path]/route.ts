import { NextResponse, type NextRequest } from 'next/server';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { Readable } from 'stream';
import { queryOne } from '@/lib/db';
import { getSessionUser, isAdminRole } from '@/lib/auth';
import {
  coupleIdFromPath,
  isBucket,
  mimeForPath,
  PUBLIC_BUCKETS,
  safeJoin,
  type Bucket,
} from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Serves stored files. Public buckets (blog, site, avatars) stream to anyone;
 * `couple-media` and `documents` require a signed-in member of the couple whose
 * id is the first path segment, or a platform admin.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { bucket: string; path: string[] } }
) {
  if (!isBucket(params.bucket)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }
  const bucket: Bucket = params.bucket;

  const objectPath = params.path.map(decodeURIComponent).join('/');
  const absolute = safeJoin(bucket, objectPath);
  if (!absolute) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  if (!PUBLIC_BUCKETS.includes(bucket)) {
    const allowed = await canRead(objectPath);
    if (!allowed) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  let size: number;
  try {
    const info = await stat(absolute);
    if (!info.isFile()) throw new Error('not a file');
    size = info.size;
  } catch {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const contentType = mimeForPath(objectPath);
  const stream = Readable.toWeb(createReadStream(absolute)) as ReadableStream;

  return new NextResponse(stream, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(size),
      'Cache-Control': PUBLIC_BUCKETS.includes(bucket)
        ? 'public, max-age=31536000, immutable'
        : 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  });
}

async function canRead(objectPath: string) {
  const user = await getSessionUser();
  if (!user) return false;
  if (isAdminRole(user.profile.role)) return true;

  const coupleId = coupleIdFromPath(objectPath);
  if (!coupleId) return false;

  const membership = await queryOne<{ id: string }>(
    `SELECT id FROM couple_members WHERE couple_id = ? AND user_id = ? AND removed_at IS NULL LIMIT 1`,
    [coupleId, user.id]
  );

  return Boolean(membership);
}
