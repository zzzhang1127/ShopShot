import { useEffect, useRef, useState } from 'react';
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
      className={`relative shrink-0 w-28 md:w-32 rounded-xl overflow-hidden border transition-all ${
        selected ? 'border-cyan-500 ring-2 ring-cyan-500/40' : 'border-white/10 hover:border-white/30'
      }`}
    >
      <div className="aspect-[9/16] bg-gradient-to-br from-gray-800 to-gray-900 relative">
        {cat.previewVideo && (
          <video
            ref={videoRef}
            src={cat.previewVideo}
            muted
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
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
      <div className="flex gap-3 overflow-x-auto pb-2">
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
