import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Settings,
  Layers,
  Monitor,
  Smartphone,
  RotateCcw,
  Sparkles,
  Image as ImageIcon,
  Video,
  Music,
  LayoutTemplate,
  Zap,
  Plus,
  ChevronLeft,
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
  updateShot,
  updateProject,
} from '../api/client';
import { t, subscribe } from '../lib/i18n';
import type { Project, Asset, Script, Shot, Video as VideoType, GenerationTask } from '../types';

type Mode = 'quick' | 'advanced';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);

  // Data
  const [project, setProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [task, setTask] = useState<GenerationTask | null>(null);
  const [loading, setLoading] = useState(false);

  // UI State
  const [mode, setMode] = useState<Mode>('advanced');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [duration, setDuration] = useState(5);
  const [prompt, setPrompt] = useState('');
  const [langTick, setLangTick] = useState(0);

  // i18n subscription
  useEffect(() => {
    const unsub = subscribe(() => setLangTick((v) => v + 1));
    return () => { unsub(); };
  }, []);

  const load = useCallback(async () => {
    const p = await getProject(projectId);
    setProject(p);
    setAspectRatio(p.target_ratio || '9:16');
    setPrompt(p.product_info || '');
    const [a, s, v] = await Promise.all([
      listAssets(projectId),
      listScripts(projectId),
      listVideos(projectId),
    ]);
    setAssets(a);
    setScripts(s);
    setVideos(v);
    if (s.length > 0) {
      const sh = await listShots(s[0].id);
      setShots(sh);
      if (sh.length > 0) {
        setDuration(sh[0].duration || 5);
      }
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  // Task polling
  useEffect(() => {
    if (!task || task.status === 'succeeded' || task.status === 'failed') return;
    const iv = setInterval(async () => {
      const t = await getTaskStatus(task.id);
      setTask(t);
      if (t.status === 'succeeded' || t.status === 'failed') {
        clearInterval(iv);
        load();
      }
    }, 3000);
    return () => clearInterval(iv);
  }, [task, load]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      await uploadAsset(projectId, file);
      const a = await listAssets(projectId);
      setAssets(a);
    } catch (err: any) {
      const detail = err?.response?.data?.message || err?.response?.data?.detail || err?.message || String(err);
      alert(`${t('loadingError')}\n\n${detail}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      await updateProject(projectId, {
        target_ratio: aspectRatio,
        product_info: prompt || project?.product_info,
      });

      let t: GenerationTask;
      if (mode === 'quick') {
        t = await runQuickAgent(projectId, prompt || project?.product_info || '', {
          target_ratio: aspectRatio,
        });
      } else {
        if (scripts.length === 0) {
          t = await generateScript(projectId);
        } else {
          for (const shot of shots) {
            if (shot.duration !== duration) {
              await updateShot(shot.id, { duration });
            }
          }
          t = await runVideoAgent(projectId);
        }
      }
      setTask(t);
      await load();
    } catch (err: any) {
      const detail = err?.response?.data?.message || err?.response?.data?.detail || err?.message || String(err);
      const reqUrl = err?.config?.url || 'unknown';
      const reqMethod = err?.config?.method?.toUpperCase() || 'UNKNOWN';
      alert(`${t('scriptGenerationFailed')}\n\n${reqMethod} ${reqUrl}\n${detail}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateShot = async (shotId: number, field: string, value: string) => {
    await updateShot(shotId, { [field]: value });
    setShots((prev) => prev.map((s) => (s.id === shotId ? { ...s, [field]: value } : s)));
  };

  const handleReset = () => {
    setAspectRatio('9:16');
    setDuration(5);
    setMode('advanced');
  };

  if (!project)
    return (
      <div className="h-screen bg-[#0B0A16] text-white flex items-center justify-center">
        {t('loading')}
      </div>
    );

  const generateLabel =
    mode === 'quick'
      ? t('quickGenerate')
      : scripts.length === 0
        ? t('generateScript')
        : t('generateVideo');

  return (
    <div className="flex h-screen bg-[#0B0A16] text-gray-300 font-sans overflow-hidden" key={langTick}>
      {/* Left Sidebar */}
      <aside className="w-[300px] bg-[#13121F] border-r border-white/5 flex flex-col p-5 overflow-y-auto shrink-0">
        {/* Back link */}
        <div className="mb-6">
          <Link
            to="/projects"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors"
          >
            <ChevronLeft size={16} /> {t('backToProjects')}
          </Link>
        </div>

        {/* Project Info */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-white mb-1">{project.name}</h2>
          <div className="text-xs text-gray-500">
            {t('status')}: {project.status}
          </div>
        </div>

        {/* Assets */}
        <div className="mb-8">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 block">
            {t('assets')}
          </label>
          <div className="mb-3">
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1C1B2B] border border-white/5 text-xs font-medium cursor-pointer hover:bg-[#252438] transition-all">
              <Plus size={14} /> {t('uploadImageVideo')}
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleUpload}
                className="hidden"
              />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {assets.map((a) => (
              <div
                key={a.id}
                className="aspect-square rounded-lg overflow-hidden bg-[#1C1B2B] border border-white/5"
              >
                {a.type === 'image' ? (
                  <img
                    src={`/files/${a.url}`}
                    alt={a.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video
                    src={`/files/${a.url}`}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            ))}
            {assets.length === 0 && (
              <div className="col-span-3 text-xs text-gray-600">{t('noAssets')}</div>
            )}
          </div>
        </div>

        {/* Aspect Ratio */}
        <div className="mb-8">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 block">
            {t('aspectRatio')}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setAspectRatio('9:16')}
              className={`flex flex-col items-center gap-2 py-3 rounded-xl border transition-all ${aspectRatio === '9:16' ? 'bg-[#212036] border-indigo-500 text-white' : 'bg-[#1C1B2B] border-white/5 text-gray-500'}`}
            >
              <Smartphone size={18} />
              <span className="text-xs">9:16</span>
            </button>
            <button
              onClick={() => setAspectRatio('16:9')}
              className={`flex flex-col items-center gap-2 py-3 rounded-xl border transition-all ${aspectRatio === '16:9' ? 'bg-[#212036] border-indigo-500 text-white' : 'bg-[#1C1B2B] border-white/5 text-gray-500'}`}
            >
              <Monitor size={18} />
              <span className="text-xs">16:9</span>
            </button>
          </div>
        </div>

        {/* Duration */}
        <div className="mb-8">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 block">
            {t('duration')} (seconds)
          </label>
          <div className="flex bg-[#1C1B2B] p-1 rounded-xl border border-white/5">
            {[4, 5, 8, 10].map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${duration === d ? 'bg-[#312E4F] text-white shadow-lg' : 'hover:bg-white/5'}`}
              >
                {d}s
              </button>
            ))}
          </div>
        </div>

        {/* Reset */}
        <div className="mt-auto">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors"
          >
            <RotateCcw size={16} /> {t('resetDefaults')}
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-6 bg-[#13121F]/80 backdrop-blur-md border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              {t('aiCreation')}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-white/5 rounded-full transition-colors">
              <Settings size={18} />
            </button>
          </div>
        </header>

        {/* Creation Panel */}
        <section className="p-6 flex flex-col items-center overflow-y-auto">
          <div className="w-full max-w-4xl bg-[#13121F] rounded-3xl border border-white/10 p-6 shadow-2xl">
            {/* Mode Toggle */}
            <div className="flex bg-[#1C1B2B] p-1 rounded-xl border border-white/5 mb-4 w-fit">
              <button
                onClick={() => setMode('quick')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all ${mode === 'quick' ? 'bg-[#312E4F] text-white shadow-lg' : 'hover:bg-white/5 text-gray-500'}`}
              >
                <Zap size={14} /> {t('quickMode')}
              </button>
              <button
                onClick={() => setMode('advanced')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all ${mode === 'advanced' ? 'bg-[#312E4F] text-white shadow-lg' : 'hover:bg-white/5 text-gray-500'}`}
              >
                <Layers size={14} /> {t('advancedMode')}
              </button>
            </div>

            {/* Prompt Input */}
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('enterPrompt')}
              className="w-full h-28 bg-transparent border-none outline-none text-white placeholder-gray-600 resize-none text-base mb-4"
            />

            {/* Image Upload Zone */}
            <div className="flex gap-3 mb-6">
              <label className="w-20 h-20 bg-[#1C1B2B] rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-1 hover:border-indigo-500/50 cursor-pointer transition-all group">
                <div className="w-7 h-7 bg-pink-500/20 rounded-lg flex items-center justify-center group-hover:bg-pink-500/30">
                  <Plus size={16} className="text-pink-500" />
                </div>
                <span className="text-[10px] uppercase font-bold text-gray-500">{t('image')}</span>
                <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
              </label>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between border-t border-white/5 pt-5">
              <div className="flex gap-2">
                <button className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 hover:bg-white/10 text-xs font-medium transition-all">
                  <ImageIcon size={14} /> {t('image')}
                </button>
                <button className="flex items-center gap-2 px-3 py-2 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-medium transition-all">
                  <Video size={14} /> {t('video')}
                </button>
                <button className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 hover:bg-white/10 text-xs font-medium transition-all">
                  <Music size={14} /> {t('audio')}
                </button>
                <button className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 hover:bg-white/10 text-xs font-medium transition-all">
                  <LayoutTemplate size={14} /> {t('template')}
                </button>
              </div>

              <div className="flex gap-3">
                <button className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 hover:bg-white/10 text-xs font-medium transition-all border border-white/10">
                  <Sparkles size={14} /> {t('styles')}
                </button>
                <button className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 hover:bg-white/10 text-xs font-medium transition-all border border-white/10">
                  <Layers size={14} /> {t('productShots')}
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="bg-[#4F46E5] hover:bg-[#4338ca] text-white px-6 py-2 rounded-full font-bold shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all disabled:opacity-50 text-sm"
                >
                  {loading ? t('running') : generateLabel}
                </button>
              </div>
            </div>
          </div>

          {/* Premium Banner */}
          <div className="w-full max-w-4xl mt-5">
            <div className="bg-gradient-to-r from-indigo-500/20 via-purple-500/10 to-transparent p-[1px] rounded-2xl overflow-hidden">
              <div className="bg-[#0B0A16] px-5 py-3 flex items-center justify-between rounded-2xl">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">
                    <span className="text-indigo-400">{t('upgrade')}</span> {t('getPremium')}
                  </span>
                </div>
                <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                  <Zap size={16} className="text-indigo-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Task Progress */}
          {task && (
            <div className="w-full max-w-4xl mt-5 p-4 rounded-2xl bg-[#13121F] border border-white/10">
              <div className="flex items-center gap-3 text-sm flex-wrap">
                <span className="text-gray-400">{t('task')}:</span>{' '}
                <span className="font-medium text-white">{task.type}</span>
                <span className="text-gray-600">|</span>
                <span className="text-gray-400">{t('status')}:</span>{' '}
                <span
                  className={`font-medium ${task.status === 'failed' ? 'text-red-400' : task.status === 'succeeded' ? 'text-green-400' : 'text-yellow-400'}`}
                >
                  {task.status}
                </span>
                <span className="text-gray-600">|</span>
                <span className="text-gray-400">{t('progress')}:</span>{' '}
                <span className="font-medium text-white">{task.progress}%</span>
                <span className="text-gray-600">|</span>
                <span className="text-gray-400">{t('step')}:</span>{' '}
                <span className="font-medium text-white">{task.step || '-'}</span>
              </div>
              {task.error && (
                <div className="text-red-400 text-sm mt-2">
                  {t('error')}: {task.error}
                </div>
              )}
            </div>
          )}

          {/* Results Section */}
          <div className="w-full max-w-4xl mt-8">
            <div className="flex items-center gap-2 mb-5">
              <h2 className="text-base font-bold text-white">{t('recentGenerations')}</h2>
            </div>

            {/* Advanced Mode: Script & Shots */}
            {mode === 'advanced' && scripts.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-white mb-4">
                  {scripts[0].title || t('untitledScript')}
                </h3>
                <div className="space-y-3">
                  {shots.map((shot) => (
                    <div
                      key={shot.id}
                      className="p-4 rounded-xl bg-[#13121F] border border-white/10"
                    >
                      <div className="font-semibold text-sm text-white mb-2">
                        {shot.shot_id} ({shot.type || t('shot')})
                      </div>
                      <div className="mb-3 text-xs text-gray-300">
                        <span className="text-gray-500">{t('words')}:</span>{' '}
                        {shot.words || '-'}
                      </div>
                      <div className="mb-2">
                        <label className="block text-xs text-gray-500 mb-1">
                          {t('imagePrompt')}
                        </label>
                        <textarea
                          value={shot.image_prompt || ''}
                          onChange={(e) =>
                            handleUpdateShot(shot.id, 'image_prompt', e.target.value)
                          }
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg bg-[#1C1B2B] border border-white/10 text-sm text-white outline-none focus:border-purple-500 resize-none"
                        />
                      </div>
                      <div className="mb-2">
                        <label className="block text-xs text-gray-500 mb-1">
                          {t('actionPrompt')}
                        </label>
                        <textarea
                          value={shot.action_prompt || ''}
                          onChange={(e) =>
                            handleUpdateShot(shot.id, 'action_prompt', e.target.value)
                          }
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg bg-[#1C1B2B] border border-white/10 text-sm text-white outline-none focus:border-purple-500 resize-none"
                        />
                      </div>
                      <div className="text-xs text-gray-500">
                        {t('status')}: {shot.status} | {t('duration')}: {shot.duration}
                        {t('seconds')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Videos */}
            {videos.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {videos.map((v) => (
                  <div
                    key={v.id}
                    className="p-3 rounded-xl bg-[#13121F] border border-white/10"
                  >
                    <video
                      src={`/files/${v.url}`}
                      controls
                      className="w-full rounded-lg"
                    />
                    <div className="text-xs text-gray-500 mt-2">
                      {t('status')}: {v.status}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="aspect-video bg-[#13121F] rounded-2xl border border-white/5 flex items-center justify-center text-gray-700 text-sm animate-pulse"
                  >
                    {t('noPreview')}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
