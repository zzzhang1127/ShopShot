import { useEffect, useRef, useState } from 'react';
import { t } from '../lib/i18n';
import type { CategoryChip } from '../lib/categoryShowcase';

type Props = {
  categories: CategoryChip[];
  selectedId?: string;
  onSelect: (id: string) => void;
};

function CategoryVideoTile({
  cat,
  selected,
  onClick,
}: {
  cat: CategoryChip;
  selected: boolean;
  onClick: () => void;
}) {
  const rootRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => setVisible(e.isIntersecting),
      { rootMargin: '40px', threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (visible) v.play().catch(() => {});
    else v.pause();
  }, [visible]);

  return (
    <button
      ref={rootRef}
      type="button"
      onClick={onClick}
      className={`relative shrink-0 w-[88px] rounded-xl overflow-hidden border transition-all ${
        selected ? 'border-purple-500 ring-2 ring-purple-500/40' : 'border-white/10 hover:border-white/30'
      }`}
    >
      <div className="aspect-[9/16] bg-black relative">
        <img
          src={cat.coverImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
        <video
          ref={videoRef}
          src={cat.previewVideo}
          poster={cat.coverImage}
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 p-1.5 text-left pointer-events-none">
          <span className="text-[10px] font-medium text-white line-clamp-1">{cat.label}</span>
          {cat.count > 0 && (
            <span className="text-[9px] text-gray-400 block">{cat.count}</span>
          )}
        </div>
      </div>
    </button>
  );
}

/** 每类目一个会动的示例视频封面 */
export default function CategoryVideoStrip({ categories, selectedId, onSelect }: Props) {
  if (categories.length === 0) return null;

  return (
    <div className="mb-5">
      <p className="text-xs text-gray-500 mb-2">{t('categoryVideoStripHint')}</p>
      <div className="flex gap-2 overflow-x-auto pb-2">
        <CategoryVideoTile
          cat={{
            id: '',
            label: t('allCategories'),
            count: categories.reduce((s, c) => s + c.count, 0),
            previewVideo: categories[0]?.previewVideo || '/templates/clothes.mp4',
            coverImage: categories[0]?.coverImage || '/templates/clothes.jpg',
          }}
          selected={!selectedId}
          onClick={() => onSelect('')}
        />
        {categories.map((cat) => (
          <CategoryVideoTile
            key={cat.id}
            cat={cat}
            selected={selectedId === cat.id}
            onClick={() => onSelect(cat.id)}
          />
        ))}
      </div>
    </div>
  );
}
