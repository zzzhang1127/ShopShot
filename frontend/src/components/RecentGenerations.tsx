import { RefreshCw, MoreHorizontal, Film } from 'lucide-react';
import { t } from '../lib/i18n';
import type { Video as VideoType } from '../types';

function assetUrl(relative: string) {
  return relative.startsWith('http') ? relative : `/files/${relative}`;
}

export default function RecentGenerations({
  videos,
  prompt,
  onRefresh,
  onPreview,
  busy,
}: {
  videos: VideoType[];
  prompt: string;
  onRefresh: () => void;
  onPreview: (url: string, title: string) => void;
  busy?: boolean;
}) {
  if (videos.length === 0) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-[#13121F]/80 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-white">{t('recentGenerations')}</h2>
        <button
          type="button"
          disabled={busy}
          onClick={onRefresh}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-40"
        >
          <RefreshCw size={16} />
        </button>
      </div>
      <div className="space-y-3">
        {videos.slice(0, 6).map((v) => (
          <div
            key={v.id}
            className="flex gap-4 p-3 rounded-xl bg-[#1C1B2B] border border-white/5 hover:border-cyan-500/30 transition-colors"
          >
            <button
              type="button"
              className="shrink-0 w-24 aspect-[9/16] rounded-lg overflow-hidden bg-black border border-white/10"
              onClick={() => onPreview(v.url, `${t('historyVideos')} #${v.id}`)}
            >
              <video
                src={assetUrl(v.url)}
                className="w-full h-full object-cover"
                muted
                playsInline
              />
            </button>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <p className="text-sm text-gray-200 line-clamp-2">{prompt || t('untitledScript')}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">
                  {t(`status_${v.status.toLowerCase()}`)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {videos.length === 0 && (
        <div className="flex flex-col items-center py-8 text-gray-600">
          <Film size={32} className="mb-2 opacity-40" />
          <p className="text-sm">{t('noVideosYet')}</p>
        </div>
      )}
    </section>
  );
}
