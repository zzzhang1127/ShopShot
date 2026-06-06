/** 前端保存的 API / EP 备忘（实际调用仍以服务端 .env 为准） */

export type ModelRole = 'script' | 'video' | 'image' | 'audio' | 'prompt' | 'image_audio';

export interface CustomModelEntry {
  id: string;
  name: string;
  role: ModelRole;
  provider: 'volc' | 'dashscope' | 'comfy' | 'custom';
  apiKey: string;
  endpoint: string;
  enabled: boolean;
}

export interface ModelConfigState {
  volcApiKey: string;
  seedEp: string;
  seedanceEp: string;
  dashscopeApiKey: string;
  comfyUrl: string;
  customModels: CustomModelEntry[];
}

const STORAGE_KEY = 'shopshot_model_config_v1';

const defaults: ModelConfigState = {
  volcApiKey: '',
  seedEp: '',
  seedanceEp: '',
  dashscopeApiKey: '',
  comfyUrl: '',
  customModels: [],
};

function safeParse(raw: string | null): ModelConfigState {
  if (!raw) return { ...defaults, customModels: [] };
  try {
    const p = JSON.parse(raw) as Partial<ModelConfigState>;
    return {
      volcApiKey: p.volcApiKey || '',
      seedEp: p.seedEp || '',
      seedanceEp: p.seedanceEp || '',
      dashscopeApiKey: p.dashscopeApiKey || '',
      comfyUrl: p.comfyUrl || '',
      customModels: Array.isArray(p.customModels) ? p.customModels : [],
    };
  } catch {
    return { ...defaults, customModels: [] };
  }
}

export function loadModelConfig(): ModelConfigState {
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

export function saveModelConfig(state: ModelConfigState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export interface BackendModel {
  id: string;
  name: string;
  role: string;
  configured: boolean;
  endpoint_hint: string;
  notes: string;
}

export interface SelectableModel {
  id: string;
  name: string;
  configured: boolean;
  role: string;
  source: 'backend' | 'local';
}

function localConfigured(state: ModelConfigState, id: string): boolean {
  switch (id) {
    case 'seed-script':
      return Boolean(state.volcApiKey.trim() && state.seedEp.trim());
    case 'seedance-video':
      return Boolean(state.volcApiKey.trim() && state.seedanceEp.trim());
    case 'wan-image':
    case 'wan-video':
      return Boolean(state.dashscopeApiKey.trim());
    case 'comfyui':
      return Boolean(state.comfyUrl.trim());
    default:
      return state.customModels.some((m) => m.id === id && m.enabled && m.apiKey.trim());
  }
}

/** 合并后端能力与本地粘贴的配置，用于创作页模型下拉 */
export function buildSelectableModels(
  backend: BackendModel[],
  state: ModelConfigState,
  mediaTab: 'image' | 'video' | 'audio' | 'templates'
): SelectableModel[] {
  const roleFilter: Record<string, string[]> = {
    video: ['video', 'script'],
    image: ['image', 'image_audio'],
    audio: ['audio', 'image_audio'],
    templates: ['video', 'script'],
  };
  const allowed = roleFilter[mediaTab] || ['video'];

  const merged: SelectableModel[] = backend
    .filter((m) => allowed.includes(m.role))
    .map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      configured: m.configured || localConfigured(state, m.id),
      source: m.configured ? ('backend' as const) : localConfigured(state, m.id) ? ('local' as const) : ('backend' as const),
    }))
    .filter((m) => m.configured);

  for (const cm of state.customModels) {
    if (!cm.enabled || !cm.apiKey.trim()) continue;
    if (!allowed.includes(cm.role)) continue;
    if (merged.some((m) => m.id === cm.id)) continue;
    merged.push({
      id: cm.id,
      name: cm.name,
      role: cm.role,
      configured: true,
      source: 'local',
    });
  }

  return merged;
}

export function defaultModelId(models: SelectableModel[], mediaTab: string): string {
  if (models.length === 0) return '';
  if (mediaTab === 'video' || mediaTab === 'templates') {
    const seedance = models.find((m) => m.id === 'seedance-video');
    if (seedance) return seedance.id;
  }
  return models[0].id;
}
