import { Film, Loader2, ChevronDown, ChevronUp, Music, Mic, Upload, X } from 'lucide-react';
import { useState, useRef } from 'react';
import type { BgmPreset } from '../../api/client';

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
  enableTts: boolean;
  onEnableTtsChange: (v: boolean) => void;
  ttsVoice: string;
  onTtsVoiceChange: (v: string) => void;
  bgmPresets: BgmPreset[];
  selectedBgmPresetId: string | null;
  onSelectBgmPreset: (id: string | null) => void;
  onUploadBgm: (file: File) => void;
  uploadedBgmName: string | null;
  onFocus: () => void;
}

const SHOT_LABELS: Record<string, string> = {
  P1: '注意力（Attention）',
  P2: '兴趣（Interest）',
  P3: '欲望（Desire）',
  P4: '行动（Action）',
};

const TTS_VOICES = [
  { value: 'zh-CN-XiaoxiaoNeural', label: '小晓（暖心女声）' },
  { value: 'zh-CN-YunxiNeural', label: '云希（阳光男声）' },
  { value: 'zh-CN-XiaoyiNeural', label: '晓伊（活泼女声）' },
  { value: 'zh-CN-YunjianNeural', label: '云健（磁性男声）' },
];

export default function Block3ShotPrompts({
  shotPrompts,
  onShotPromptChange,
  onGenerateVideo,
  generating,
  disabled,
  aspectRatio,
  onAspectRatioChange,
  enableTts,
  onEnableTtsChange,
  ttsVoice,
  onTtsVoiceChange,
  bgmPresets,
  selectedBgmPresetId,
  onSelectBgmPreset,
  onUploadBgm,
  uploadedBgmName,
  onFocus,
}: Block3Props) {
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({ 0: true });
  const [showAudio, setShowAudio] = useState(false);
  const bgmInputRef = useRef<HTMLInputElement>(null);

  const toggleCard = (idx: number) =>
    setExpandedCards((prev) => ({ ...prev, [idx]: !prev[idx] }));

  const canGenerate = shotPrompts.length > 0;
  const hasWords = shotPrompts.some((s) => s.words.trim().length > 0);

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

                  {expandedCards[idx] === true && (
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

            {/* 音频设置折叠面板 */}
            <div
              className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowAudio((v) => !v)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
              >
                <Music size={13} className="text-purple-400 shrink-0" />
                <span className="text-xs font-medium text-gray-300">音频设置</span>
                <div className="ml-auto flex items-center gap-2">
                  {(enableTts || selectedBgmPresetId || uploadedBgmName) && (
                    <span className="text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
                      {[enableTts && '人声', (selectedBgmPresetId || uploadedBgmName) && 'BGM']
                        .filter(Boolean)
                        .join(' + ')}
                    </span>
                  )}
                  {showAudio ? (
                    <ChevronUp size={13} className="text-gray-500" />
                  ) : (
                    <ChevronDown size={13} className="text-gray-500" />
                  )}
                </div>
              </button>

              {showAudio && (
                <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-3">

                  {/* TTS 人声 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Mic size={11} className="text-blue-400" />
                        <span className="text-xs text-gray-300 font-medium">AI 人声旁白</span>
                        {!hasWords && (
                          <span className="text-[10px] text-yellow-500/70 ml-1">（需填写口播文案）</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onEnableTtsChange(!enableTts)}
                        className={`relative w-9 h-5 rounded-full transition-colors ${
                          enableTts ? 'bg-blue-600' : 'bg-white/15'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            enableTts ? 'translate-x-[18px]' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                    {enableTts && (
                      <div className="ml-4">
                        <label className="block text-[10px] text-gray-500 mb-1.5">选择声线</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {TTS_VOICES.map((v) => (
                            <button
                              key={v.value}
                              type="button"
                              onClick={() => onTtsVoiceChange(v.value)}
                              className={`px-2.5 py-2 rounded-lg border text-[11px] text-left transition-all ${
                                ttsVoice === v.value
                                  ? 'border-blue-500/50 bg-blue-500/10 text-blue-300'
                                  : 'border-white/10 text-gray-400 hover:border-white/20'
                              }`}
                            >
                              {v.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-600 mt-1.5">
                          TTS 将根据每个分镜的「口播文案」自动合成旁白并混入对应分镜视频
                        </p>
                      </div>
                    )}
                  </div>

                  {/* BGM */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Music size={11} className="text-purple-400" />
                      <span className="text-xs text-gray-300 font-medium">背景音乐（BGM）</span>
                    </div>

                    {/* 预置 BGM */}
                    {bgmPresets.length > 0 && (
                      <div className="grid grid-cols-2 gap-1.5 mb-2">
                        {bgmPresets.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            disabled={!preset.available}
                            onClick={() =>
                              onSelectBgmPreset(
                                selectedBgmPresetId === preset.id ? null : preset.id
                              )
                            }
                            className={`relative flex flex-col px-3 py-2.5 rounded-lg border text-left transition-all ${
                              !preset.available
                                ? 'border-white/5 bg-white/[0.01] opacity-40 cursor-not-allowed'
                                : selectedBgmPresetId === preset.id
                                ? 'border-purple-500/50 bg-purple-500/10'
                                : 'border-white/10 hover:border-white/20'
                            }`}
                          >
                            <span className="text-[11px] font-medium text-gray-200">
                              {preset.label}
                            </span>
                            <span className="text-[10px] text-gray-500 mt-0.5 leading-tight">
                              {preset.description}
                            </span>
                            {!preset.available && (
                              <span className="absolute top-1.5 right-1.5 text-[9px] text-gray-600 bg-white/5 px-1 rounded">
                                未配置
                              </span>
                            )}
                            {selectedBgmPresetId === preset.id && (
                              <span className="absolute top-1.5 right-1.5 text-[10px] text-purple-400">✓</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* 自定义上传 BGM */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => bgmInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 hover:bg-white/10 transition-colors"
                      >
                        <Upload size={11} /> 上传自定义 BGM
                      </button>
                      {uploadedBgmName && (
                        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                          <Music size={10} className="text-purple-400 shrink-0" />
                          <span className="text-[10px] text-purple-300 max-w-[120px] truncate">
                            {uploadedBgmName}
                          </span>
                          <button
                            type="button"
                            onClick={() => onSelectBgmPreset(null)}
                            className="text-gray-500 hover:text-red-400 transition-colors"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                    <input
                      ref={bgmInputRef}
                      type="file"
                      accept="audio/mp3,audio/mpeg,audio/wav,audio/aac,audio/ogg,audio/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onUploadBgm(f);
                        e.target.value = '';
                      }}
                    />

                    {(selectedBgmPresetId || uploadedBgmName) && (
                      <button
                        type="button"
                        onClick={() => onSelectBgmPreset(null)}
                        className="mt-1.5 text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                      >
                        ✕ 不使用 BGM
                      </button>
                    )}
                  </div>
                </div>
              )}
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
                  {(enableTts || selectedBgmPresetId || uploadedBgmName) && (
                    <span className="text-xs opacity-70 font-normal">
                      · {[enableTts && '含人声', (selectedBgmPresetId || uploadedBgmName) && '含BGM'].filter(Boolean).join('+')}
                    </span>
                  )}
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
