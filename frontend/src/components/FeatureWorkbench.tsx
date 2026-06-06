import {
  BookOpen,
  Clapperboard,
  ImageIcon,
  Key,
  Layers,
  Maximize2,
  Pencil,
  Sparkles,
  Video,
  Wallet,
  Wand2,
} from 'lucide-react';
import { t } from '../lib/i18n';

export type WorkbenchAction =
  | 'video'
  | 'image-animate'
  | 'ai-art'
  | 'edit-asset'
  | 'upscale'
  | 'compare-models'
  | 'learn'
  | 'pricing'
  | 'api-config';

type Item = {
  id: WorkbenchAction;
  icon: typeof Video;
  titleKey: string;
  descKey: string;
};

const items: Item[] = [
  { id: 'video', icon: Clapperboard, titleKey: 'needGenerateVideos', descKey: 'wbDescVideo' },
  { id: 'image-animate', icon: ImageIcon, titleKey: 'needImageThenAnimate', descKey: 'wbDescImageAnimate' },
  { id: 'ai-art', icon: Wand2, titleKey: 'needMakeAiArt', descKey: 'wbDescAiArt' },
  { id: 'edit-asset', icon: Pencil, titleKey: 'needEditAssets', descKey: 'wbDescEdit' },
  { id: 'upscale', icon: Maximize2, titleKey: 'needUpscaleAssets', descKey: 'wbDescUpscale' },
  { id: 'compare-models', icon: Layers, titleKey: 'needCompareModels', descKey: 'wbDescCompare' },
  { id: 'learn', icon: BookOpen, titleKey: 'needLearnWorkflow', descKey: 'wbDescLearn' },
  { id: 'pricing', icon: Wallet, titleKey: 'needPricingCredits', descKey: 'wbDescPricing' },
  { id: 'api-config', icon: Key, titleKey: 'needDevelopersApi', descKey: 'wbDescApi' },
];

type Props = {
  onAction: (action: WorkbenchAction) => void;
  activePanel?: WorkbenchAction | null;
};

export default function FeatureWorkbench({ onAction, activePanel }: Props) {
  return (
    <div className="w-full max-w-5xl mb-12">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Sparkles size={18} className="text-cyan-400" />
          {t('featureWorkbench')}
        </h2>
        <p className="text-xs text-gray-400 mt-1">{t('featureWorkbenchHintInternal')}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activePanel === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onAction(item.id)}
              className={`text-left p-4 rounded-xl border transition-all ${
                active
                  ? 'border-cyan-500/60 bg-cyan-500/10'
                  : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-blue-400/40'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-white/5 shrink-0">
                  <Icon size={18} className="text-blue-300" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{t(item.titleKey)}</div>
                  <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{t(item.descKey)}</p>
                  <span className="inline-block mt-2 text-[10px] text-blue-300">{t('openInApp')}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
