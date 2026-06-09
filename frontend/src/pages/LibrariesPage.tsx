import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, Music } from 'lucide-react';
import {
  createProject,
  formatApiError,
  getLibraryProjectsMap,
  listLibraryAssets,
  listLibraryScripts,
  listLibraryVideos,
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

type LibTab = 'assets' | 'videos' | 'images' | 'audio' | 'scripts' | 'templates';

function assetUrl(relative: string) {
  if (relative.startsWith('http')) return relative;
  if (relative.startsWith('/')) return relative;
  return `/files/${relative}`;
}

export default function LibrariesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tab: LibTab = useMemo(() => {
    if (searchParams.get('tab') === 'templates') return 'templates';
    if (searchParams.get('tab') === 'videos') return 'videos';
    if (searchParams.get('tab') === 'images') return 'images';
    if (searchParams.get('tab') === 'audio') return 'audio';
    if (searchParams.get('tab') === 'scripts') return 'scripts';
    return 'assets';
  }, [searchParams]);

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

      if (tab === 'assets' || tab === 'audio' || tab === 'images') {
        const type = tab === 'audio' ? 'audio' : tab === 'images' ? 'image' : undefined;
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
      { id: 'videos', label: t('videos'), path: '/library?tab=videos' },
      { id: 'images', label: t('image'), path: '/library?tab=images' },
      { id: 'audio', label: t('audio'), path: '/library?tab=audio' },
      { id: 'scripts', label: t('script'), path: '/library?tab=scripts' },
      { id: 'templates', label: t('templates'), path: '/library?tab=templates' },
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
      : tab === 'images'
        ? assets.filter((a) => a.type === 'image')
        : tab === 'videos'
          ? assets.filter((a) => a.type === 'video')
          : tab === 'assets'
            ? assets
            : [];

  return (
    <AppShell title={t('libraryHubTitle')}>
      <div className="flex-1 overflow-y-auto bg-black text-gray-300">
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


        {!loading && (tab === 'assets' || tab === 'videos' || tab === 'audio' || tab === 'images') && (
          <>
            <p className="text-xs text-gray-500 mb-4">{t('libraryAssetsHint')}</p>
            {displayAssets.length === 0 ? (
              <p className="text-sm text-gray-600">{t('noAssets')}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {displayAssets.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()).map((a) => (
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
                    className="text-left rounded-xl border border-white/10 bg-white/5 overflow-hidden hover:border-blue-500/40"
                  >
                    {a.type === 'image' && (
                      <img src={assetUrl(a.url)} alt="" className="w-full aspect-square object-cover" />
                    )}
                    {a.type === 'video' && (
                      <VideoThumbnail src={assetUrl(a.url)} />
                    )}
                    {a.type === 'audio' && (
                      <div className="aspect-square bg-white/5 flex items-center justify-center">
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
                  {videos.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()).map((v) => (
                    <div key={v.id} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
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
                {scripts.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()).map((sc) => (
                  <div
                    key={sc.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/5"
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
