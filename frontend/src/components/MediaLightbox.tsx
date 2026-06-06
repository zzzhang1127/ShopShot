import { X } from 'lucide-react';
import { t } from '../lib/i18n';

export type PreviewMedia = {
  url: string;
  type: 'image' | 'video' | 'audio';
  title?: string;
  poster?: string;
};

function resolveMediaUrl(url: string): string {
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return url;
  return `/files/${url}`;
}

export default function MediaLightbox({
  media,
  onClose,
}: {
  media: PreviewMedia | null;
  onClose: () => void;
}) {
  if (!media) return null;

  const src = resolveMediaUrl(media.url);
  const poster = media.poster ? resolveMediaUrl(media.poster) : undefined;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white z-10"
        aria-label={t('closePreview')}
      >
        <X size={22} />
      </button>
      <div
        className="relative max-w-5xl max-h-[90vh] w-full flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {media.title && (
          <p className="text-sm text-gray-300 mb-3 text-center max-w-lg">{media.title}</p>
        )}
        {media.type === 'image' ? (
          <img
            src={src}
            alt={media.title || 'preview'}
            className="max-h-[80vh] max-w-full rounded-xl object-contain shadow-2xl"
          />
        ) : media.type === 'audio' ? (
          <audio src={src} controls autoPlay className="w-full max-w-lg" />
        ) : (
          <video
            src={src}
            poster={poster}
            controls
            autoPlay
            className="max-h-[80vh] max-w-full rounded-xl shadow-2xl"
          />
        )}
      </div>
    </div>
  );
}
