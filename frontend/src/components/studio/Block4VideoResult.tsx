import { Download, Share2, Bookmark, PlayCircle, Loader2 } from 'lucide-react';
import type { Video as VideoType } from '../../types';
import { saveCustomTemplate } from '../../lib/templateStore';

function assetUrl(rel: string) {
  return rel.startsWith('http') ? rel : `/files/${rel}`;
}

interface Block4Props {
  videos: VideoType[];
  shotVideos: Array<{ shotId: string; url: string; assetId: number }>;
  taskStatus?: string;
  taskProgress?: number;
  taskStep?: string;
  onPreview: (url: string) => void;
  projectName: string;
  onFocus: () => void;
}

export default function Block4VideoResult({
  videos,
  shotVideos,
  taskStatus,
  taskProgress,
  taskStep,
  onPreview,
  projectName,
  onFocus,
}: Block4Props) {
  const isGenerating =
    taskStatus === 'queued' || taskStatus === 'running';
  const latestVideo = videos[0] ?? null;

  const handleSaveToLibrary = (v: VideoType) => {
    const id = `custom-${v.id}-${Date.now()}`;
    saveCustomTemplate({
      id,
      title: `${projectName} #${v.id}`,
      prompt: '',
      category: 'custom',
      source: 'custom',
      ratio: '9:16',
      duration: v.duration ?? 20,
      previewVideo: assetUrl(v.url),
      coverImage: v.thumbnail_url ? assetUrl(v.thumbnail_url) : assetUrl(v.url),
    });
    alert('已保存到模板库');
  };

  const handleSaveShotToLibrary = (shot: { shotId: string; url: string }) => {
    const id = `shot-tpl-${Date.now()}`;
    saveCustomTemplate({
      id,
      title: `分镜 ${shot.shotId} · ${projectName}`,
      prompt: '',
      category: 'custom',
      source: 'custom',
      ratio: '9:16',
      duration: 5,
      previewVideo: assetUrl(shot.url),
      coverImage: assetUrl(shot.url),
    });
    alert(`${shot.shotId} 已保存为分镜模板`);
  };

  const handleDownload = async (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = assetUrl(url);
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const stepLabels: Record<string, string> = {
    queued: '等待生成…',
    script_llm: 'AI 正在撰写脚本…',
    video_generate: '视频生成中…',
    postprocess: '视频后处理中…',
    done: '生成完成',
  };

  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden"
      onClick={onFocus}
    >
      {/* 标题栏 */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5 bg-white/[0.02]">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center text-xs font-bold text-green-400">
          4
        </div>
        <h2 className="text-sm font-semibold text-white">视频呈现</h2>
        <span className="text-[11px] text-gray-500 ml-auto">成品 + 分镜 + 保存/发布</span>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* 生成中占位提示（详细进度在顶部置顶进度条） */}
        {isGenerating && !latestVideo && (
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 flex items-center gap-3">
            <Loader2 size={15} className="text-green-400 animate-spin shrink-0" />
            <span className="text-sm text-green-300">
              {stepLabels[taskStep ?? ''] || '视频生成中，请稍候…'}
              <span className="text-xs text-gray-500 ml-2">（进度详情见顶部）</span>
            </span>
          </div>
        )}

        {/* 成品视频 */}
        {latestVideo ? (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              成品视频
            </h3>
            <div className="rounded-xl overflow-hidden border border-white/10 bg-black/30">
              <video
                src={assetUrl(latestVideo.url)}
                controls
                className="w-full max-h-64 object-contain"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(assetUrl(latestVideo.url));
                }}
              />
              <div className="flex flex-wrap gap-2 p-3">
                <button
                  type="button"
                  onClick={() => onPreview(assetUrl(latestVideo.url))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 hover:bg-white/10 transition-colors"
                >
                  <PlayCircle size={13} /> 全屏播放
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(latestVideo.url, `shopshot-${latestVideo.id}.mp4`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 hover:bg-white/10 transition-colors"
                >
                  <Download size={13} /> 保存视频
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveToLibrary(latestVideo)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-300 hover:bg-green-500/20 transition-colors"
                >
                  <Bookmark size={13} /> 发布到视频模板库
                </button>
              </div>
            </div>
          </div>
        ) : !isGenerating ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
              <span className="text-2xl">🎞️</span>
            </div>
            <p className="text-sm text-gray-500">视频将在这里呈现</p>
            <p className="text-[11px] text-gray-600 mt-1">请先完成前三个板块</p>
          </div>
        ) : null}

        {/* 分镜视频列表 */}
        {shotVideos.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              分镜视频 ({shotVideos.length})
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {shotVideos.map((sv) => (
                <div
                  key={sv.assetId}
                  className="rounded-xl overflow-hidden border border-white/10 bg-black/20"
                >
                  <div
                    className="relative cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPreview(assetUrl(sv.url));
                    }}
                  >
                    <video
                      src={assetUrl(sv.url)}
                      className="w-full h-20 object-cover"
                      muted
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/10 transition-colors">
                      <PlayCircle size={22} className="text-white/80" />
                    </div>
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/70 rounded text-[9px] font-bold text-white">
                      {sv.shotId}
                    </div>
                  </div>
                  <div className="flex gap-1 p-1.5">
                    <button
                      type="button"
                      onClick={() => handleDownload(sv.url, `shot-${sv.shotId}.mp4`)}
                      className="flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Download size={10} /> 保存
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveShotToLibrary(sv)}
                      className="flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] text-gray-400 hover:text-green-400 hover:bg-white/5 transition-colors"
                    >
                      <Share2 size={10} /> 发布分镜
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 历史视频 */}
        {videos.length > 1 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              历史生成 ({videos.length - 1})
            </h3>
            <div className="flex flex-wrap gap-2">
              {videos.slice(0, -1).reverse().map((v) => (
                <div
                  key={v.id}
                  className="relative cursor-pointer rounded-lg overflow-hidden border border-white/10 w-20 h-14"
                  onClick={() => onPreview(assetUrl(v.url))}
                >
                  <video
                    src={assetUrl(v.url)}
                    className="w-full h-full object-cover"
                    muted
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <PlayCircle size={16} className="text-white/70" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
