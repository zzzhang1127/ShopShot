import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  RotateCcw,
  ChevronLeft,
  Zap,
  Layers,
  Smartphone,
  Monitor,
  Trash2,
  RefreshCw,
  Film,
  Image as ImageIcon,
  Video,
  Music,
} from 'lucide-react';
import {
  getProject,
  listAssets,
  uploadAsset,
  listScripts,
  listShots,
  listVideos,
  generateScript,
  runVideoAgent,
  runQuickAgent,
  getTaskStatus,
  getLatestTask,
  updateShot,
  updateProject,
  createProject,
  deleteScript,
  listResourceBgm,
  importBgmFromLibrary,
  cancelTask,
  getTaskPayload,
  listModelCapabilities,
  enhancePrompt,
  formatApiError,
} from '../api/client';
import { t, tEnum, subscribe } from '../lib/i18n';
import GenerationProgress from '../components/GenerationProgress';
import ComfyWorkflowPanel from '../components/ComfyWorkflowPanel';
import RecentGenerations from '../components/RecentGenerations';
import CliprisePromptBar from '../components/CliprisePromptBar';
import MediaLightbox, { type PreviewMedia } from '../components/MediaLightbox';
import type { Project, Asset, Script, Shot, Video as VideoType, GenerationTask } from '../types';
import { saveCustomTemplate } from '../lib/templateStore';
import { PIXELLE_PIPELINES, type PipelinePreset, type MediaTab, getPipeline } from '../lib/pixellePipelines';

type Mode = 'quick' | 'advanced';

function assetUrl(relative: string) {
  return relative.startsWith('http') ? relative : `/files/${relative}`;
}

function assetTypeFromFile(file: File): string {
  if (file.type.startsWith('image')) return 'image';
  if (file.type.startsWith('audio')) return 'audio';
  if (file.type.startsWith('video')) return 'video';
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (['mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac'].includes(ext)) return 'audio';
  if (['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(ext)) return 'video';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  return 'video';
}

function previewTypeFromAsset(a: Asset): PreviewMedia['type'] {
  if (a.type === 'audio') return 'audio';
  if (a.type === 'video') return 'video';
  return 'image';
}

function sourceLabel(source?: string): string {
  if (source === 'bgm') return t('sourceBgm');
  if (source === 'voice_clone') return t('sourceVoiceClone');
  return t('sourceUpload');
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const projectId = Number(id);
  const routeState = location.state as {
    initialDuration?: number;
    initialRatio?: string;
    activeScriptId?: number;
    pipelinePreset?: PipelinePreset;
  } | null;

  const [project, setProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [task, setTask] = useState<GenerationTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewMedia | null>(null);

  const [mode, setMode] = useState<Mode>('advanced');
  const [pipelinePreset, setPipelinePreset] = useState<PipelinePreset>('quick_create');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [duration, setDuration] = useState(20);
  const [prompt, setPrompt] = useState('');
  const [activeScriptId, setActiveScriptId] = useState<number | null>(null);
  const [langTick, setLangTick] = useState(0);
  const [bgmLibrary, setBgmLibrary] = useState<
    Array<{ id: string; name: string; path: string; source: string }>
  >([]);
  const [selectedBgmPath, setSelectedBgmPath] = useState('');
  const [selectedBgmRoot, setSelectedBgmRoot] = useState('bgm');
  const [cancelling, setCancelling] = useState(false);
  const [lastTaskId, setLastTaskId] = useState<string | null>(null);
  const [mediaTab, setMediaTab] = useState<MediaTab>('video');
  const [models, setModels] = useState<{ id: string; name: string; configured: boolean }[]>([]);
  const [selectedModelId, setSelectedModelId] = useState('seedance-video');
  const [showDeepMode, setShowDeepMode] = useState(false);

  useEffect(() => {
    const unsub = subscribe(() => setLangTick((v) => v + 1));
    return () => {
      unsub();
    };
  }, []);

  const uniqueAssets = useMemo(() => {
    const seen = new Set<string>();
    return assets.filter((a) => {
      // Deduplicate by name and type to avoid clutter
      const key = `${a.type}-${a.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [assets]);

  const assetById = useMemo(() => {
    const m = new Map<number, Asset>();
    assets.forEach((a) => m.set(a.id, a));
    return m;
  }, [assets]);

  const activeScript = scripts.find((s) => s.id === activeScriptId) ?? scripts[0] ?? null;

  const loadShotsForScript = useCallback(async (scriptId: number) => {
    const sh = await listShots(scriptId);
    setShots(sh);
  }, []);

  const load = useCallback(async () => {
    const p = await getProject(projectId);
    setProject(p);
    setAspectRatio(p.target_ratio || '9:16');
    setPrompt(p.product_info || '');
    const vm = p.video_mode || '';
    if (vm === 'quick' || vm === 'quick_create') {
      setMode('quick');
      setPipelinePreset('quick_create');
    } else if (vm === 'asset_based' || vm === 'i2v' || vm === 'action_transfer') {
      setMode('advanced');
      setPipelinePreset(vm);
    } else {
      setMode('advanced');
      setPipelinePreset('asset_based');
    }

    const [a, s, v] = await Promise.all([
      listAssets(projectId),
      listScripts(projectId),
      listVideos(projectId),
    ]);
    setAssets(a);
    setScripts(s);
    setVideos(v);

    if (s.length > 0) {
      const preferred =
        routeState?.activeScriptId && s.some((x: Script) => x.id === routeState.activeScriptId)
          ? routeState.activeScriptId
          : s[0].id;
      setActiveScriptId(preferred);
      await loadShotsForScript(preferred);
    } else {
      setActiveScriptId(null);
      setShots([]);
    }
  }, [projectId, loadShotsForScript, routeState?.activeScriptId]);

  useEffect(() => {
    if (routeState?.initialDuration) {
      setDuration(routeState.initialDuration);
    }
    if (routeState?.initialRatio) {
      setAspectRatio(routeState.initialRatio);
    }
    if (routeState?.pipelinePreset) {
      setPipelinePreset(routeState.pipelinePreset);
      if (routeState.pipelinePreset !== 'quick_create') {
        setMode('advanced');
        setShowDeepMode(true);
      }
    }
  }, [routeState?.initialDuration, routeState?.initialRatio, routeState?.pipelinePreset]);

  useEffect(() => {
    load().then(async () => {
      // Resume polling if there's an active task
      try {
        const latestTask = await getLatestTask(projectId);
        if (latestTask && (latestTask.status === 'queued' || latestTask.status === 'running')) {
          setTask(latestTask);
          setLastTaskId(latestTask.id);
        }
      } catch (err) {
        console.error('Failed to fetch latest task:', err);
      }
    });
  }, [load, projectId]);

  useEffect(() => {
    listModelCapabilities()
      .then((items) =>
        setModels(items.map((m) => ({ id: m.id, name: m.name, configured: m.configured })))
      )
      .catch(() => setModels([]));
    listResourceBgm()
      .then((items) =>
        setBgmLibrary(
          items.map((i) => ({
            id: i.id,
            name: i.name,
            path: i.path,
            source: i.source,
          }))
        )
      )
      .catch(() => setBgmLibrary([]));
  }, []);

  useEffect(() => {
    if (!task?.id) return;
    if (task.status === 'succeeded' || task.status === 'failed') {
      load().finally(() => setLoading(false));
      return;
    }
    const iv = setInterval(async () => {
      try {
        const latest = await getTaskStatus(task.id);
        setTask(latest);
      } catch {
        /* ignore */
      }
    }, 1500);
    return () => clearInterval(iv);
  }, [task?.id, task?.status, load]);

  const persistProject = async () => {
    await updateProject(projectId, {
      target_ratio: aspectRatio,
      product_info: prompt || project?.product_info,
      video_mode: mode === 'quick' ? 'quick_create' : pipelinePreset,
    });
  };

  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    source: 'upload' | 'bgm' | 'voice_clone' = 'upload'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const incomingType = assetTypeFromFile(file);
    if (
      assets.some(
        (asset) =>
          asset.name === file.name && asset.type === incomingType && (asset.source || 'upload') === source
      )
    ) {
      alert(t('assetAlreadyExists'));
      return;
    }
    setLoading(true);
    try {
      await uploadAsset(projectId, file, source);
      setAssets(await listAssets(projectId));
    } catch (err: unknown) {
      alert(`${t('loadingError')}\n\n${formatApiError(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const makeUploadHandler =
    (source: 'upload' | 'bgm' | 'voice_clone' = 'upload') =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      void handleUpload(e, source);

  const openAssetPreview = (a: Asset) => {
    setPreview({
      url: a.url,
      type: previewTypeFromAsset(a),
      title: a.name,
    });
  };

  const shotPreviewAsset = (shot: Shot): Asset | undefined => {
    const id = shot.reference_asset_id ?? shot.generated_image_asset_id;
    if (id) {
      return assetById.get(id);
    }
    // Fallback for the first shot if no reference asset is set yet
    if (shot.sequence === 0) {
      const firstUpload = uniqueAssets.find((a) => a.type === 'image' && (a.source || 'upload') === 'upload');
      if (firstUpload) {
        return firstUpload;
      }
    }
    return undefined;
  };

  const startTask = (started: GenerationTask) => {
    setTask(started);
    setLastTaskId(started.id);
    setLoading(true);
  };

  const handleCancelTask = async () => {
    if (!task?.id) return;
    setCancelling(true);
    try {
      await cancelTask(task.id);
      const latest = await getTaskStatus(task.id);
      setTask(latest);
      setLoading(false);
    } catch (err: unknown) {
      alert(formatApiError(err));
    } finally {
      setCancelling(false);
    }
  };

  const handleReuseTaskSettings = async (taskId: string) => {
    try {
      const data = await getTaskPayload(taskId);
      const p = data.payload || {};
      if (typeof p.duration === 'number') setDuration(p.duration);
      if (typeof p.target_ratio === 'string') setAspectRatio(p.target_ratio);
      if (typeof p.pipeline_preset === 'string') {
        setPipelinePreset(p.pipeline_preset as PipelinePreset);
      }
      if (typeof p.script_id === 'number') {
        setActiveScriptId(p.script_id);
        await loadShotsForScript(p.script_id);
      }
      alert(t('reuseTaskSettings'));
    } catch (err: unknown) {
      alert(formatApiError(err));
    }
  };

  const handleImportBgm = async () => {
    if (!selectedBgmPath) return;
    setLoading(true);
    try {
      await importBgmFromLibrary(projectId, selectedBgmPath, selectedBgmRoot);
      setAssets(await listAssets(projectId));
    } catch (err: unknown) {
      alert(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateScript = async () => {
    setTask(null);
    try {
      await persistProject();
      startTask(await generateScript(projectId));
    } catch (err: unknown) {
      setLoading(false);
      alert(`${t('scriptGenerationFailed')}\n\n${formatApiError(err)}`);
    }
  };

  const handleGenerateVideo = async () => {
    if (scripts.length === 0) {
      alert(t('noScript'));
      return;
    }
    setTask(null);
    try {
      await persistProject();
      if (pipelinePreset === 'asset_based') {
        const imageAssets = uniqueAssets.filter((a) => a.type === 'image' && (a.source || 'upload') === 'upload');
        if (imageAssets.length > 0) {
          for (let i = 0; i < shots.length; i += 1) {
            const shot = shots[i];
            const mapped = imageAssets[i % imageAssets.length];
            if (mapped?.id && shot.reference_asset_id !== mapped.id) {
              await updateShot(shot.id, { reference_asset_id: mapped.id });
            }
          }
          setShots((prev) =>
            prev.map((s, i) => ({
              ...s,
              reference_asset_id: imageAssets[i % imageAssets.length]?.id ?? s.reference_asset_id,
            }))
          );
        }
      }
      for (const shot of shots) {
        if (shot.duration !== duration) {
          await updateShot(shot.id, { duration });
        }
      }
      const scriptId = activeScriptId ?? scripts[0]?.id;
      if (!scriptId) {
        alert(t('noScript'));
        return;
      }
      startTask(
        await runVideoAgent(projectId, {
          script_id: scriptId,
          pipeline_preset: pipelinePreset,
          target_ratio: aspectRatio,
          duration,
        })
      );
    } catch (err: unknown) {
      setLoading(false);
      alert(`${t('videoGenerationFailed')}\n\n${formatApiError(err)}`);
    }
  };

  const handleQuickGenerate = async () => {
    setTask(null);
    try {
      await persistProject();
      startTask(
        await runQuickAgent(projectId, prompt || project?.product_info || '', {
          pipeline_preset: pipelinePreset,
          target_ratio: aspectRatio,
          duration,
        })
      );
    } catch (err: unknown) {
      setLoading(false);
      alert(`${t('videoGenerationFailed')}\n\n${formatApiError(err)}`);
    }
  };

  const handleRegenerate = async () => {
    if (mode === 'quick') {
      await handleQuickGenerate();
    } else if (scripts.length > 0) {
      await handleGenerateVideo();
    } else {
      await handleGenerateScript();
    }
  };

  const handleClearScript = async () => {
    if (!activeScriptId) return;
    if (!window.confirm(t('clearScriptConfirm'))) return;
    setLoading(true);
    try {
      await deleteScript(activeScriptId);
      await load();
    } catch (err: unknown) {
      alert(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNext = async () => {
    if (!project) return;
    setLoading(true);
    try {
      const next = await createProject({
        name: `${project.name} · ${t('createNextVideo')}`,
        description: project.description,
        product_info: prompt || project.product_info,
        video_mode: mode === 'quick' ? 'product_show' : 'story',
      });
      navigate(`/projects/${next.id}`);
    } catch (err: unknown) {
      alert(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAddVideoToTemplates = (v: VideoType) => {
    const projectName = project?.name || 'Project';
    const id = `custom-${projectId}-${v.id}`;
    const cover = v.thumbnail_url ? assetUrl(v.thumbnail_url) : assetUrl(v.url);
    const preview = assetUrl(v.url);
    saveCustomTemplate({
      id,
      title: `${projectName} #${v.id}`,
      prompt: prompt || project?.product_info || '',
      category: 'custom',
      source: 'custom',
      ratio: aspectRatio,
      duration,
      previewVideo: preview,
      coverImage: cover,
    });
    alert(t('templateSaved'));
  };

  const handleUpdateShot = async (shotId: number, field: string, value: string) => {
    await updateShot(shotId, { [field]: value });
    setShots((prev) => prev.map((s) => (s.id === shotId ? { ...s, [field]: value } : s)));
  };

  const handleReset = () => {
    setAspectRatio('9:16');
    setDuration(20);
    setMode('advanced');
    setPipelinePreset('quick_create');
  };

  const selectScript = async (scriptId: number) => {
    setActiveScriptId(scriptId);
    await loadShotsForScript(scriptId);
  };

  const promptChanged =
    Boolean(prompt.trim()) && prompt.trim() !== (project?.product_info || '').trim();

  if (!project) {
    return (
      <div className="h-screen bg-black text-white flex items-center justify-center">
        {t('loading')}
      </div>
    );
  }

  const busy = loading || (task != null && task.status !== 'succeeded' && task.status !== 'failed');

  return (
    <div className="flex h-screen bg-black text-gray-300 font-sans overflow-hidden relative" key={langTick}>
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-black" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-20 right-1/4 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px]" />
      </div>
      <MediaLightbox media={preview} onClose={() => setPreview(null)} />

      {/* 左侧：共用 — 素材 + 比例 + 时长 */}
      <aside className="relative z-10 w-[280px] bg-black/80 backdrop-blur-md border-r border-white/5 flex flex-col p-5 overflow-y-auto shrink-0">
        <Link
          to="/projects"
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors mb-6"
        >
          <ChevronLeft size={16} /> {t('backToProjects')}
        </Link>

        <div className="mb-6">
          <h2 className="text-sm font-bold text-white mb-1">{project.name}</h2>
          <div className="text-xs text-gray-500">
            {t('status')}: {t(`status_${project.status.toLowerCase()}`)}
          </div>
        </div>

        <div className="mb-6">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
            {t('projectAssets')}
          </label>
          <p className="text-[11px] text-gray-600 mb-3 leading-relaxed">{t('projectAssetsHint')}</p>
          <div className="flex gap-1.5 mb-3">
            <label
              className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg bg-white/5 border border-white/5 text-[10px] ${
                busy ? 'opacity-40 pointer-events-none' : 'hover:border-blue-500/40 cursor-pointer'
              }`}
              title={t('uploadImage')}
            >
              <ImageIcon size={14} className="text-cyan-400" />
              {t('image')}
              <input
                type="file"
                accept="image/*"
                onChange={makeUploadHandler('upload')}
                className="hidden"
                disabled={busy}
              />
            </label>
            <label
              className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg bg-white/5 border border-white/5 text-[10px] ${
                busy ? 'opacity-40 pointer-events-none' : 'hover:border-blue-500/40 cursor-pointer'
              }`}
              title={t('uploadVideo')}
            >
              <Video size={14} className="text-sky-400" />
              {t('video')}
              <input
                type="file"
                accept="video/*"
                onChange={makeUploadHandler('upload')}
                className="hidden"
                disabled={busy}
              />
            </label>
            <label
              className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg bg-white/5 border border-white/5 text-[10px] ${
                busy ? 'opacity-40 pointer-events-none' : 'hover:border-blue-500/40 cursor-pointer'
              }`}
              title={t('uploadBgm')}
            >
              <Music size={14} className="text-blue-400" />
              {t('sourceBgm')}
              <input
                type="file"
                accept="audio/*"
                onChange={makeUploadHandler('bgm')}
                className="hidden"
                disabled={busy}
              />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {uniqueAssets.map((a) => (
              <button
                key={a.id}
                type="button"
                disabled={busy}
                onClick={() => openAssetPreview(a)}
                className="relative aspect-square rounded-lg overflow-hidden bg-white/5 border border-white/5 hover:border-blue-500/60 hover:ring-2 hover:ring-blue-500/30 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                title={t('clickToPreview')}
              >
                {a.type === 'image' ? (
                  <img src={assetUrl(a.url)} alt={a.name} className="w-full h-full object-cover" />
                ) : a.type === 'audio' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-blue-400 px-1">
                    <Music size={22} />
                    <span className="text-[9px] text-gray-500 truncate w-full text-center">{a.name}</span>
                  </div>
                ) : (
                  <video src={assetUrl(a.url)} className="w-full h-full object-cover" muted />
                )}
                <span className="absolute left-1 bottom-1 text-[9px] px-1.5 py-0.5 rounded bg-black/60 text-gray-200">
                  {sourceLabel(a.source)}
                </span>
              </button>
            ))}
            {uniqueAssets.length === 0 && <div className="col-span-3 text-xs text-gray-600">{t('noAssets')}</div>}
          </div>
        </div>

        <div className="mb-6">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 block">
            {t('aspectRatio')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['9:16', '16:9'] as const).map((r) => (
              <button
                key={r}
                type="button"
                disabled={busy}
                onClick={() => setAspectRatio(r)}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs transition-all ${
                  aspectRatio === r
                    ? 'bg-blue-600/20 border-blue-500 text-white'
                    : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/20'
                }`}
              >
                {r === '9:16' ? <Smartphone size={16} /> : <Monitor size={16} />}
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
            {t('pipelinePreset')}
          </label>
          <select
            value={pipelinePreset}
            disabled={busy}
            onChange={(e) => {
              const next = e.target.value as PipelinePreset;
              setPipelinePreset(next);
              const p = getPipeline(next);
              if (p?.shopshotMode === 'quick') setMode('quick');
              else setMode('advanced');
            }}
            className="w-full mb-4 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
          >
            {PIXELLE_PIPELINES.map((p) => (
              <option key={p.id} value={p.id}>
                {t(p.nameKey)}
              </option>
            ))}
          </select>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 block">
            {t('duration')}
          </label>
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
            {[5, 10, 15, 20].map((d) => (
              <button
                key={d}
                type="button"
                disabled={busy}
                onClick={() => setDuration(d)}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                  duration === d ? 'bg-blue-600/30 text-white' : 'hover:bg-white/5'
                }`}
              >
                {d}s
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleReset}
          disabled={busy}
          className="mt-auto flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors disabled:opacity-40"
        >
          <RotateCcw size={16} /> {t('resetDefaults')}
        </button>
      </aside>

      {/* 主区域 */}
      <main className="relative z-10 flex-1 flex flex-col overflow-hidden">
        <header className="h-14 flex items-center justify-between px-6 bg-black/80 border-b border-white/5 shrink-0 backdrop-blur-md">
          <h1 className="text-base font-bold text-white">{t('aiCreation')}</h1>
          <span className="text-xs text-gray-500">{getPipeline(pipelinePreset) ? t(getPipeline(pipelinePreset)!.descKey) : ''}</span>
        </header>

        <section className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <CliprisePromptBar
              query={prompt}
              onQueryChange={setPrompt}
              onEnhance={async () => {
                if (!prompt.trim()) return;
                try {
                  const res = await enhancePrompt(prompt, {
                    mode: mediaTab === 'image' ? 'i2v' : 't2v',
                    product_context: project.product_info || '',
                  });
                  setPrompt(res.enhanced);
                } catch (err: unknown) {
                  alert(formatApiError(err));
                }
              }}
              mediaTab={mediaTab}
              onMediaTabChange={(tab) => {
                setMediaTab(tab);
                if (tab === 'video' && pipelinePreset === 'quick_create') setMode('quick');
                if (tab === 'image') {
                  setPipelinePreset('i2v');
                  setMode('advanced');
                }
              }}
              models={models}
              selectedModelId={selectedModelId}
              onModelChange={setSelectedModelId}
              onGenerate={() => {
                if (mode === 'quick') void handleQuickGenerate();
                else if (scripts.length > 0) void handleGenerateVideo();
                else void handleGenerateScript();
              }}
              onFileSelect={async (file) => {
                await uploadAsset(projectId, file, 'upload');
                setAssets(await listAssets(projectId));
              }}
              generating={busy}
              aspectRatio={aspectRatio}
              onAspectRatioChange={setAspectRatio}
              duration={duration}
              onDurationChange={setDuration}
              showTemplatesTab
              placeholder={t('enterPrompt')}
              hideGenerateButton={true}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setMode('quick');
                  setPipelinePreset('quick_create');
                  void handleQuickGenerate();
                }}
                className="px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/80 to-orange-500/80 text-white text-xs font-semibold disabled:opacity-40"
              >
                <Zap size={14} className="inline mr-1" />
                {t('modeQuickTitle')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleGenerateScript}
                className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-40"
              >
                {t('generateScriptOnly')}
              </button>
              <button
                type="button"
                disabled={busy || scripts.length === 0}
                onClick={handleGenerateVideo}
                className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-40"
              >
                {t('generateVideo')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowDeepMode((v) => !v)}
                className="px-4 py-2 rounded-full border border-white/10 text-gray-300 text-xs hover:bg-white/5"
              >
                <Layers size={14} className="inline mr-1" />
                {t('modeAdvancedTitle')}
              </button>
            </div>

            {task && (
              <GenerationProgress
                task={task}
                onCancel={handleCancelTask}
                cancelling={cancelling}
              />
            )}

            <RecentGenerations
              videos={videos}
              prompt={prompt}
              onRefresh={load}
              busy={busy}
              onPreview={(url, title) => setPreview({ url, type: 'video', title })}
            />

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3">
                {t('projectAssets')}
              </div>
              <div className="mt-2 pt-2 border-t border-white/5">
                <p className="text-[11px] text-gray-500 mb-3">{t('uploadAssetsHint')}</p>
                <div className="flex flex-wrap gap-2">
                  <label
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium transition-all ${
                      busy ? 'opacity-40 pointer-events-none' : 'hover:bg-white/10 cursor-pointer'
                    }`}
                  >
                    <ImageIcon size={14} className="text-cyan-400" />
                    {t('uploadImage')}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={makeUploadHandler('upload')}
                      className="hidden"
                      disabled={busy}
                    />
                  </label>
                  <label
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium transition-all ${
                      busy ? 'opacity-40 pointer-events-none' : 'hover:bg-white/10 cursor-pointer'
                    }`}
                  >
                    <Video size={14} className="text-sky-400" />
                    {t('uploadVideo')}
                    <input
                      type="file"
                      accept="video/*"
                      onChange={makeUploadHandler('upload')}
                      className="hidden"
                      disabled={busy}
                    />
                  </label>
                  <label
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium transition-all ${
                      busy ? 'opacity-40 pointer-events-none' : 'hover:bg-white/10 cursor-pointer'
                    }`}
                  >
                    <Music size={14} className="text-blue-400" />
                    {t('uploadBgm')}
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={makeUploadHandler('bgm')}
                      className="hidden"
                      disabled={busy}
                    />
                  </label>
                  <label
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium transition-all ${
                      busy ? 'opacity-40 pointer-events-none' : 'hover:bg-white/10 cursor-pointer'
                    }`}
                  >
                    <Music size={14} className="text-blue-400" />
                    {t('uploadVoiceClone')}
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={makeUploadHandler('voice_clone')}
                      className="hidden"
                      disabled={busy}
                    />
                  </label>
                </div>
                {bgmLibrary.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <p className="text-[11px] text-gray-500 mb-2">{t('bgmLibraryHint')}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={selectedBgmPath}
                        onChange={(e) => {
                          const path = e.target.value;
                          setSelectedBgmPath(path);
                          const item = bgmLibrary.find((b) => b.path === path);
                          if (item?.source) setSelectedBgmRoot(item.source);
                        }}
                        disabled={busy}
                        className="min-w-[200px] flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                      >
                        <option value="">{t('bgmLibrary')}</option>
                        {bgmLibrary.map((b) => (
                          <option key={b.id} value={b.path}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleImportBgm}
                        disabled={busy || !selectedBgmPath}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-40"
                      >
                        {t('importBgm')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <ComfyWorkflowPanel
              projectId={projectId}
              defaultPrompt={prompt || project?.product_info || ''}
              busy={busy}
              onComplete={async () => setAssets(await listAssets(projectId))}
            />

            {/* 深度模式：分镜编辑 */}
            {(showDeepMode || mode === 'advanced') && (
              <div className="rounded-2xl border border-blue-500/30 bg-white/5 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                    {t('modeAdvancedTitle')}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleGenerateScript}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      {busy ? t('running') : t('generateScriptOnly')}
                    </button>
                    <button
                      type="button"
                      disabled={busy || scripts.length === 0}
                      onClick={handleGenerateVideo}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      {busy ? t('running') : t('generateVideo')}
                    </button>
                    <button
                      type="button"
                      disabled={busy || !activeScriptId}
                      onClick={handleClearScript}
                      className="px-4 py-2 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 text-xs font-semibold hover:bg-red-500/25 disabled:opacity-40 flex items-center gap-1.5"
                    >
                      <Trash2 size={14} /> {t('clearScript')}
                    </button>
                  </div>
                </div>

                {promptChanged && scripts.length > 0 && (
                  <p className="text-xs text-amber-400/90">
                    {t('generateScriptOnly')} — {t('enterPrompt')}
                  </p>
                )}

                {shots.length > 0 && (
                  <>
                    <p className="text-[11px] text-gray-500">{t('storyboardHint')}</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {shots.map((shot) => {
                        const ref = shotPreviewAsset(shot);
                        return (
                          <button
                            key={shot.id}
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              if (ref) {
                                openAssetPreview(ref);
                              }
                            }}
                            className={`shrink-0 w-20 rounded-lg border overflow-hidden text-left transition-all ${
                              ref
                                ? 'border-blue-500/40 hover:ring-2 hover:ring-blue-500/50 cursor-pointer'
                                : 'border-white/10 cursor-default'
                            }`}
                          >
                            <div className="aspect-[9/16] bg-white/5 flex items-center justify-center">
                              {ref?.type === 'image' ? (
                                <img
                                  src={assetUrl(ref.url)}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : ref?.type === 'video' ? (
                                <video src={assetUrl(ref.url)} className="w-full h-full object-cover" muted />
                              ) : (
                                <span className="text-[10px] text-gray-600 px-1 text-center">
                                  {t('shotLabel').replace('{n}', String(shot.sequence + 1))}
                                </span>
                              )}
                            </div>
                            <div className="px-1 py-1 text-[10px] text-gray-400 truncate">
                              {t('shotThumb')}
                              {shot.sequence + 1}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <h3 className="text-sm font-semibold text-white">
                      {activeScript?.title || t('storyboardSection')}
                    </h3>
                    <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                      {shots.map((shot) => (
                        <div
                          key={shot.id}
                          className="p-4 rounded-xl bg-white/5 border border-white/10"
                        >
                          <div className="font-semibold text-sm text-white mb-2">
                            {t('shotLabel').replace('{n}', String(shot.sequence + 1))} ({tEnum('shotType', shot.type) || shot.type})
                          </div>
                          <div className="mb-3 text-xs text-gray-300">
                            <span className="text-gray-500">{t('words')}:</span> {shot.words || '-'}
                          </div>
                          <details className="mb-2">
                            <summary className="text-xs text-gray-500 mb-1 cursor-pointer hover:text-gray-400 outline-none">
                              {t('englishPromptHint')}
                            </summary>
                            <div className="mt-2 space-y-2 pl-2 border-l-2 border-white/10">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">{t('imagePrompt')}</label>
                                <textarea
                                  value={shot.image_prompt || ''}
                                  disabled={busy}
                                  onChange={(e) =>
                                    handleUpdateShot(shot.id, 'image_prompt', e.target.value)
                                  }
                                  rows={2}
                                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white outline-none focus:border-blue-500 resize-none disabled:opacity-60"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">{t('actionPrompt')}</label>
                                <textarea
                                  value={shot.action_prompt || ''}
                                  disabled={busy}
                                  onChange={(e) =>
                                    handleUpdateShot(shot.id, 'action_prompt', e.target.value)
                                  }
                                  rows={2}
                                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white outline-none focus:border-blue-500 resize-none disabled:opacity-60"
                                />
                              </div>
                            </div>
                          </details>
                          <div className="text-xs text-gray-500 mt-3">
                            {t('status')}: {t(`status_${shot.status.toLowerCase()}`)} | {t('duration')}: {shot.duration}
                            {t('seconds')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {scripts.length === 0 && !busy && (
                  <p className="text-sm text-gray-500">{t('noScript')}</p>
                )}
              </div>
            )}

            {loading && !task && (
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                <p className="text-sm text-gray-400">{t('generating')}…</p>
              </div>
            )}

            {/* 历史 — 共用 */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <h2 className="text-base font-bold text-white">{t('historyTitle')}</h2>
                <div className="flex flex-wrap gap-2">
                  {lastTaskId && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleReuseTaskSettings(lastTaskId)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-medium hover:bg-white/10 disabled:opacity-40"
                    >
                      <RefreshCw size={14} /> {t('reuseTaskSettings')}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleRegenerate}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-medium hover:bg-white/10 disabled:opacity-40"
                  >
                    <RefreshCw size={14} /> {t('regenerate')}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleCreateNext}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-40"
                  >
                    <Film size={14} /> {t('createNextVideo')}
                  </button>
                </div>
              </div>

              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">{t('historyVideos')}</h3>
              {videos.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  {videos.map((v) => (
                    <div key={v.id} className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <video
                        src={assetUrl(v.url)}
                        controls
                        className="w-full rounded-lg cursor-pointer"
                        onClick={() =>
                          setPreview({ url: v.url, type: 'video', title: `${t('historyVideos')} #${v.id}` })
                        }
                      />
                      <div className="text-xs text-gray-500 mt-2 flex justify-between">
                        <span>
                          {t('status')}: {t(`status_${v.status.toLowerCase()}`)}
                        </span>
                        {v.created_at && (
                          <span>
                            {t('createdAt')}: {new Date(v.created_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddVideoToTemplates(v)}
                        className="mt-2 px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs hover:bg-blue-500/25"
                      >
                        {t('addToTemplates')}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-600 mb-8">{t('noHistoryYet')}</p>
              )}

              {mode === 'advanced' && scripts.length > 0 && (
                <>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">{t('historyScripts')}</h3>
                  <div className="space-y-2">
                    {scripts.map((sc) => (
                      <button
                        key={sc.id}
                        type="button"
                        disabled={busy}
                        onClick={() => selectScript(sc.id)}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                          sc.id === activeScriptId
                            ? 'border-blue-500/50 bg-blue-500/10'
                            : 'border-white/10 bg-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="text-sm font-medium text-white">
                          {sc.title || t('untitledScript')}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {t('status')}: {t(`status_${sc.status.toLowerCase()}`)}
                          {sc.created_at && ` · ${new Date(sc.created_at).toLocaleString()}`}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
