import { useRef, useState } from 'react';
import {
  Image as ImageIcon,
  Video,
  Music,
  LayoutTemplate,
  ImagePlus,
  Settings2,
  Sparkles,
  Wand2,
  Palette,
  ChevronDown,
} from 'lucide-react';
import { t } from '../lib/i18n';
import type { MediaTab } from '../lib/pixellePipelines';

export type ModelOption = { id: string; name: string; configured: boolean };

type Props = {
  query: string;
  onQueryChange: (v: string) => void;
  mediaTab: MediaTab;
  onMediaTabChange: (tab: MediaTab) => void;
  models: ModelOption[];
  selectedModelId: string;
  onModelChange: (id: string) => void;
  onGenerate: () => void;
  onEnhance?: () => void;
  onFileSelect?: (file: File) => void;
  generating?: boolean;
  generateDisabled?: boolean;
  placeholder?: string;
  /** 创作页显示 Image/Video/Audio/Templates 四 Tab */
  showTemplatesTab?: boolean;
  aspectRatio?: string;
  onAspectRatioChange?: (r: string) => void;
  duration?: number;
  onDurationChange?: (d: number) => void;
};

const mediaTabs: { id: MediaTab; icon: typeof ImageIcon; labelKey: string }[] = [
  { id: 'image', icon: ImageIcon, labelKey: 'tabImage' },
  { id: 'video', icon: Video, labelKey: 'tabVideo' },
  { id: 'audio', icon: Music, labelKey: 'tabAudio' },
];

export default function CliprisePromptBar({
  query,
  onQueryChange,
  mediaTab,
  onMediaTabChange,
  models,
  selectedModelId,
  onModelChange,
  onGenerate,
  onEnhance,
  onFileSelect,
  generating,
  generateDisabled,
  placeholder,
  showTemplatesTab,
  aspectRatio,
  onAspectRatioChange,
  duration,
  onDurationChange,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const selectedModel = models.find((m) => m.id === selectedModelId) || models[0];

  const tabs = showTemplatesTab
    ? [...mediaTabs, { id: 'templates' as MediaTab, icon: LayoutTemplate, labelKey: 'tabTemplates' }]
    : mediaTabs;

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl shadow-2xl overflow-hidden">
      <div className="flex items-start gap-3 p-4 pb-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-1 p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-purple-500/40 transition-colors shrink-0"
          title={t('uploadImage')}
        >
          <ImagePlus size={20} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*,audio/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && onFileSelect) onFileSelect(f);
            e.target.value = '';
          }}
        />
        <textarea
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder || t('searchPlaceholder')}
          rows={2}
          className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 text-base resize-none min-h-[52px]"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!generateDisabled && !generating) onGenerate();
            }
          }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-4 pt-1 border-t border-white/5">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = mediaTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onMediaTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  active
                    ? 'bg-purple-600/30 border border-purple-500/60 text-white shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                    : 'text-gray-400 hover:text-white border border-transparent'
                }`}
              >
                <Icon size={14} />
                {t(tab.labelKey)}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-200 hover:border-purple-500/40"
              onClick={() => {
                const idx = models.findIndex((m) => m.id === selectedModelId);
                const next = models[(idx + 1) % Math.max(models.length, 1)];
                if (next) onModelChange(next.id);
              }}
            >
              <Palette size={14} className="text-purple-400" />
              <span className="max-w-[120px] truncate">{selectedModel?.name || 'Model'}</span>
              <ChevronDown size={12} className="text-gray-500" />
            </button>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setSettingsOpen((o) => !o)}
              className="p-2 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white"
              title={t('settings')}
            >
              <Settings2 size={16} />
            </button>
            {settingsOpen && onAspectRatioChange && onDurationChange && (
              <div className="absolute right-0 top-full mt-2 z-30 w-56 p-3 rounded-xl bg-[#1a1828] border border-white/10 shadow-xl">
                <p className="text-[10px] text-gray-500 uppercase mb-2">{t('aspectRatio')}</p>
                <div className="flex gap-1 mb-3">
                  {(['9:16', '16:9'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => onAspectRatioChange(r)}
                      className={`flex-1 py-1.5 text-xs rounded-lg border ${
                        aspectRatio === r
                          ? 'border-purple-500 bg-purple-500/20 text-white'
                          : 'border-white/10 text-gray-400'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500 uppercase mb-2">{t('duration')}</p>
                <div className="flex gap-1">
                  {[5, 10, 15, 20].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onDurationChange(d)}
                      className={`flex-1 py-1.5 text-xs rounded-lg border ${
                        duration === d
                          ? 'border-purple-500 bg-purple-500/20 text-white'
                          : 'border-white/10 text-gray-400'
                      }`}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onEnhance}
            disabled={!onEnhance}
            className="p-2 rounded-full bg-white/5 border border-white/10 text-purple-300 hover:bg-purple-500/10 disabled:opacity-40"
            title={t('enhancePrompt')}
          >
            <Sparkles size={16} />
          </button>

          <button
            type="button"
            onClick={onGenerate}
            disabled={generateDisabled || generating}
            className="flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:opacity-40 text-white text-sm font-semibold shadow-lg shadow-purple-900/30"
          >
            <Wand2 size={16} />
            {generating ? t('creating') : t('generate')}
          </button>
        </div>
      </div>
    </div>
  );
}
