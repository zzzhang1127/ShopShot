import { useRef, useState } from 'react';
import { Upload, Layers, Loader2, Clock } from 'lucide-react';

interface ShotTemplateItem {
  assetId: number;
  url: string;
  filename: string;
  cameraStyle: string;
}

interface Block2Props {
  scriptText: string;
  onScriptChange: (v: string) => void;
  duration: 5 | 10 | 15 | 20;
  onDurationChange: (d: 5 | 10 | 15 | 20) => void;
  shotTemplates: ShotTemplateItem[];
  onTemplateUpload: (file: File) => void;
  onGenerateShotPrompts: () => void;
  generating: boolean;
  disabled: boolean;
  onDrop: (e: React.DragEvent) => void;
  onFocus: () => void;
}

const DURATION_SHOTS: Record<number, number> = { 5: 1, 10: 2, 15: 3, 20: 4 };

export default function Block2ScriptEdit({
  scriptText,
  onScriptChange,
  duration,
  onDurationChange,
  shotTemplates,
  onTemplateUpload,
  onGenerateShotPrompts,
  generating,
  disabled,
  onDrop,
  onFocus,
}: Block2Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      ['video/mp4', 'video/quicktime', 'video/webm'].includes(f.type)
    );
    if (files.length) {
      onTemplateUpload(files[0]);
    } else {
      onDrop(e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onTemplateUpload(file);
    e.target.value = '';
  };

  const shotCount = DURATION_SHOTS[duration] ?? 4;

  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden"
      onClick={onFocus}
    >
      {/* 标题栏 */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5 bg-white/[0.02]">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 flex items-center justify-center text-xs font-bold text-violet-400">
          2
        </div>
        <h2 className="text-sm font-semibold text-white">剧本编辑 & 分镜参数</h2>
        <span className="text-[11px] text-gray-500 ml-auto">
          编辑脚本 · 选时长 · 上传参考模板
        </span>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* 剧本文本 */}
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">
            带货脚本文案 <span className="text-gray-600">（由板块一生成，可自由修改）</span>
          </label>
          <textarea
            value={scriptText}
            onChange={(e) => onScriptChange(e.target.value)}
            disabled={disabled}
            placeholder="点击板块一的「生成剧本」按钮后，剧本文案将显示在此处，你可以自由修改…"
            rows={8}
            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 outline-none focus:border-violet-500/50 resize-none transition-colors disabled:opacity-60"
          />
        </div>

        <div className="flex flex-wrap gap-4 items-start">
          {/* 视频时长选择 */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-gray-500 mb-2 flex items-center gap-1.5">
              <Clock size={12} /> 视频总时长
            </label>
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/8 gap-0.5">
              {([5, 10, 15, 20] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onDurationChange(d)}
                  className={`flex-1 flex flex-col items-center py-2 rounded-lg text-xs font-medium transition-all ${
                    duration === d
                      ? 'bg-violet-600/30 border border-violet-500/40 text-white'
                      : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                  }`}
                >
                  <span>{d}s</span>
                  <span className="text-[9px] text-gray-600 font-normal mt-0.5">
                    {DURATION_SHOTS[d]}镜
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 mt-1.5">
              将生成 P1~P{shotCount} 共 {shotCount} 段分镜提示词
            </p>
          </div>

          {/* 上传分镜模板 */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-gray-500 mb-2">
              分镜参考模板 <span className="text-gray-600">（可选）</span>
            </label>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={`h-[88px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                isDragOver
                  ? 'border-violet-500/60 bg-violet-500/5'
                  : 'border-white/12 hover:border-white/25 bg-white/[0.02]'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16} className="text-gray-500" />
              <p className="text-[11px] text-gray-500">拖拽 / 点击上传视频模板</p>
              <p className="text-[10px] text-gray-600">mp4 / mov / webm</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              onChange={handleFileChange}
              className="hidden"
            />
            {shotTemplates.length > 0 && (
              <p className="text-[10px] text-gray-500 mt-1.5">
                已选 {shotTemplates.length} 个模板（运镜风格见右侧）
              </p>
            )}
          </div>
        </div>

        {/* 生成按钮 */}
        <button
          type="button"
          onClick={onGenerateShotPrompts}
          disabled={generating || disabled || !scriptText.trim()}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-900/20"
        >
          {generating ? (
            <>
              <Loader2 size={15} className="animate-spin" /> 生成分镜提示词中…
            </>
          ) : (
            <>
              <Layers size={15} /> 生成分镜提示词
            </>
          )}
        </button>
        {!scriptText.trim() && (
          <p className="text-center text-[10px] text-gray-600 -mt-2">
            请先在板块一生成剧本，或在上方手动输入脚本
          </p>
        )}
      </div>
    </div>
  );
}
