import { useEffect, useState } from 'react';
import { Key, Plus, Save, Trash2, X } from 'lucide-react';
import { t } from '../lib/i18n';
import {
  loadModelConfig,
  saveModelConfig,
  type CustomModelEntry,
  type ModelConfigState,
} from '../lib/modelConfigStore';
import { listModelCapabilities } from '../api/client';

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

const emptyCustom = (): CustomModelEntry => ({
  id: `custom-${Date.now()}`,
  name: '',
  role: 'video',
  provider: 'volc',
  apiKey: '',
  endpoint: '',
  enabled: true,
});

export default function ModelConfigPanel({ open, onClose, onSaved }: Props) {
  const [state, setState] = useState<ModelConfigState>(() => loadModelConfig());
  const [backendModels, setBackendModels] = useState<
    Array<{ id: string; name: string; configured: boolean; endpoint_hint: string }>
  >([]);

  useEffect(() => {
    if (!open) return;
    setState(loadModelConfig());
    listModelCapabilities()
      .then((items) =>
        setBackendModels(
          items.map((m) => ({
            id: m.id,
            name: m.name,
            configured: m.configured,
            endpoint_hint: m.endpoint_hint,
          }))
        )
      )
      .catch(() => setBackendModels([]));
  }, [open]);

  if (!open) return null;

  const handleSave = () => {
    saveModelConfig(state);
    onSaved?.();
    onClose();
  };

  const updateCustom = (idx: number, patch: Partial<CustomModelEntry>) => {
    setState((s) => {
      const next = [...s.customModels];
      next[idx] = { ...next[idx], ...patch };
      return { ...s, customModels: next };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-black shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-white/10 bg-black">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Key size={18} className="text-cyan-400" />
              {t('modelSettings')}
            </h2>
            <p className="text-xs text-gray-500 mt-1">{t('modelSettingsHint')}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">{t('volcCredentials')}</h3>
            <div className="grid gap-3">
              <label className="block">
                <span className="text-[11px] text-gray-500">VOLC_API_KEY</span>
                <input
                  type="password"
                  value={state.volcApiKey}
                  onChange={(e) => setState((s) => ({ ...s, volcApiKey: e.target.value }))}
                  placeholder="ark-..."
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm text-white"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-gray-500">DOUBAO_SEED_EP（剧本）</span>
                <input
                  value={state.seedEp}
                  onChange={(e) => setState((s) => ({ ...s, seedEp: e.target.value }))}
                  placeholder="ep-..."
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm text-white font-mono"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-gray-500">DOUBAO_SEEDANCE_EP（视频，默认 Seedance-1.5-pro）</span>
                <input
                  value={state.seedanceEp}
                  onChange={(e) => setState((s) => ({ ...s, seedanceEp: e.target.value }))}
                  placeholder="ep-..."
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm text-white font-mono"
                />
              </label>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">{t('optionalCredentials')}</h3>
            <div className="grid gap-3">
              <label className="block">
                <span className="text-[11px] text-gray-500">DASHSCOPE_API_KEY（Wan 生图/视频）</span>
                <input
                  type="password"
                  value={state.dashscopeApiKey}
                  onChange={(e) => setState((s) => ({ ...s, dashscopeApiKey: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm text-white"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-gray-500">COMFYUI_URL</span>
                <input
                  value={state.comfyUrl}
                  onChange={(e) => setState((s) => ({ ...s, comfyUrl: e.target.value }))}
                  placeholder="http://127.0.0.1:8188"
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm text-white"
                />
              </label>
            </div>
          </section>

          {backendModels.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">{t('serverConfiguredModels')}</h3>
              <div className="space-y-2">
                {backendModels.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/30 border border-white/5 text-xs"
                  >
                    <span className="text-white">{m.name}</span>
                    <span
                      className={
                        m.configured ? 'text-emerald-400' : 'text-gray-500'
                      }
                    >
                      {m.configured ? t('modelConfigured') : t('modelNotConfigured')}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase">{t('customModels')}</h3>
              <button
                type="button"
                onClick={() =>
                  setState((s) => ({ ...s, customModels: [...s.customModels, emptyCustom()] }))
                }
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
              >
                <Plus size={14} /> {t('addCustomModel')}
              </button>
            </div>
            {state.customModels.length === 0 ? (
              <p className="text-xs text-gray-600">{t('noCustomModels')}</p>
            ) : (
              <div className="space-y-3">
                {state.customModels.map((cm, idx) => (
                  <div key={cm.id} className="p-3 rounded-xl border border-white/10 bg-black/20 space-y-2">
                    <div className="flex gap-2">
                      <input
                        value={cm.name}
                        onChange={(e) => updateCustom(idx, { name: e.target.value })}
                        placeholder={t('modelDisplayName')}
                        className="flex-1 px-2 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white"
                      />
                      <select
                        value={cm.role}
                        onChange={(e) =>
                          updateCustom(idx, { role: e.target.value as CustomModelEntry['role'] })
                        }
                        className="px-2 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white"
                      >
                        <option value="video">{t('video')}</option>
                        <option value="image">{t('image')}</option>
                        <option value="script">{t('script')}</option>
                        <option value="audio">{t('audio')}</option>
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          setState((s) => ({
                            ...s,
                            customModels: s.customModels.filter((_, i) => i !== idx),
                          }))
                        }
                        className="p-1.5 text-red-400 hover:bg-red-500/10 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <input
                      value={cm.endpoint}
                      onChange={(e) => updateCustom(idx, { endpoint: e.target.value })}
                      placeholder="EP / Model ID"
                      className="w-full px-2 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white font-mono"
                    />
                    <input
                      type="password"
                      value={cm.apiKey}
                      onChange={(e) => updateCustom(idx, { apiKey: e.target.value })}
                      placeholder="API Key"
                      className="w-full px-2 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white"
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          <p className="text-[11px] text-amber-500/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            {t('modelSettingsEnvNote')}
          </p>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 px-5 py-4 border-t border-white/10 bg-black">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-white/10 text-gray-400 hover:text-white"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-500"
          >
            <Save size={16} /> {t('saveSettings')}
          </button>
        </div>
      </div>
    </div>
  );
}
