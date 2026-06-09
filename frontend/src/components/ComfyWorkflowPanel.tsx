import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import {
  executeComfyPreset,
  executeComfyWorkflow,
  getComfyHealth,
  getComfyWorkflowContent,
  listComfyWorkflows,
  formatApiError,
} from '../api/client';
import { t } from '../lib/i18n';

type WorkflowItem = {
  name: string;
  path: string;
  category: 'image' | 'video' | 'audio' | 'unknown';
  display_name: string;
};

type OutputKind = 'image' | 'audio' | 'video';

function categoryToOutput(cat: WorkflowItem['category']): OutputKind {
  if (cat === 'audio') return 'audio';
  if (cat === 'video') return 'video';
  return 'image';
}

export default function ComfyWorkflowPanel({
  projectId,
  defaultPrompt,
  busy,
  onComplete,
}: {
  projectId: number;
  defaultPrompt: string;
  busy: boolean;
  onComplete: () => void | Promise<void>;
}) {
  const [status, setStatus] = useState<{
    enabled: boolean;
    configured: boolean;
    reachable: boolean;
    message: string;
    editor_url: string;
  } | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [selectedPath, setSelectedPath] = useState('');
  const [comfyPrompt, setComfyPrompt] = useState(defaultPrompt);
  const [seed, setSeed] = useState('');
  const [outputKind, setOutputKind] = useState<OutputKind>('image');
  const [running, setRunning] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [workflowJson, setWorkflowJson] = useState('');

  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setComfyPrompt(defaultPrompt);
  }, [defaultPrompt]);

  useEffect(() => {
    getComfyHealth()
      .then(setStatus)
      .catch(() =>
        setStatus({
          enabled: false,
          configured: false,
          reachable: false,
          message: 'ComfyUI status unavailable',
          editor_url: '',
        })
      );
    listComfyWorkflows()
      .then((items) => setWorkflows(items as WorkflowItem[]))
      .catch(() => setWorkflows([]));
  }, []);

  const selectedWorkflow = useMemo(
    () => workflows.find((w) => w.path === selectedPath),
    [workflows, selectedPath]
  );

  const filteredWorkflows = useMemo(() => {
    return workflows.filter((w) => {
      if (w.category === 'unknown') return true;
      return w.category === outputKind;
    });
  }, [workflows, outputKind]);

  const handleSelectWorkflow = useCallback(async (path: string) => {
    setSelectedPath(path);
    if (!path) {
      setWorkflowJson('');
      return;
    }
    const wf = workflows.find((w) => w.path === path);
    if (wf && wf.category !== 'unknown') {
      setOutputKind(categoryToOutput(wf.category));
    }
    try {
      const data = await getComfyWorkflowContent(path);
      setWorkflowJson(JSON.stringify(data, null, 2));
    } catch {
      setWorkflowJson('');
    }
  }, [workflows]);

  const handleRunPreset = async () => {
    if (!selectedPath) {
      alert(t('comfySelectPresetFirst'));
      return;
    }
    setRunning(true);
    try {
      await executeComfyPreset({
        project_id: projectId,
        workflow_path: selectedPath,
        prompt: comfyPrompt,
        seed: seed ? Number(seed) : undefined,
        output_kind: outputKind,
        source: outputKind === 'audio' ? 'voice_clone' : 'comfy_generated',
      });
      await onComplete();
      alert(t('comfyRunSuccess'));
    } catch (err: unknown) {
      alert(formatApiError(err));
    } finally {
      setRunning(false);
    }
  };

  const handleRunAdvanced = async () => {
    if (!workflowJson.trim()) {
      alert(t('comfySelectPresetFirst'));
      return;
    }
    let workflow: Record<string, unknown>;
    try {
      workflow = JSON.parse(workflowJson);
    } catch {
      alert(t('comfyJsonInvalid'));
      return;
    }
    setRunning(true);
    try {
      await executeComfyWorkflow({
        project_id: projectId,
        workflow,
        output_kind: outputKind,
        source: outputKind === 'audio' ? 'voice_clone' : 'comfy_generated',
      });
      await onComplete();
      alert(t('comfyRunSuccess'));
    } catch (err: unknown) {
      alert(formatApiError(err));
    } finally {
      setRunning(false);
    }
  };

  const disabled = busy || running;
  const canRun = status?.reachable && selectedPath;
  const editorUrl = status?.editor_url;

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          {t('comfyOptional')}
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
        <div className="flex items-center gap-2">
          {editorUrl && expanded && (
            <a
              href={editorUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-white/10 text-emerald-200 hover:bg-white/15"
            >
              <ExternalLink size={12} />
              {t('comfyOpenEditor')}
            </a>
          )}
          <span
            className={`text-[11px] px-2 py-1 rounded-full ${
              status?.reachable
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-yellow-500/20 text-yellow-200'
            }`}
          >
            {status?.reachable ? t('comfyHealthOk') : t('comfyHealthBad')}
          </span>
        </div>
      </div>

      {expanded && (
        <>
          <p className="text-xs text-gray-500 mb-3 leading-relaxed">{t('comfyOptionalHint')}</p>
          {status?.message && <p className="text-xs text-gray-400 mb-3">{status.message}</p>}

          {!status?.enabled && (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
          {t('comfySetupHint')}
        </div>
      )}

      {workflows.length === 0 && status?.enabled && (
        <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-400">
          {t('comfyNoWorkflows')}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 mb-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('comfyOutputKind')}</label>
          <select
            value={outputKind}
            onChange={(e) => setOutputKind(e.target.value as OutputKind)}
            disabled={disabled}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
          >
            <option value="image">{t('outputImage')}</option>
            <option value="audio">{t('outputAudio')}</option>
            <option value="video">{t('outputVideo')}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('comfyWorkflowPreset')}</label>
          <select
            value={selectedPath}
            onChange={(e) => handleSelectWorkflow(e.target.value)}
            disabled={disabled}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
          >
            <option value="">{t('comfySelectPreset')}</option>
            {filteredWorkflows.map((w) => (
              <option key={w.path} value={w.path}>
                {w.display_name || w.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-3">
        <label className="block text-xs text-gray-400 mb-1">{t('comfyPromptLabel')}</label>
        <textarea
          value={comfyPrompt}
          onChange={(e) => setComfyPrompt(e.target.value)}
          disabled={disabled}
          rows={3}
          placeholder={t('comfyPromptPlaceholder')}
          className="w-full bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-white placeholder-gray-600 resize-none text-xs outline-none focus:border-emerald-500/60 disabled:opacity-60"
        />
      </div>

      <div className="mb-4 max-w-xs">
        <label className="block text-xs text-gray-400 mb-1">{t('comfySeedOptional')}</label>
        <input
          type="number"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          disabled={disabled}
          placeholder="42"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300"
        >
          {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {t('comfyAdvancedJson')}
        </button>
        <button
          type="button"
          onClick={handleRunPreset}
          disabled={disabled || !canRun}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-40"
        >
          <Sparkles size={14} />
          {running ? t('generating') : t('comfyRunOneClick')}
        </button>
      </div>

      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-[11px] text-gray-500 mb-2">{t('comfyAdvancedHint')}</p>
          <textarea
            value={workflowJson}
            onChange={(e) => setWorkflowJson(e.target.value)}
            disabled={disabled}
            rows={8}
            className="w-full h-32 bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-white placeholder-gray-600 resize-none text-xs font-mono outline-none focus:border-emerald-500/60 disabled:opacity-60"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={handleRunAdvanced}
              disabled={disabled || !status?.reachable || !workflowJson.trim()}
              className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-xs text-white disabled:opacity-40"
            >
              {t('comfyRunRawJson')}
            </button>
          </div>
        </div>
      )}

      {selectedWorkflow && (
        <p className="text-[10px] text-gray-600 mt-3 truncate" title={selectedWorkflow.path}>
          {selectedWorkflow.path}
        </p>
      )}
      </>
      )}
    </div>
  );
}
