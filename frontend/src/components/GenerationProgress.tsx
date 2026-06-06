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
  const pct = Math.min(100, Math.max(0, task.progress ?? 0));
  const status = task.status.toLowerCase();
  const running = status === 'running' || status === 'queued';
  const title =
    status === 'succeeded'
      ? t('generateSuccess')
      : status === 'failed'
        ? t('generateFailed')
        : status === 'cancelled'
          ? t('taskCancelled')
          : t('generating');

  return (
    <div className="w-full max-w-4xl mt-5 p-5 rounded-2xl bg-[#13121F] border border-blue-500/30 shadow-lg shadow-blue-500/10">
      <div className="flex items-center justify-between mb-3 gap-2">
        <span className="text-sm font-semibold text-white">{title}</span>
        <div className="flex items-center gap-2">
          {running && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={cancelling}
              className="text-xs px-2.5 py-1 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-40"
            >
              {cancelling ? t('running') : t('cancelTask')}
            </button>
          )}
          <span className="text-sm font-bold text-blue-400">{pct}%</span>
        </div>
      </div>
      <div className="h-2.5 w-full rounded-full bg-[#1C1B2B] overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            status === 'failed'
              ? 'bg-red-500'
              : status === 'succeeded'
                ? 'bg-green-500'
                : 'bg-gradient-to-r from-blue-500 to-cyan-500'
          } ${running ? 'animate-pulse' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
        <span>
          {t('task')}: <span className="text-gray-200">{t(`task_${task.type.toLowerCase()}`)}</span>
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
          {t('step')}: <span className="text-gray-200">{stepLabel(task.step)}</span>
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-3">{helperText(task)}</p>
      {task.error && (
        <p className="text-red-400 text-sm mt-3 whitespace-pre-wrap">
          {t('error')}: {formatTaskError(task.error)}
        </p>
      )}
    </div>
  );
}
