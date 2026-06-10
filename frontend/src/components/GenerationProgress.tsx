import { useEffect, useState } from 'react';
import { t } from '../lib/i18n';
import type { GenerationTask } from '../types';

function stepLabel(step: string | undefined): string {
  if (!step) return '-';
  const shot = step.match(/^video_shot_(\d+)_of_(\d+)$/);
  if (shot) return t('step_video_shot').replace('{current}', shot[1]).replace('{total}', shot[2]);

  const shotSeedance = step.match(/^video_shot_(\d+)_seedance_(.+)$/);
  if (shotSeedance) {
    return `${t('step_video_shot_prefix').replace('{current}', shotSeedance[1])} · ${stepLabel(`seedance_${shotSeedance[2]}`)}`;
  }

  const shotDone = step.match(/^video_shot_(\d+)_done$/);
  if (shotDone) return t('step_video_shot_done').replace('{current}', shotDone[1]);

  const key = `step_${step}`;
  const translated = t(key);
  return translated !== key ? translated : step;
}

function statusLabel(status: string): string {
  const key = `status_${status.toLowerCase()}`;
  const translated = t(key);
  return translated !== key ? translated : status;
}

function formatTaskError(error: string | undefined): string {
  if (!error) return '';
  if (
    error.includes('RPM') ||
    error.includes('RateLimit') ||
    error.includes('429') ||
    error.includes('请求过于频繁') ||
    error.includes('RPM 超限')
  ) {
    return t('errorRateLimit');
  }
  return error.length > 500 ? `${error.slice(0, 500)}…` : error;
}

function helperText(task: GenerationTask): string {
  const status = task.status.toLowerCase();
  if (status === 'queued') return t('progressQueuedHint');
  if (status === 'failed') {
    const err = task.error || '';
    if (err.includes('RPM') || err.includes('RateLimit') || err.includes('429')) {
      return t('progressRateLimitHint');
    }
    return t('progressFailedHint');
  }
  if (status === 'succeeded') return t('progressSucceededHint');
  if (status === 'cancelled') return t('taskCancelled');
  const step = task.step || '';
  if (step.includes('script')) return t('progressScriptHint');
  if (step.includes('rate_limit')) return t('progressRateLimitRetryHint');
  if (step.includes('seedance') || step.includes('video')) return t('progressVideoHint');
  if (step.includes('postprocess') || step.includes('download')) return t('progressPostprocessHint');
  return t('progressBusyHint');
}

export default function GenerationProgress({
  task,
  onCancel,
  cancelling,
}: {
  task: GenerationTask;
  onCancel?: () => void;
  cancelling?: boolean;
}) {
  const realPct = Math.min(100, Math.max(0, task.progress ?? 0));
  const status = task.status.toLowerCase();
  const running = status === 'running' || status === 'queued';

  // Smooth display progress: interpolates up toward realPct, adds a small
  // auto-increment so the bar always looks alive during long polling gaps.
  const [displayPct, setDisplayPct] = useState(realPct);

  useEffect(() => {
    setDisplayPct((prev) => {
      // Jump up if real value is ahead
      if (realPct > prev) return realPct;
      return prev;
    });
  }, [realPct]);

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      setDisplayPct((prev) => {
        const target = realPct;
        // Slowly creep toward target + a small cushion to keep it alive
        const cushion = Math.min(target + 3, 99);
        if (prev >= cushion) return prev;
        return prev + 0.4;
      });
    }, 500);
    return () => clearInterval(iv);
  }, [running, realPct]);

  const pct = Math.round(displayPct);

  const title =
    status === 'succeeded'
      ? t('generateSuccess')
      : status === 'failed'
        ? t('generateFailed')
        : status === 'cancelled'
          ? t('taskCancelled')
          : t('generating');

  return (
    <div className="w-full px-4 py-2.5 bg-gray-950/95 border-b border-blue-500/20 backdrop-blur-sm">
      <div className="max-w-3xl mx-auto">
        {/* top row */}
        <div className="flex items-center gap-3 mb-1.5">
          <span className="text-xs font-semibold text-white shrink-0">{title}</span>
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                status === 'failed'
                  ? 'bg-red-500'
                  : status === 'succeeded'
                    ? 'bg-green-500'
                    : 'bg-gradient-to-r from-blue-500 to-cyan-400'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-bold text-blue-400 shrink-0 tabular-nums">{pct}%</span>
          {running && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={cancelling}
              className="text-[10px] px-2 py-0.5 rounded border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-40 shrink-0"
            >
              {cancelling ? t('running') : t('cancelTask')}
            </button>
          )}
        </div>
        {/* detail row */}
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-gray-500">
          <span>
            {t('task')}: <span className="text-gray-300">{t(`task_${(task.type || 'unknown').toLowerCase()}`)}</span>
          </span>
          <span>
            {t('status')}:{' '}
            <span
              className={
                status === 'failed'
                  ? 'text-red-400'
                  : status === 'succeeded'
                    ? 'text-green-400'
                    : 'text-yellow-400'
              }
            >
              {statusLabel(task.status)}
            </span>
          </span>
          <span>
            {t('step')}: <span className="text-gray-300">{stepLabel(task.step)}</span>
          </span>
          <span className="text-gray-600">{helperText(task)}</span>
        </div>
        {task.error && (
          <p className="text-red-400 text-xs mt-1 truncate">
            {t('error')}: {formatTaskError(task.error)}
          </p>
        )}
      </div>
    </div>
  );
}
