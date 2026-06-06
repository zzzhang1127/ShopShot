import { Play } from 'lucide-react';

type Props = {
  src: string;
  className?: string;
  aspect?: 'square' | 'video';
};

export default function VideoThumbnail({ src, className = '', aspect = 'square' }: Props) {
  const ratio = aspect === 'video' ? 'aspect-video' : 'aspect-square';

  return (
    <div className={`relative ${ratio} bg-black overflow-hidden ${className}`}>
      <video
        src={src}
        muted
        playsInline
        preload="metadata"
        className="w-full h-full object-cover"
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (v.duration > 0.5) v.currentTime = Math.min(0.5, v.duration * 0.05);
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
        <div className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20">
          <Play size={14} className="text-white ml-0.5" fill="white" />
        </div>
      </div>
    </div>
  );
}
