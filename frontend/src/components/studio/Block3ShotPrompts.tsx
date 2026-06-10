import { Film, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

export interface ShotPromptItem {
  shotId: string;
  imagePrompt: string;
  actionPrompt: string;
  words: string;
}

interface Block3Props {
  shotPrompts: ShotPromptItem[];
  onShotPromptChange: (idx: number, field: keyof ShotPromptItem, value: string) => void;
  onGenerateVideo: () => void;
  generating: boolean;
  disabled: boolean;
  aspectRatio: string;
  onAspectRatioChange: (r: string) => void;
  onFocus: () => void;
}

const SHOT_LABELS: Record<string, string> = {
  P1: '注意力（Attention）',
  P2: '兴趣（Interest）',
  P3: '欲望（Desire）',
  P4: '行动（Action）',
};

export default function Block3ShotPrompts({
  shotPrompts,
  onShotPromptChange,
  onGenerateVideo,
  generating,
  disabled,
  aspectRatio,
  onAspectRatioChange,
  onFocus,
}: Block3Props) {
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({});

  const toggleCard = (idx: number) =>
    setExpandedCards((prev) => ({ ...prev, [idx]: !prev[idx] }));

  const canGenerate = shotPrompts.length > 0;

  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden"
      onClick={onFocus}
    >
      {/* 标题栏 */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5 bg-white/[0.02]">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/30 flex items-center justify-center text-xs font-bold text-orange-400">
          3
        </div>
        <h2 className="text-sm font-semibold text-white">分镜提示词编辑</h2>
        <span className="text-[11px] text-gray-500 ml-auto">
          {shotPrompts.length > 0 ? `P1 ~ P${shotPrompts.length} · 可逐镜修改` : '等待板块二生成'}
        </span>
      </div>

      <div className="p-5 flex flex-col gap-3">
        {shotPrompts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
              <span className="text-2xl">🎥</span>
            </div>
            <p className="text-sm text-gray-500">请先完成板块二并点击「生成分镜提示词」</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2">
              {shotPrompts.map((shot, idx) => (
                <div
                  key={shot.shotId}
                  className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleCard(idx)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/20 flex items-center justify-center text-xs font-bold text-orange-400 shrink-0">
                      {shot.shotId}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white">
                        {SHOT_LABELS[shot.shotId] || `分镜 ${shot.shotId}`}
                      </p>
                      {shot.words && (
                        <p className="text-[10px] text-gray-500 truncate mt-0.5">
                          口播：{shot.words}
                        </p>
                      )}
                    </div>
                    {expandedCards[idx] ? (
                      <ChevronUp size={14} className="text-gray-500 shrink-0" />
                    ) : (
                      <ChevronDown size={14} className="text-gray-500 shrink-0" />
                    )}
                  </button>

                  {(expandedCards[idx] || shotPrompts.length === 1) && (
                    <div className="px-4 pb-4 space-y-2.5 border-t border-white/5 pt-3">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">
                          画面描述（image prompt，英文）
                        </label>
                        <textarea
                          value={shot.imagePrompt}
                          onChange={(e) => onShotPromptChange(idx, 'imagePrompt', e.target.value)}
                          disabled={generating}
                          rows={2}
                          className="w-full px-2.5 py-2 bg-black/30 border border-white/10 rounded-lg text-xs text-white outline-none focus:border-orange-500/40 resize-none transition-colors disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">
                          运镜描述（action prompt，英文）
                        </label>
                        <textarea
                          value={shot.actionPrompt}
                          onChange={(e) => onShotPromptChange(idx, 'actionPrompt', e.target.value)}
                          disabled={generating}
                          rows={2}
                          className="w-full px-2.5 py-2 bg-black/30 border border-white/10 rounded-lg text-xs text-white outline-none focus:border-orange-500/40 resize-none transition-colors disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">
                          口播文案（中文，10-15字）
                        </label>
                        <input
                          type="text"
                          value={shot.words}
                          onChange={(e) => onShotPromptChange(idx, 'words', e.target.value)}
                          disabled={generating}
                          maxLength={20}
                          className="w-full px-2.5 py-2 bg-black/30 border border-white/10 rounded-lg text-xs text-white outline-none focus:border-orange-500/40 transition-colors disabled:opacity-60"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 画面比例选择 */}
            <div className="flex items-center gap-3 px-1">
              <span className="text-xs text-gray-500 shrink-0">画面比例</span>
              <div className="flex gap-2">
                {['9:16', '16:9'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => onAspectRatioChange(r)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      aspectRatio === r
                        ? 'border-orange-500/50 bg-orange-500/10 text-orange-300'
                        : 'border-white/10 text-gray-500 hover:border-white/20'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* 生成视频按钮 */}
            <button
              type="button"
              onClick={onGenerateVideo}
              disabled={generating || disabled || !canGenerate}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-900/20"
            >
              {generating ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> 视频生成中…
                </>
              ) : (
                <>
                  <Film size={15} /> 生成视频
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
