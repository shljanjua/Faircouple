'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Trash2, Upload, X } from 'lucide-react';
import { deleteMediaAssetAction, saveMediaAssetAction } from '@/app/actions/vault';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Card, Input, Select } from '@/components/ui';
import { formatDate } from '@/lib/utils';

interface Asset {
  id: string;
  path: string;
  file_name: string;
  caption: string | null;
  album: string | null;
  is_private: boolean;
  user_id: string;
  created_at: string;
  mime_type: string | null;
}

/** Private files are streamed through the authenticated /api/files route. */
function fileUrl(path: string) {
  return `/api/files/couple-media/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export function GalleryWorkspace({
  meId,
  assets,
}: {
  coupleId: string;
  meId: string;
  assets: Asset[];
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [album, setAlbum] = useState('all');
  const [lightbox, setLightbox] = useState<Asset | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const albums = useMemo(() => {
    const set = new Set<string>();
    for (const asset of assets) if (asset.album) set.add(asset.album);
    return Array.from(set).sort();
  }, [assets]);

  const visible = useMemo(
    () => (album === 'all' ? assets : assets.filter((asset) => asset.album === album)),
    [assets, album]
  );

  async function upload(files: FileList) {
    setUploading(true);
    setError(null);

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      setProgress(`Uploading ${index + 1} of ${files.length}…`);

      if (file.size > 25 * 1024 * 1024) {
        setError(`${file.name} is larger than 25 MB.`);
        continue;
      }

      const upload = new FormData();
      upload.set('bucket', 'couple-media');
      upload.set('prefix', 'photo');
      upload.set('file', file);

      const response = await fetch('/api/upload', { method: 'POST', body: upload });
      const payload = await response.json().catch(() => ({ error: 'Upload failed.' }));

      if (!response.ok || !payload.path) {
        setError(payload.error ?? `Could not upload ${file.name}.`);
        break;
      }

      const formData = new FormData();
      formData.set('path', payload.path);
      formData.set('file_name', file.name);
      formData.set('mime_type', file.type);
      formData.set('size_bytes', String(file.size));
      formData.set('kind', file.type.startsWith('video') ? 'video' : 'photo');

      const result = await saveMediaAssetAction(formData);
      if (!result.ok) {
        setError(result.error);
        break;
      }
    }

    setUploading(false);
    setProgress('');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Photos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Private to your space. Files are stored outside the web root and served only to the two
            of you, after your session is checked.
          </p>
        </div>
        <div className="flex gap-2">
          {albums.length > 0 && (
            <Select value={album} onChange={(event) => setAlbum(event.target.value)} className="w-40">
              <option value="all">All albums</option>
              {albums.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          )}
          <Button onClick={() => fileRef.current?.click()} loading={uploading}>
            <Upload className="h-4 w-4" aria-hidden />
            Upload
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/mp4"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files?.length) void upload(event.target.files);
              event.target.value = '';
            }}
          />
        </div>
      </header>

      {progress && <Alert tone="info">{progress}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}

      {visible.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="font-medium">No photos yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload the ones you actually want to keep — trips, anniversaries, small ordinary days.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((asset) => (
            <div key={asset.id} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
              {asset.mime_type?.startsWith('video') ? (
                <video
                  src={fileUrl(asset.path)}
                  className="h-full w-full object-cover"
                  controls
                  preload="metadata"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fileUrl(asset.path)}
                  alt={asset.caption ?? asset.file_name}
                  loading="lazy"
                  onClick={() => setLightbox(asset)}
                  className="h-full w-full cursor-zoom-in object-cover transition-transform duration-300 group-hover:scale-105"
                />
              )}

              {asset.is_private && (
                <Badge tone="default" className="absolute left-2 top-2">
                  <Lock className="h-3 w-3" aria-hidden /> private
                </Badge>
              )}

              {asset.user_id === meId && (
                <button
                  type="button"
                  aria-label={`Delete ${asset.file_name}`}
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await deleteMediaAssetAction(asset.id);
                      if (!result.ok) setError(result.error);
                      else router.refresh();
                    })
                  }
                  className="absolute right-2 top-2 rounded-md bg-black/60 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.caption ?? lightbox.file_name}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white"
            aria-label="Close"
            onClick={() => setLightbox(null)}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileUrl(lightbox.path)}
            alt={lightbox.caption ?? lightbox.file_name}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
          <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-white/80">
            {lightbox.caption ?? lightbox.file_name} · {formatDate(lightbox.created_at)}
          </p>
        </div>
      )}
    </div>
  );
}
