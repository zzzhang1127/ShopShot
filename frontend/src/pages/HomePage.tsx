import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Image as ImageIcon,
  Video,
  LayoutTemplate,
  ChevronRight,
  CheckCircle2,
  X,
} from 'lucide-react';
import { t, subscribe } from '../lib/i18n';
import {
  createProject,
  uploadAsset,
  enhancePrompt,
  formatApiError,
  listModelCapabilities,
  listTemplateCatalog,
  getComfyHealth,
} from '../api/client';
import { mapCatalogItem, type OfficialTemplate } from '../lib/officialTemplates';
import { listCustomTemplates, removeCustomTemplate, type UserTemplate } from '../lib/templateStore';
import {
  buildSelectableModels,
  defaultModelId,
  loadModelConfig,
} from '../lib/modelConfigStore';
import AppShell from '../components/AppShell';
import CliprisePromptBar from '../components/CliprisePromptBar';
import ModelConfigPanel from '../components/ModelConfigPanel';
import TemplatePreviewCard from '../components/TemplatePreviewCard';
import CategoryVideoStrip from '../components/CategoryVideoStrip';
import {
  categoriesFromShowcase,
  fallbackCatalogTemplates,
  mergeCategoryMedia,
  primaryCategoryShowcase,
  type CategoryChip,
} from '../lib/categoryShowcase';
import MediaLightbox, { type PreviewMedia } from '../components/MediaLightbox';
import type { MediaTab } from '../lib/pixellePipelines';
import { pipelineForMediaTab } from '../lib/pixellePipelines';

export default function HomePage() {
  const navigate = useNavigate();
  const [, forceUpdate] = useState(0);
  const [query, setQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<OfficialTemplate | UserTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [mediaTab, setMediaTab] = useState<MediaTab>('video');
  const [selectedModelId, setSelectedModelId] = useState('seedance-video');
  const [backendModels, setBackendModels] = useState<
    Array<{ id: string; name: string; role: string; configured: boolean; endpoint_hint: string; notes: string }>
  >([]);
  const [modelConfigVersion, setModelConfigVersion] = useState(0);
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [duration, setDuration] = useState(20);
  const [templateTab, setTemplateTab] = useState<'official' | 'custom'>('official');
  const [customTemplates, setCustomTemplates] = useState<UserTemplate[]>([]);
  const [catalogTemplates, setCatalogTemplates] = useState<OfficialTemplate[]>(() =>
    fallbackCatalogTemplates()
  );
  const [catalogTotal, setCatalogTotal] = useState(() => fallbackCatalogTemplates().length);
  const [catalogCategories, setCatalogCategories] = useState<CategoryChip[]>(() =>
    categoriesFromShowcase(true)
  );
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogOffline, setCatalogOffline] = useState(false);
  const CATALOG_PAGE = 56;
  const [configOpen, setConfigOpen] = useState(false);
  const [templatePreview, setTemplatePreview] = useState<PreviewMedia | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptBarRef = useRef<HTMLDivElement>(null);
  const templatesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribe(() => forceUpdate((n) => n + 1));
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    setCustomTemplates(listCustomTemplates());
    // Auto-connect ComfyUI
    getComfyHealth().catch(() => {});
  }, []);

  useEffect(() => {
    if (uploadedFile) {
      const url = URL.createObjectURL(uploadedFile);
      setUploadedFileUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setUploadedFileUrl(null);
    }
  }, [uploadedFile]);

  const loadCatalog = useCallback(async (append = false) => {
    if (templateTab !== 'official') return;
    setCatalogLoading(true);
    try {
      const offset = append ? catalogTemplates.length : 0;
      const page = await listTemplateCatalog({
        limit: CATALOG_PAGE,
        offset,
        category: categoryFilter || undefined,
      });
      const mapped = page.items.map((item) => mapCatalogItem(item));
      setCatalogTemplates((prev) => (append ? [...prev, ...mapped] : mapped));
      setCatalogTotal(page.total);
      const merged = mergeCategoryMedia(page.stats.categories);
      setCatalogCategories(merged.length > 0 ? merged : categoriesFromShowcase(true));
      setCatalogOffline(false);
    } catch {
      if (!append) {
        setCatalogOffline(true);
        const fb = fallbackCatalogTemplates();
        setCatalogTemplates(
          categoryFilter ? fb.filter((t) => t.category === categoryFilter) : fb
        );
        setCatalogTotal(fb.length);
        setCatalogCategories(categoriesFromShowcase(true));
      }
    } finally {
      setCatalogLoading(false);
    }
  }, [templateTab, catalogTemplates.length, categoryFilter]);

  useEffect(() => {
    if (templateTab === 'official') {
      void loadCatalog(false);
    }
  }, [loadCatalog, templateTab]);


  useEffect(() => {
    listModelCapabilities()
      .then(setBackendModels)
      .catch(() =>
        setBackendModels([
          {
            id: 'seed-script',
            name: 'Seed-2.0-pro (剧本)',
            role: 'script',
            configured: false,
            endpoint_hint: '',
            notes: '',
          },
          {
            id: 'seedance-video',
            name: 'Seedance-1.5-pro (视频)',
            role: 'video',
            configured: false,
            endpoint_hint: '',
            notes: '',
          },
        ])
      );
  }, [modelConfigVersion]);

  const selectableModels = useMemo(() => {
    const local = loadModelConfig();
    return buildSelectableModels(backendModels, local, mediaTab).map((m) => ({
      id: m.id,
      name: m.name,
      configured: m.configured,
    }));
  }, [backendModels, mediaTab, modelConfigVersion]);

  useEffect(() => {
    const next = defaultModelId(
      buildSelectableModels(backendModels, loadModelConfig(), mediaTab),
      mediaTab
    );
    if (next) setSelectedModelId(next);
  }, [selectableModels, mediaTab, backendModels, modelConfigVersion]);

  const allTemplates = useMemo(() => {
    if (templateTab === 'custom') return customTemplates;
    if (catalogOffline && categoryFilter) {
      return fallbackCatalogTemplates().filter((t) => t.category === categoryFilter);
    }
    return catalogTemplates;
  }, [templateTab, customTemplates, catalogTemplates, categoryFilter, catalogOffline]);

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
        ? 'prompt' in selectedTemplate
          ? selectedTemplate.prompt
          : ''
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
          selectedModelId,
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
    const promptParts = [
      'prompt' in tpl && tpl.prompt ? tpl.prompt : '',
      'hook' in tpl && tpl.hook ? `开场：${tpl.hook}` : '',
    ].filter(Boolean);
    setQuery((q) => (q.trim() ? q : promptParts[0] || tpl.title));
    setMediaTab('video');
    promptBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const openTemplatePreview = (tpl: OfficialTemplate | UserTemplate) => {
    const video = 'previewVideo' in tpl ? tpl.previewVideo : undefined;
    const cover = 'coverImage' in tpl ? tpl.coverImage : undefined;
    if (video) {
      setTemplatePreview({ url: video, type: 'video', title: tpl.title, poster: cover });
    } else if (cover) {
      setTemplatePreview({ url: cover, type: 'image', title: tpl.title });
    }
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
    { icon: LayoutTemplate, labelKey: 'shortcutTemplates', tab: 'templates' as MediaTab },
  ];

  return (
    <AppShell>
      <MediaLightbox media={templatePreview} onClose={() => setTemplatePreview(null)} />
      <ModelConfigPanel
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        onSaved={() => setModelConfigVersion((n) => n + 1)}
      />

      <main className="flex-1 relative flex flex-col overflow-y-auto">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-black" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-[120px]" />
          <div className="absolute top-20 right-1/4 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 flex flex-col items-center pt-12 px-8 w-full min-h-full">
          <h1 
            className="text-4xl md:text-6xl font-black text-center tracking-tight leading-tight mb-5 drop-shadow-2xl"
            style={{ fontFamily: "'Orbitron', 'Noto Sans SC', 'Microsoft YaHei', sans-serif", letterSpacing: '0.05em' }}
          >
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-teal-400 bg-clip-text text-transparent">
              {t('heroTitle1')}
            </span>
            <span className="text-white mx-2 md:mx-3">{t('heroTitle2')}</span>
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
              {t('heroTitle3')}
            </span>
          </h1>

          <p className="text-gray-400 text-center max-w-2xl mb-8 text-sm">{t('heroSubtitle')}</p>

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

          <div ref={promptBarRef} className="w-full max-w-4xl mb-4">
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
              models={selectableModels}
              selectedModelId={selectedModelId}
              onModelChange={setSelectedModelId}
              onGenerate={handleGenerate}
              onFileSelect={handleFileSelect}
              generating={creating}
              generateDisabled={
                !query.trim() && !selectedTemplate && !uploadedFile && mediaTab !== 'templates'
              }
              aspectRatio={aspectRatio}
              onAspectRatioChange={setAspectRatio}
              duration={duration}
              onDurationChange={setDuration}
              placeholder={mediaTab === 'image' ? t('searchPlaceholderImage') : t('searchPlaceholderVideo')}
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
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/40 hover:bg-white/10 backdrop-blur-md w-24 transition-all"
              >
                <tile.icon size={22} className="text-cyan-300" />
                <span className="text-[11px] text-gray-400">{t(tile.labelKey)}</span>
              </button>
            ))}
          </div>

          {(uploadedFile || selectedTemplate) && (
            <div className="mb-6 flex flex-wrap gap-2 justify-center">
              {uploadedFile && (
                <div className="relative group rounded-xl overflow-hidden border border-emerald-500/30 bg-black/50 backdrop-blur-md">
                  {uploadedFileUrl && uploadedFile.type.startsWith('image/') ? (
                    <img src={uploadedFileUrl} alt="preview" className="h-24 w-auto object-contain" />
                  ) : uploadedFileUrl && uploadedFile.type.startsWith('video/') ? (
                    <video src={uploadedFileUrl} className="h-24 w-auto object-contain" />
                  ) : (
                    <div className="h-24 px-4 flex items-center justify-center text-emerald-300 text-xs">
                      <CheckCircle2 size={16} className="mr-1" /> {uploadedFile.name}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setUploadedFile(null)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                  >
                    <X size={12} />
                  </button>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                    <div className="text-[10px] text-white truncate text-center px-1">{uploadedFile.name}</div>
                  </div>
                </div>
              )}
              {selectedTemplate && (
                <div className="relative group rounded-xl overflow-hidden border border-cyan-500/30 bg-black/50 backdrop-blur-md">
                  {selectedTemplate.coverImage ? (
                    <img src={selectedTemplate.coverImage} alt="preview" className="h-24 w-auto object-contain" />
                  ) : (
                    <div className="h-24 px-4 flex items-center justify-center text-cyan-300 text-xs">
                      {selectedTemplate.title}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedTemplate(null)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                  >
                    <X size={12} />
                  </button>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                    <div className="text-[10px] text-white truncate text-center px-1">{selectedTemplate.title}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div ref={templatesRef} className="w-full max-w-[1400px] pb-12 mt-8">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span className="text-white">
                    {t('trendingTemplates')}
                  </span>
                  {templateTab === 'official' && catalogTotal > 0 && (
                    <span className="text-xs font-normal text-gray-500">
                      {t('templateCatalogCount').replace('{total}', String(allTemplates.length))}
                    </span>
                  )}
                </h2>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setTemplateTab('official')}
                  className={`text-xs px-3 py-1 rounded-full border ${
                    templateTab === 'official'
                      ? 'border-blue-500 text-white bg-blue-500/20'
                      : 'border-white/20 text-gray-400'
                  }`}
                >
                  {t('officialTemplates')}
                </button>
                <button
                  onClick={() => setTemplateTab('custom')}
                  className={`text-xs px-3 py-1 rounded-full border ${
                    templateTab === 'custom'
                      ? 'border-blue-500 text-white bg-blue-500/20'
                      : 'border-white/20 text-gray-400'
                  }`}
                >
                  {t('myTemplates')}
                </button>
                <button
                  onClick={() => navigate('/templates')}
                  className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  {t('viewAll')} <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {templateTab === 'official' && catalogOffline && (
              <p className="text-xs text-amber-400/90 mb-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                {t('catalogOfflineHint')}
              </p>
            )}

            {templateTab === 'official' && (
              <CategoryVideoStrip
                categories={(() => {
                  const primaryIds = new Set(primaryCategoryShowcase().map((c) => c.id));
                  const fromApi = catalogCategories.filter((c) => primaryIds.has(c.id));
                  return fromApi.length >= 7 ? fromApi : categoriesFromShowcase(true);
                })()}
                selectedId={categoryFilter}
                onSelect={setCategoryFilter}
              />
            )}

            {catalogLoading && allTemplates.length === 0 ? (
              <div className="text-gray-500 text-sm py-10 text-center">{t('loading')}</div>
            ) : allTemplates.length === 0 ? (
              <div className="text-gray-500 text-sm py-10 text-center">
                {templateTab === 'official' ? t('noOfficialTemplates') : t('noMyTemplates')}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                  {allTemplates.map((tpl) => (
                    <TemplatePreviewCard
                      key={tpl.id}
                      title={tpl.title}
                      coverImage={'coverImage' in tpl ? tpl.coverImage : undefined}
                      previewVideo={'previewVideo' in tpl ? tpl.previewVideo : undefined}
                      duration={tpl.duration}
                      isNew={'isNew' in tpl ? Boolean((tpl as OfficialTemplate).isNew) : false}
                      selected={selectedTemplate?.id === tpl.id}
                      compact
                      onSelect={() => handleTemplateClick(tpl)}
                      onPreview={() => openTemplatePreview(tpl)}
                      onRemove={
                        'source' in tpl && tpl.source === 'custom'
                          ? () => handleRemoveCustomTemplate(tpl.id)
                          : undefined
                      }
                    />
                  ))}
                </div>
                {templateTab === 'official' && !catalogOffline && allTemplates.length < catalogTotal && (
                  <div className="flex justify-center mt-8">
                    <button
                      type="button"
                      disabled={catalogLoading}
                      onClick={() => loadCatalog(true)}
                      className="px-6 py-2 rounded-full border border-white/20 text-sm text-gray-300 hover:bg-white/5 disabled:opacity-50"
                    >
                      {catalogLoading
                        ? t('loading')
                        : t('loadMoreTemplates').replace('{loaded}', String(allTemplates.length)).replace('{total}', String(catalogTotal))}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mt-auto py-8 text-center text-gray-500 text-sm">{t('footerSlogan')}</div>
        </div>
      </main>
    </AppShell>
  );
}
