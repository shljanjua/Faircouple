import 'server-only';
import { mkdir, writeFile, unlink, stat } from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';

/**
 * Local file storage, replacing object storage now that the backend is
 * Hostinger MySQL. Files live outside the web root and are served only
 * through /api/files/…, which checks the session and couple membership on
 * every request — so a private photo or a passport scan is never publicly
 * addressable.
 *
 * Path convention: <bucket>/<couple_id>/<user_id>/<random>.<ext>
 */

export const BUCKETS = ['couple-media', 'documents', 'avatars', 'blog', 'site'] as const;
export type Bucket = (typeof BUCKETS)[number];

export const PUBLIC_BUCKETS: Bucket[] = ['avatars', 'blog', 'site'];

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic'];
const DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

export const BUCKET_RULES: Record<Bucket, { maxBytes: number; mimeTypes: string[] }> = {
  'couple-media': {
    maxBytes: 25 * 1024 * 1024,
    mimeTypes: [...IMAGE_TYPES, 'video/mp4', 'video/quicktime'],
  },
  documents: { maxBytes: 50 * 1024 * 1024, mimeTypes: [...DOCUMENT_TYPES, ...IMAGE_TYPES] },
  avatars: { maxBytes: 5 * 1024 * 1024, mimeTypes: IMAGE_TYPES },
  blog: { maxBytes: 10 * 1024 * 1024, mimeTypes: [...IMAGE_TYPES, 'image/svg+xml'] },
  site: { maxBytes: 10 * 1024 * 1024, mimeTypes: [...IMAGE_TYPES, 'image/svg+xml', 'image/x-icon'] },
};

export function uploadRoot() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), 'storage', 'uploads');
}

export function isBucket(value: string): value is Bucket {
  return (BUCKETS as readonly string[]).includes(value);
}

/** Rejects traversal, absolute paths and anything outside the upload root. */
export function safeJoin(bucket: string, relativePath: string): string | null {
  if (!isBucket(bucket)) return null;
  const normalized = path
    .normalize(relativePath)
    .replace(/^([/\\])+/, '')
    .replace(/\\/g, '/');

  if (!normalized || normalized.includes('..') || path.isAbsolute(normalized)) return null;

  const root = path.resolve(uploadRoot(), bucket);
  const target = path.resolve(root, normalized);
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return target;
}

export function buildObjectPath(parts: {
  coupleId?: string | null;
  userId: string;
  fileName: string;
  prefix?: string;
}) {
  const extension = (parts.fileName.split('.').pop() ?? 'bin')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 8);
  const unique = `${Date.now()}-${randomBytes(4).toString('hex')}`;
  const segments = [parts.coupleId, parts.userId, `${parts.prefix ?? 'file'}-${unique}.${extension}`]
    .filter(Boolean)
    .join('/');
  return segments;
}

export interface StoredFile {
  bucket: Bucket;
  objectPath: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export async function saveFile(params: {
  bucket: Bucket;
  objectPath: string;
  file: File;
}): Promise<{ ok: true; stored: StoredFile } | { ok: false; error: string }> {
  const rules = BUCKET_RULES[params.bucket];
  if (params.file.size > rules.maxBytes) {
    return {
      ok: false,
      error: `Files in this area must be under ${Math.round(rules.maxBytes / 1024 / 1024)} MB.`,
    };
  }
  if (params.file.type && !rules.mimeTypes.includes(params.file.type)) {
    return { ok: false, error: `${params.file.type} files are not allowed here.` };
  }

  const target = safeJoin(params.bucket, params.objectPath);
  if (!target) return { ok: false, error: 'Invalid file path.' };

  try {
    await mkdir(path.dirname(target), { recursive: true });
    const buffer = Buffer.from(await params.file.arrayBuffer());
    await writeFile(target, buffer);

    return {
      ok: true,
      stored: {
        bucket: params.bucket,
        objectPath: params.objectPath,
        fileName: params.file.name,
        mimeType: params.file.type || 'application/octet-stream',
        size: params.file.size,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not write the file to disk.',
    };
  }
}

export async function deleteFile(bucket: string, objectPath: string) {
  const target = safeJoin(bucket, objectPath);
  if (!target) return false;
  try {
    await unlink(target);
    return true;
  } catch {
    return false;
  }
}

export async function fileExists(bucket: string, objectPath: string) {
  const target = safeJoin(bucket, objectPath);
  if (!target) return false;
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
};

/** Content type for a stored object, from its extension. */
export function mimeForPath(objectPath: string) {
  const extension = objectPath.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

/** The URL a browser uses to read a stored file. */
export function fileUrl(bucket: string, objectPath: string) {
  return `/api/files/${bucket}/${objectPath.split('/').map(encodeURIComponent).join('/')}`;
}

/** The couple id encoded in a private object path, used for access checks. */
export function coupleIdFromPath(objectPath: string): string | null {
  const first = objectPath.split('/')[0];
  return first && /^[0-9a-f-]{36}$/i.test(first) ? first : null;
}

/** The owner id encoded in an object path — the segment before the filename. */
export function userIdFromPath(objectPath: string): string | null {
  const segments = objectPath.split('/');
  const candidate = segments.length > 1 ? segments[segments.length - 2] : null;
  return candidate && /^[0-9a-f-]{36}$/i.test(candidate) ? candidate : null;
}
