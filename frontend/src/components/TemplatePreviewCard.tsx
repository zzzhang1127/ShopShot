import { useEffect, useRef, useState } from 'react';
import { Eye, Sparkles, X } from 'lucide-react';
import { t } from '../lib/i18n';

type Props = {
  title: string;
  coverImage?: string;
  previewVideo?: string;
  duration?: number;
  isNew?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onPreview?: () => void;
  onRemove?: () => void;
  footer?: React.ReactNode;
  compact?: boolean;
};

/** 模板卡片：默认循环播放示例视频（可见区域内），封面作加载占位 */
export default function TemplatePreviewCard({
  title,
  coverImage,
  previewVideo,
  duration,
  isNew,
  selected,
  onSelect,
  onPreview,
  onRemove,
  footer,
  compact,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: '80px', threshold: 0.25 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !previewVideo) return;
    if (visible) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [visible, previewVideo]);

  return (
    <div
      ref={rootRef}
      className={`group relative rounded-xl overflow-hidden cursor-pointer transition-all bg-[#1a1828] ${
        compact ? 'aspect-[3/4]' : 'aspect-[9/16]'
      } ${selected ? 'ring-2 ring-purple-500' : 'hover:ring-2 hover:ring-purple-500/60'}`}
      onClick={onSelect}
    >
      {coverImage && (
        <img
          src={coverImage}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            videoReady && previewVideo ? 'opacity-0' : 'opacity-100'
          }`}
          loading="lazy"
        />
      )}

      {previewVideo ? (
        <video
          ref={videoRef}
          src={previewVideo}
          poster={coverImage}
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
          onCanPlay={() => setVideoReady(true)}
        />
      ) : (
        !coverImage && (
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/80 via-purple-900/60 to-pink-900/50" />
        )
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent pointer-events-none" />

      {isNew && (
        <span className="absolute top-2 left-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md z-10">
          {t('templateNew')}
        </span>
      )}

      {onRemove && (
        <button
          type="button"
          className="absolute top-2 right-2 z-10 p-1.5 rounded bg-black/50 text-gray-200 hover:text-white"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title={t('removeTemplate')}
        >
          <X size={12} />
        </button>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-3 z-10 pointer-events-none">
        <h3 className="text-sm font-semibold text-white drop-shadow-md line-clamp-2">{title}</h3>
        {duration != null && (
          <p className="text-[10px] text-gray-300 mt-0.5">
            {duration}
            {t('seconds')}
          </p>
        )}
      </div>

      <div className="absolute inset-0 flex items-end justify-center pb-14 gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {onPreview && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur text-xs text-white border border-white/20"
          >
            <Eye size={14} /> {t('previewTemplate')}
          </button>
        )}
        {onSelect && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-purple-600/95 text-xs text-white"
          >
            <Sparkles size={14} /> {t('useTemplate')}
          </button>
        )}
      </div>

      {footer && <div className="absolute inset-x-0 bottom-0 z-20">{footer}</div>}
    </div>
  );
}
