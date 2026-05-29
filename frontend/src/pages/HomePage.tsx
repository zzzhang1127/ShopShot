import { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Image as ImageIcon,
  Video,
  Music,
  LayoutTemplate,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  X,
  ArrowUpRight,
} from 'lucide-react';
import { t, subscribe } from '../lib/i18n';
import {
  createProject,
  uploadAsset,
  enhancePrompt,
  formatApiError,
  listModelCapabilities,
} from '../api/client';
import { officialTemplates, type OfficialTemplate } from '../lib/officialTemplates';
import { listCustomTemplates, removeCustomTemplate, type UserTemplate } from '../lib/templateStore';
import AppShell from '../components/AppShell';
import CliprisePromptBar from '../components/CliprisePromptBar';
import type { MediaTab } from '../lib/pixellePipelines';
import { pipelineForMediaTab } from '../lib/pixellePipelines';

type WorkbenchItem = {
  id: string;
  needKey: string;
  handler: () => void;
};

export default function HomePage() {
  const navigate = useNavigate();
  const [, forceUpdate] = useState(0);
  const [query, setQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<OfficialTemplate | UserTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [mediaTab, setMediaTab] = useState<MediaTab>('video');
  const [selectedModelId, setSelectedModelId] = useState('seedance-video');
  const [models, setModels] = useState<{ id: string; name: string; configured: boolean }[]>([]);
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [duration, setDuration] = useState(20);
  const [templateTab, setTemplateTab] = useState<'official' | 'custom'>('official');
  const [customTemplates, setCustomTemplates] = useState<UserTemplate[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    const unsub = subscribe(() => forceUpdate((n) => n + 1));
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    // Auto-play all template videos
    videoRefs.current.forEach((video) => {
      video.play().catch(() => {});
    });
  }, []);

  useEffect(() => {
    setCustomTemplates(listCustomTemplates());
  }, []);

  useEffect(() => {
    listModelCapabilities()
      .then((items) =>
        setModels(
          items.map((m) => ({ id: m.id, name: m.name, configured: m.configured }))
        )
      )
      .catch(() =>
        setModels([
          { id: 'seed-script', name: 'Seed-2.0-pro', configured: true },
          { id: 'seedance-video', name: 'Seedance-1.5-pro', configured: true },
        ])
      );
  }, []);

  const allTemplates = useMemo(() => {
    if (templateTab === 'official') return officialTemplates;
    return customTemplates;
  }, [templateTab, customTemplates]);

  const workbenchItems: WorkbenchItem[] = useMemo(
    () => [
      { id: 'ai-video', needKey: 'needGenerateVideos', handler: () => setMediaTab('video') },
      {
        id: 'image-animate',
        needKey: 'needImageThenAnimate',
        handler: () => {
          setMediaTab('image');
          fileInputRef.current?.click();
        },
      },
      {
        id: 'ai-art',
        needKey: 'needMakeAiArt',
        handler: () => navigate('/projects'),
      },
      {
        id: 'edit-asset',
        needKey: 'needEditAssets',
        handler: () => navigate('/projects'),
      },
      {
        id: 'upscale',
        needKey: 'needUpscaleAssets',
        handler: () => navigate('/projects'),
      },
      {
        id: 'models',
        needKey: 'needCompareModels',
        handler: () => navigate('/projects'),
      },
      {
        id: 'learn',
        needKey: 'needLearnWorkflow',
        handler: () =>
          window.open(
            'https://www.cliprise.app/learn',
            '_blank',
            'noopener,noreferrer'
          ),
      },
      {
        id: 'pricing',
        needKey: 'needPricingCredits',
        handler: () =>
          window.open(
            'https://www.cliprise.app/pricing',
            '_blank',
            'noopener,noreferrer'
          ),
      },
      {
        id: 'developers',
        needKey: 'needDevelopersApi',
        handler: () => window.open('/docs', '_blank', 'noopener,noreferrer'),
      },
    ],
    [navigate]
  );

  const handleGenerate = async () => {
    if (mediaTab === 'templates') {
      navigate('/templates');
      return;
    }
    if (mediaTab === 'image' && !uploadedFile) {
      alert(t('uploadToStart'));
      fileInputRef.current?.click();
      return;
    }
    if (!query.trim() && !selectedTemplate && !uploadedFile) return;
    setCreating(true);
    try {
      const tplPrompt = selectedTemplate
        ? ('prompt' in selectedTemplate ? selectedTemplate.prompt : '')
        : '';
      const mergedPrompt = [query.trim(), tplPrompt].filter(Boolean).join('；');
      const tplRatio =
        selectedTemplate && 'ratio' in selectedTemplate && selectedTemplate.ratio
          ? selectedTemplate.ratio
          : aspectRatio;
      const tplDuration = selectedTemplate?.duration ?? duration;
      const pipeline =
        uploadedFile && mediaTab !== 'audio'
          ? mediaTab === 'image'
            ? 'i2v'
            : 'asset_based'
          : pipelineForMediaTab(mediaTab);
      const project = await createProject({
        name:
          query.trim() ||
          (selectedTemplate ? selectedTemplate.title : '') ||
          t('untitledScript'),
        product_info: mergedPrompt || undefined,
        video_mode:
          selectedTemplate && 'category' in selectedTemplate
            ? selectedTemplate.category
            : 'product_show',
        target_ratio: tplRatio,
      });
      if (uploadedFile) {
        await uploadAsset(project.id, uploadedFile);
      }
      navigate(`/projects/${project.id}`, {
        state: {
          initialDuration: tplDuration,
          initialRatio: tplRatio,
          pipelinePreset: pipeline,
        },
      });
    } catch (err: unknown) {
      alert(formatApiError(err) || '创建项目失败');
    } finally {
      setCreating(false);
    }
  };

  const handleFileSelect = (file: File) => {
    setUploadedFile(file);
    if (file.type.startsWith('image')) setMediaTab('image');
    else if (file.type.startsWith('audio')) setMediaTab('audio');
    else setMediaTab('video');
  };

  const handleTemplateClick = (tpl: OfficialTemplate | UserTemplate) => {
    setSelectedTemplate(tpl);
    const title = tpl.title;
    setQuery((q) => (q.trim() ? q : title));
    setMediaTab('video');
  };

  const handleRemoveCustomTemplate = (id: string) => {
    removeCustomTemplate(id);
    setCustomTemplates(listCustomTemplates());
    if (selectedTemplate && 'source' in selectedTemplate && selectedTemplate.id === id) {
      setSelectedTemplate(null);
    }
  };

  const shortcutTiles = [
    { icon: ImageIcon, labelKey: 'shortcutImage', tab: 'image' as MediaTab },
    { icon: Video, labelKey: 'shortcutVideo', tab: 'video' as MediaTab },
    { icon: Music, labelKey: 'shortcutAudio', tab: 'audio' as MediaTab },
    { icon: LayoutTemplate, labelKey: 'shortcutTemplates', tab: 'templates' as MediaTab },
  ];

  return (
    <AppShell>
      <main className="flex-1 relative flex flex-col overflow-y-auto">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a0b2e] via-[#09090b] to-[#09090b]" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px]" />
          <div className="absolute top-20 right-1/4 w-80 h-80 bg-blue-600/15 rounded-full blur-[100px]" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center pt-20 px-8 w-full min-h-full">
          {/* Hero Title */}
          <h1
            className="text-5xl md:text-7xl font-black text-center tracking-tight leading-tight mb-4 drop-shadow-2xl"
            style={{ fontFamily: "'Impact', 'Arial Black', sans-serif" }}
          >
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
              {t('heroTitle1')}
            </span>
            <br />
            <span className="text-white">{t('heroTitle2')}</span>
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
              {t('heroTitle3')}
            </span>
          </h1>

          <p className="text-gray-400 text-center max-w-2xl mb-10 text-lg">
            {t('heroSubtitle')}
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
            }}
          />

          <div className="w-full max-w-4xl mb-4">
            <CliprisePromptBar
              query={query}
              onQueryChange={setQuery}
              onEnhance={async () => {
                if (!query.trim()) return;
                try {
                  const res = await enhancePrompt(query, {
                    mode: mediaTab === 'image' ? 'i2v' : 't2v',
                  });
                  setQuery(res.enhanced);
                } catch (err: unknown) {
                  alert(formatApiError(err));
                }
              }}
              mediaTab={mediaTab}
              onMediaTabChange={setMediaTab}
              models={models}
              selectedModelId={selectedModelId}
              onModelChange={setSelectedModelId}
              onGenerate={handleGenerate}
              onFileSelect={handleFileSelect}
              generating={creating}
              generateDisabled={!query.trim() && !selectedTemplate && !uploadedFile && mediaTab !== 'templates'}
              aspectRatio={aspectRatio}
              onAspectRatioChange={setAspectRatio}
              duration={duration}
              onDurationChange={setDuration}
              showTemplatesTab
            />
          </div>

          <div className="flex justify-center gap-4 mb-6">
            {shortcutTiles.map((tile) => (
              <button
                key={tile.tab}
                type="button"
                onClick={() => {
                  setMediaTab(tile.tab);
                  if (tile.tab === 'image') fileInputRef.current?.click();
                  if (tile.tab === 'templates') navigate('/templates');
                }}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-purple-500/40 hover:bg-white/10 backdrop-blur-md w-20 transition-all"
              >
                <tile.icon size={22} className="text-purple-300" />
                <span className="text-[11px] text-gray-400">{t(tile.labelKey)}</span>
              </button>
            ))}
          </div>

          {(uploadedFile || selectedTemplate) && (
            <div className="mb-6 flex flex-wrap gap-2 justify-center">
              {uploadedFile && (
                <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 text-xs">
                  <CheckCircle2 size={12} /> {uploadedFile.name}
                </div>
              )}
              {selectedTemplate && (
                <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-400/30 text-purple-300 text-xs">
                  {selectedTemplate.title}
                  <button type="button" onClick={() => setSelectedTemplate(null)}>
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-gray-500 text-center max-w-xl mb-8">{t('pixelleHubHint')}</p>

          {/* Cliprise-style workbench */}
          <div className="w-full max-w-5xl mb-12">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-white">{t('featureWorkbench')}</h2>
              <p className="text-xs text-gray-400 mt-1">{t('featureWorkbenchHint')}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {workbenchItems.map((item) => (
                <button
                  key={item.id}
                  onClick={item.handler}
                  className="text-left p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-indigo-400/50 transition-all"
                >
                  <div className="text-sm font-semibold text-white">{t(item.needKey)}</div>
                  <div className="mt-2 text-xs text-indigo-300 inline-flex items-center gap-1">
                    {t('goNow')} <ArrowUpRight size={12} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Templates Section */}
          <div className="w-full max-w-7xl pb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">{t('trendingTemplates')}</span>
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTemplateTab('official')}
                  className={`text-xs px-3 py-1 rounded-full border ${
                    templateTab === 'official'
                      ? 'border-indigo-500 text-white bg-indigo-500/20'
                      : 'border-white/20 text-gray-400'
                  }`}
                >
                  {t('officialTemplates')}
                </button>
                <button
                  onClick={() => setTemplateTab('custom')}
                  className={`text-xs px-3 py-1 rounded-full border ${
                    templateTab === 'custom'
                      ? 'border-indigo-500 text-white bg-indigo-500/20'
                      : 'border-white/20 text-gray-400'
                  }`}
                >
                  {t('myTemplates')}
                </button>
                <button
                  onClick={() => navigate('/projects')}
                  className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  {t('viewAll')} <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Template Cards Grid */}
            {allTemplates.length === 0 ? (
              <div className="text-gray-500 text-sm py-10 text-center">{t('noMyTemplates')}</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {allTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => handleTemplateClick(tpl)}
                  className="group relative rounded-xl overflow-hidden aspect-[3/4] cursor-pointer hover:ring-2 ring-purple-500 transition-all bg-gray-800"
                >
                  <video
                    ref={(el) => {
                      if (el) videoRefs.current.set(tpl.id, el);
                    }}
                    src={'previewVideo' in tpl ? tpl.previewVideo : ''}
                    poster={'coverImage' in tpl ? tpl.coverImage : ''}
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onLoadedData={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {'isNew' in tpl && Boolean((tpl as OfficialTemplate).isNew) && (
                    <span className="absolute top-2 left-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                      {t('templateNew')}
                    </span>
                  )}
                  {'source' in tpl && tpl.source === 'custom' && (
                    <button
                      className="absolute top-2 right-2 p-1.5 rounded bg-black/50 text-gray-200 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveCustomTemplate(tpl.id);
                      }}
                      title={t('removeTemplate')}
                    >
                      <X size={12} />
                    </button>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <h3 className="text-sm font-semibold text-white drop-shadow-md">
                      {tpl.title}
                    </h3>
                    <p className="text-[10px] text-gray-300 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {t('clickToGenerate')}
                    </p>
                  </div>

                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Sparkles size={18} className="text-white" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-auto py-8 text-center text-gray-500 text-sm">
            {t('footerSlogan')}
          </div>
        </div>
      </main>
    </AppShell>
  );
}
