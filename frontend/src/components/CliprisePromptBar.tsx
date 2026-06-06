import { useRef, useState } from 'react';
import {
  Image as ImageIcon,
  Video,
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
  hideGenerateButton?: boolean;
};

const mediaTabs: { id: MediaTab; icon: typeof ImageIcon; labelKey: string }[] = [
  { id: 'image', icon: ImageIcon, labelKey: 'tabImage' },
  { id: 'video', icon: Video, labelKey: 'tabVideo' },
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
  hideGenerateButton,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const configuredModels = models.filter((m) => m.configured);
  const selectableModels = configuredModels.length > 0 ? configuredModels : models;
  const selectedModel =
    selectableModels.find((m) => m.id === selectedModelId) || selectableModels[0];

  const tabs = showTemplatesTab
    ? [...mediaTabs, { id: 'templates' as MediaTab, icon: LayoutTemplate, labelKey: 'tabTemplates' }]
    : mediaTabs;

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl overflow-hidden">
      <div className="flex items-start gap-3 p-4 pb-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-1 p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-cyan-500/40 transition-colors shrink-0"
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
          className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 text-base resize-y min-h-[80px]"
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
                    ? 'bg-cyan-600/30 border border-cyan-500/60 text-white shadow-[0_0_12px_rgba(34,211,238,0.25)]'
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
            <Palette size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400 pointer-events-none z-10" />
            <select
              value={selectedModel?.id || ''}
              onChange={(e) => onModelChange(e.target.value)}
              disabled={selectableModels.length === 0}
              className="appearance-none pl-8 pr-8 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-200 hover:border-cyan-500/40 max-w-[200px] truncate cursor-pointer disabled:opacity-50"
              title={t('selectModel')}
            >
              {selectableModels.length === 0 ? (
                <option value="">{t('noModelsConfigured')}</option>
              ) : (
                selectableModels.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#1a1828] text-white">
                    {m.name}
                  </option>
                ))
              )}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
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
                          ? 'border-cyan-500 bg-cyan-500/20 text-white'
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
                          ? 'border-cyan-500 bg-cyan-500/20 text-white'
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
            className="p-2 rounded-full bg-white/5 border border-white/10 text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-40"
            title={t('enhancePrompt')}
          >
            <Sparkles size={16} />
          </button>

          {!hideGenerateButton && (
            <button
              type="button"
              onClick={onGenerate}
              disabled={generateDisabled || generating}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-sm font-semibold shadow-lg shadow-cyan-900/30"
            >
              <Wand2 size={16} />
              {generating ? t('creating') : t('generate')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
