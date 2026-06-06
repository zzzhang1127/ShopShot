import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, FileText, Music } from 'lucide-react';
import {
  createProject,
  formatApiError,
  getLibraryProjectsMap,
  listLibraryAssets,
  listLibraryScripts,
  listLibraryVideos,
  listModelCapabilities,
  listTemplateCatalog,
} from '../api/client';
import { t, subscribe } from '../lib/i18n';
import { mapCatalogItem, type OfficialTemplate } from '../lib/officialTemplates';
import {
  listCustomTemplates,
  removeCustomTemplate,
  type UserTemplate,
} from '../lib/templateStore';
import type { Asset, Script, Video as VideoType } from '../types';
import MediaLightbox, { type PreviewMedia } from '../components/MediaLightbox';
import TemplatePreviewCard from '../components/TemplatePreviewCard';
import VideoThumbnail from '../components/VideoThumbnail';
import AppShell from '../components/AppShell';

type LibTab = 'assets' | 'videos' | 'audio' | 'scripts' | 'templates';

function assetUrl(relative: string) {
  if (relative.startsWith('http')) return relative;
  if (relative.startsWith('/')) return relative;
  return `/files/${relative}`;
}

export default function LibrariesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const tab: LibTab = useMemo(() => {
    if (location.pathname === '/templates') return 'templates';
    if (location.pathname === '/videos') return 'videos';
    if (location.pathname === '/audio') return 'audio';
    if (searchParams.get('tab') === 'scripts') return 'scripts';
    return 'assets';
  }, [location.pathname, searchParams]);

  const [, bumpLang] = useState(0);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [customTemplates, setCustomTemplates] = useState<UserTemplate[]>([]);
  const [officialTemplates, setOfficialTemplates] = useState<OfficialTemplate[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [projectNames, setProjectNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<PreviewMedia | null>(null);
  const [models, setModels] = useState<
    Array<{
      id: string;
      name: string;
      role: string;
      configured: boolean;
      endpoint_hint: string;
      notes: string;
    }>
  >([]);

  useEffect(() => {
    const unsub = subscribe(() => bumpLang((n) => n + 1));
    return () => {
      unsub();
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const names = await getLibraryProjectsMap();
      setProjectNames(names);

      if (tab === 'assets' || tab === 'audio') {
        const type = tab === 'audio' ? 'audio' : undefined;
        setAssets(await listLibraryAssets({ limit: 100, type }));
      }
      if (tab === 'videos') {
        setVideos(await listLibraryVideos(80));
        setAssets(await listLibraryAssets({ limit: 100, type: 'video' }));
      }
      if (tab === 'scripts') {
        setScripts(await listLibraryScripts(80));
      }
      if (tab === 'templates') {
        setCustomTemplates(listCustomTemplates());
        const page = await listTemplateCatalog({ limit: 120, offset: 0 });
        setOfficialTemplates(page.items.map((item) => mapCatalogItem(item)));
        setCatalogTotal(page.total);
      }
      if (tab === 'assets') {
        listModelCapabilities()
          .then(setModels)
          .catch(() => setModels([]));
      }
    } catch (err: unknown) {
      alert(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const tabs: { id: LibTab; label: string; path: string }[] = useMemo(
    () => [
      { id: 'assets', label: t('library'), path: '/library' },
      { id: 'videos', label: t('videos'), path: '/videos' },
      { id: 'audio', label: t('audio'), path: '/audio' },
      { id: 'scripts', label: t('script'), path: '/library?tab=scripts' },
      { id: 'templates', label: t('templates'), path: '/templates' },
    ],
    []
  );

  const switchTab = (_next: LibTab, path: string) => {
    navigate(path);
  };

  const startFromTemplate = async (tpl: OfficialTemplate | UserTemplate) => {
    try {
      const ratio = 'ratio' in tpl && tpl.ratio ? tpl.ratio : '9:16';
      const duration = tpl.duration ?? 20;
      const project = await createProject({
        name: tpl.title,
        product_info: tpl.prompt,
        video_mode: tpl.category,
        target_ratio: ratio,
      });
      navigate(`/projects/${project.id}`, {
        state: { initialDuration: duration, initialRatio: ratio },
      });
    } catch (err: unknown) {
      alert(formatApiError(err));
    }
  };

  const handleRemoveTemplate = (id: string) => {
    removeCustomTemplate(id);
    setCustomTemplates(listCustomTemplates());
  };

  const displayAssets =
    tab === 'audio'
      ? assets.filter((a) => a.type === 'audio')
      : tab === 'videos'
        ? assets.filter((a) => a.type === 'video')
        : tab === 'assets'
          ? assets
          : [];

  return (
    <AppShell title={t('libraryHubTitle')}>
      <div className="flex-1 overflow-y-auto bg-[#0B0A16] text-gray-300">
        <MediaLightbox media={preview} onClose={() => setPreview(null)} />

        <div className="flex gap-2 px-6 py-4 border-b border-white/5 overflow-x-auto">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => switchTab(item.id, item.path)}
              className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${
                tab === item.id || (item.id === 'scripts' && tab === 'scripts')
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <main className="p-6 max-w-6xl mx-auto">
        {loading && <p className="text-sm text-gray-500">{t('loading')}</p>}

        {!loading && tab === 'assets' && models.length > 0 && (
          <section className="mb-8 rounded-2xl border border-white/10 bg-[#13121F] p-5">
            <h2 className="text-sm font-bold text-white mb-1">{t('modelsTitle')}</h2>
            <p className="text-xs text-gray-500 mb-4">{t('modelsHint')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {models.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-white/10 bg-[#1C1B2B] p-4"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-semibold text-white">{m.name}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        m.configured
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {m.configured ? t('modelConfigured') : t('modelNotConfigured')}
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-300/80 mb-1">{m.role}</p>
                  {m.endpoint_hint && (
                    <p className="text-[10px] text-gray-500 truncate" title={m.endpoint_hint}>
                      {m.endpoint_hint}
                    </p>
                  )}
                  {m.notes && <p className="text-[10px] text-gray-600 mt-2">{m.notes}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && (tab === 'assets' || tab === 'videos' || tab === 'audio') && (
          <>
            <p className="text-xs text-gray-500 mb-4">{t('libraryAssetsHint')}</p>
            {displayAssets.length === 0 ? (
              <p className="text-sm text-gray-600">{t('noAssets')}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {displayAssets.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() =>
                      setPreview({
                        url: a.url,
                        type: a.type === 'audio' ? 'audio' : a.type === 'video' ? 'video' : 'image',
                        title: a.name,
                      })
                    }
                    className="text-left rounded-xl border border-white/10 bg-[#13121F] overflow-hidden hover:border-blue-500/40"
                  >
                    {a.type === 'image' && (
                      <img src={assetUrl(a.url)} alt="" className="w-full aspect-square object-cover" />
                    )}
                    {a.type === 'video' && (
                      <VideoThumbnail src={assetUrl(a.url)} />
                    )}
                    {a.type === 'audio' && (
                      <div className="aspect-square bg-[#1C1B2B] flex items-center justify-center">
                        <Music size={28} className="text-green-400" />
                      </div>
                    )}
                    <div className="p-2">
                      <div className="text-[10px] text-white truncate">{a.name}</div>
                      <div className="text-[9px] text-gray-600 truncate">
                        {a.project_id != null && projectNames[a.project_id]
                          ? projectNames[a.project_id]
                          : t('project') + ` #${a.project_id}`}
                      </div>
                      {a.project_id != null && (
                        <Link
                          to={`/projects/${a.project_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[9px] text-blue-400 hover:underline mt-1 inline-block"
                        >
                          {t('openProject')}
                        </Link>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {tab === 'videos' && videos.length > 0 && (
              <>
                <h2 className="text-sm font-semibold text-white mt-10 mb-3">{t('historyVideos')}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {videos.map((v) => (
                    <div key={v.id} className="rounded-xl border border-white/10 bg-[#13121F] overflow-hidden">
                      <button
                        type="button"
                        onClick={() =>
                          setPreview({
                            url: v.url,
                            type: 'video',
                            title:
                              v.project_id != null && projectNames[v.project_id]
                                ? projectNames[v.project_id]
                                : t('project') + ` #${v.project_id}`,
                          })
                        }
                        className="w-full text-left"
                      >
                        <VideoThumbnail src={assetUrl(v.url)} aspect="video" />
                      </button>
                      <div className="p-3">
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>
                            {v.project_id != null && projectNames[v.project_id]
                              ? projectNames[v.project_id]
                              : t('project') + ` #${v.project_id}`}
                          </span>
                          {v.created_at && <span>{new Date(v.created_at).toLocaleString()}</span>}
                        </div>
                        {v.project_id && (
                          <Link
                            to={`/projects/${v.project_id}`}
                            className="inline-block mt-2 text-xs text-blue-400 hover:underline"
                          >
                            {t('openProject')}
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {!loading && tab === 'scripts' && (
          <>
            <p className="text-xs text-gray-500 mb-4">{t('libraryScriptsHint')}</p>
            {scripts.length === 0 ? (
              <p className="text-sm text-gray-600">{t('noScript')}</p>
            ) : (
              <div className="space-y-2">
                {scripts.map((sc) => (
                  <div
                    key={sc.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl border border-white/10 bg-[#13121F]"
                  >
                    <div>
                      <div className="text-sm font-medium text-white flex items-center gap-2">
                        <FileText size={14} className="text-blue-400" />
                        {sc.title || t('untitledScript')}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {sc.project_id != null && projectNames[sc.project_id]
                          ? projectNames[sc.project_id]
                          : t('project') + ` #${sc.project_id}`}
                        {sc.created_at && ` · ${new Date(sc.created_at).toLocaleString()}`}
                      </div>
                    </div>
                    {sc.project_id && (
                      <Link
                        to={`/projects/${sc.project_id}`}
                        state={{ activeScriptId: sc.id }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500"
                      >
                        {t('openProject')}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!loading && tab === 'templates' && (
          <>
            <p className="text-xs text-gray-500 mb-4">{t('libraryTemplatesHint')}</p>
            <h2 className="text-xs font-semibold text-gray-500 uppercase mb-3">
              {t('officialTemplates')} ({catalogTotal})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
              {officialTemplates.map((tpl) => (
                <TemplatePreviewCard
                  key={tpl.id}
                  title={tpl.title}
                  coverImage={tpl.coverImage}
                  previewVideo={tpl.previewVideo}
                  duration={tpl.duration}
                  isNew={tpl.isNew}
                  onSelect={() => startFromTemplate(tpl)}
                  onPreview={() =>
                    setPreview({
                      url: tpl.previewVideo,
                      type: 'video',
                      title: tpl.title,
                      poster: tpl.coverImage,
                    })
                  }
                />
              ))}
            </div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase mb-3">{t('myTemplates')}</h2>
            {customTemplates.length === 0 ? (
              <p className="text-sm text-gray-600">{t('noMyTemplates')}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {customTemplates.map((tpl) => (
                  <TemplatePreviewCard
                    key={tpl.id}
                    title={tpl.title}
                    coverImage={tpl.coverImage}
                    previewVideo={tpl.previewVideo}
                    duration={tpl.duration}
                    onSelect={() => startFromTemplate(tpl)}
                    onPreview={() => {
                      if (tpl.previewVideo) {
                        setPreview({
                          url: tpl.previewVideo,
                          type: 'video',
                          title: tpl.title,
                          poster: tpl.coverImage,
                        });
                      } else if (tpl.coverImage) {
                        setPreview({ url: tpl.coverImage, type: 'image', title: tpl.title });
                      }
                    }}
                    onRemove={() => handleRemoveTemplate(tpl.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
      </div>
    </AppShell>
  );
}
