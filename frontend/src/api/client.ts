import axios from 'axios';

/** 开发(5173)走 Vite 代理；后端托管 dist(8000)走同源；Docker 等需设 VITE_API_BASE */
function resolveApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_BASE as string | undefined;
  if (fromEnv?.trim()) return fromEnv.trim().replace(/\/$/, '');
  if (import.meta.env.DEV) return '/api/v1';
  return `${window.location.origin}/api/v1`;
}

const API_BASE = resolveApiBase();

export const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 120_000,
});

export function formatApiError(err: unknown): string {
  if (!axios.isAxiosError(err)) {
    return err instanceof Error ? err.message : String(err);
  }
  if (err.code === 'ECONNABORTED') {
    return '请求超时，请确认后端已启动（端口 8000）且 Seed API 可访问';
  }
  if (!err.response) {
    return (
      `网络错误：无法连接后端 ${API_BASE}\n` +
      '请先运行 start.bat（或 start_backend.bat），浏览器访问 http://localhost:5173\n' +
      '若使用 Docker 前端，请在项目根目录 .env 设置 VITE_API_BASE=http://127.0.0.1:8000/api/v1'
    );
  }
  const data = err.response.data as { message?: string; detail?: string | { msg?: string }[] };
  if (typeof data?.message === 'string') return data.message;
  if (typeof data?.detail === 'string') return data.detail;
  if (Array.isArray(data?.detail)) {
    return data.detail.map((d) => (typeof d === 'object' && d?.msg ? d.msg : String(d))).join('; ');
  }
  return err.message || `HTTP ${err.response.status}`;
}

export async function listProjects() {
  const res = await client.get('/projects');
  return res.data.data.items;
}

export async function getProject(id: number) {
  const res = await client.get(`/projects/${id}`);
  return res.data.data;
}

export async function createProject(payload: {
  name: string;
  description?: string;
  product_info?: string;
  video_mode?: string;
  target_ratio?: string;
  target_resolution?: string;
}) {
  const res = await client.post('/projects', payload);
  return res.data.data;
}

export async function updateProject(id: number, payload: Record<string, any>) {
  const res = await client.put(`/projects/${id}`, payload);
  return res.data.data;
}

export async function uploadAsset(projectId: number, file: File, source = 'upload') {
  const form = new FormData();
  form.append('file', file);
  const res = await client.post(
    `/upload?project_id=${projectId}&source=${encodeURIComponent(source)}`,
    form,
    {
    headers: { 'Content-Type': 'multipart/form-data' },
    }
  );
  return res.data.data;
}

export async function listAssets(projectId: number, opts?: { type?: string; source?: string }) {
  const query = new URLSearchParams({ project_id: String(projectId) });
  if (opts?.type) query.set('type', opts.type);
  if (opts?.source) query.set('source', opts.source);
  const res = await client.get(`/assets?${query.toString()}`);
  return res.data.data.items;
}

export async function getComfyHealth() {
  const res = await client.get('/comfy/health');
  return res.data.data as {
    enabled: boolean;
    configured: boolean;
    reachable: boolean;
    message: string;
    editor_url: string;
  };
}

export async function executeComfyPreset(payload: {
  project_id: number;
  workflow_path: string;
  prompt?: string;
  seed?: number;
  output_kind?: 'auto' | 'image' | 'audio' | 'video';
  source?: string;
}) {
  const res = await client.post('/comfy/execute-preset', payload);
  return res.data.data as {
    prompt_id: string;
    asset_id: number;
    asset_type: string;
    asset_url: string;
    source: string;
  };
}

export async function executeComfyWorkflow(payload: {
  project_id: number;
  workflow: Record<string, any>;
  output_kind?: 'auto' | 'image' | 'audio' | 'video';
  filename?: string;
  source?: string;
}) {
  const res = await client.post('/comfy/execute', payload);
  return res.data.data as {
    prompt_id: string;
    asset_id: number;
    asset_type: string;
    asset_url: string;
    source: string;
  };
}

export async function listComfyWorkflows() {
  const res = await client.get('/comfy/workflows');
  return (res.data.data || []) as {
    name: string;
    path: string;
    category: 'image' | 'video' | 'audio' | 'unknown';
    display_name: string;
  }[];
}

export async function listResourceWorkflows() {
  const res = await client.get('/resources/workflows');
  return (res.data.data || []) as {
    id: string;
    kind: string;
    name: string;
    path: string;
    url: string;
    source: string;
  }[];
}

export async function listResourceTemplates() {
  const res = await client.get('/resources/templates');
  return (res.data.data || []) as {
    id: string;
    kind: string;
    name: string;
    path: string;
    url: string;
    source: string;
  }[];
}

export async function listResourceBgm() {
  const res = await client.get('/resources/bgm');
  return (res.data.data || []) as {
    id: string;
    kind: string;
    name: string;
    path: string;
    url: string;
    source: string;
  }[];
}

export async function listLibraryAssets(opts?: { limit?: number; type?: string; source?: string }) {
  const q = new URLSearchParams();
  if (opts?.limit) q.set('limit', String(opts.limit));
  if (opts?.type) q.set('type', opts.type);
  if (opts?.source) q.set('source', opts.source);
  const res = await client.get(`/library/assets?${q.toString()}`);
  return res.data.data.items;
}

export async function listLibraryScripts(limit = 50) {
  const res = await client.get(`/library/scripts?limit=${limit}`);
  return res.data.data.items;
}

export async function listLibraryVideos(limit = 50) {
  const res = await client.get(`/library/videos?limit=${limit}`);
  return res.data.data.items;
}

export async function getLibraryProjectsMap() {
  const res = await client.get('/library/projects-map');
  return res.data.data as Record<number, string>;
}

export async function listScripts(projectId: number) {
  const res = await client.get(`/scripts?project_id=${projectId}`);
  return res.data.data;
}

export async function generateScript(projectId: number) {
  const res = await client.post('/scripts/generate', { project_id: projectId });
  return res.data.data;
}

export async function deleteScript(scriptId: number) {
  const res = await client.delete(`/scripts/${scriptId}`);
  return res.data.data;
}

export async function listShots(scriptId: number) {
  const res = await client.get(`/shots?script_id=${scriptId}`);
  return res.data.data;
}

export async function updateShot(shotId: number, payload: Record<string, any>) {
  const res = await client.put(`/shots/${shotId}`, payload);
  return res.data.data;
}

export async function listVideos(projectId: number) {
  const res = await client.get(`/videos?project_id=${projectId}`);
  return res.data.data;
}

export async function runFullWorkflow(projectId: number, payload?: Record<string, any>) {
  const res = await client.post('/agents/run', { project_id: projectId, ...payload });
  return res.data.data;
}

export async function runScriptAgent(projectId: number) {
  const res = await client.post(`/agents/run/${projectId}/script`);
  return res.data.data;
}

export async function runVideoAgent(
  projectId: number,
  payload?: Record<string, unknown> & {
    script_id?: number;
    pipeline_preset?: string;
    target_ratio?: string;
    duration?: number;
  }
) {
  const res = await client.post(`/agents/run/${projectId}/video`, payload || {});
  return res.data.data;
}

export async function runQuickAgent(
  projectId: number,
  prompt: string,
  payload?: Record<string, any>
) {
  const res = await client.post(`/agents/run/${projectId}/quick`, {
    project_id: projectId,
    prompt,
    ...payload,
  });
  return res.data.data;
}

export async function getTaskStatus(taskId: string) {
  const res = await client.get(`/generations/${taskId}/status`);
  return res.data.data;
}

export async function getLatestTask(projectId: number) {
  const res = await client.get(`/generations/project/${projectId}/latest`);
  return res.data.data;
}

export async function cancelTask(taskId: string) {
  const res = await client.post(`/generations/${taskId}/cancel`);
  return res.data.data as { id: string; status: string };
}

export async function getTaskPayload(taskId: string) {
  const res = await client.get(`/generations/${taskId}/payload`);
  return res.data.data as {
    id: string;
    project_id?: number;
    payload?: Record<string, unknown>;
    result?: Record<string, unknown>;
  };
}

export async function getComfyWorkflowContent(path: string) {
  const res = await client.get(`/comfy/workflows/content?path=${encodeURIComponent(path)}`);
  return res.data.data as Record<string, unknown>;
}

export async function importBgmFromLibrary(
  projectId: number,
  path: string,
  sourceRoot = 'bgm'
) {
  const q = new URLSearchParams({
    project_id: String(projectId),
    path,
    source_root: sourceRoot,
  });
  const res = await client.post(`/import-bgm?${q.toString()}`);
  return res.data.data;
}

export async function enhancePrompt(text: string, opts?: { mode?: string; product_context?: string }) {
  const res = await client.post('/agents/enhance-prompt', {
    text,
    mode: opts?.mode || 'i2v',
    product_context: opts?.product_context || '',
  });
  return res.data.data as { original: string; enhanced: string; mode: string };
}

export async function getAgentCapabilities() {
  const res = await client.get('/agents/capabilities');
  return res.data.data as {
    wan_prompt_enhance: boolean;
    wan_image: boolean;
    wan_video: boolean;
    seedance: boolean;
    comfyui: boolean;
  };
}

export async function listPixellePipelines() {
  const res = await client.get('/pixelle/pipelines');
  return res.data.data as {
    pipelines: Array<{
      id: string;
      pixelle_key: string;
      name: string;
      description: string;
      media_tab: string;
      shopshot_mode: string;
      requires_comfy: boolean;
      requires_upload: boolean;
      available: boolean;
    }>;
    comfyui_enabled: boolean;
    features: Record<string, boolean>;
  };
}

export async function listModelCapabilities() {
  const res = await client.get('/resources/models');
  return (res.data.data || []) as {
    id: string;
    name: string;
    role: string;
    configured: boolean;
    endpoint_hint: string;
    notes: string;
  }[];
}

export async function listTemplateCatalog(opts?: {
  limit?: number;
  offset?: number;
  category?: string;
}) {
  const q = new URLSearchParams();
  if (opts?.limit != null) q.set('limit', String(opts.limit));
  if (opts?.offset != null) q.set('offset', String(opts.offset));
  if (opts?.category) q.set('category', opts.category);
  const res = await client.get(`/resources/template-catalog?${q.toString()}`);
  return res.data.data as {
    total: number;
    limit: number;
    offset: number;
    items: Array<Record<string, unknown>>;
    stats: {
      total: number;
      target: number;
      expanding: boolean;
      last_expanded_at?: string | null;
      videos_generated?: number;
      videos_pending?: number;
      video_gen_enabled?: boolean;
      last_video_at?: string | null;
      categories: Array<{
        id: string;
        label: string;
        count: number;
        preview_video: string;
        cover_image: string;
      }>;
    };
  };
}

// ── Studio APIs ──────────────────────────────────────────────────────────────

export async function downloadImageUrl(projectId: number, url: string) {
  const res = await client.post('/assets/download-url', { project_id: projectId, url });
  return res.data.data as import('../types').Asset;
}

export async function extractCameraStyle(projectId: number, file: File) {
  const form = new FormData();
  form.append('file', file);
  const res = await client.post(
    `/assets/extract-camera-style?project_id=${projectId}`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return res.data.data as { asset_id: number; asset_url: string; camera_style: string; filename: string };
}

export async function generateScriptFromImages(
  projectId: number,
  imageAssetIds: number[],
  productName: string,
  productDescription: string
) {
  const res = await client.post('/scripts/generate-from-images', {
    project_id: projectId,
    image_asset_ids: imageAssetIds,
    product_name: productName,
    product_description: productDescription,
  });
  return res.data.data as { script_text: string };
}

export async function generateShotPrompts(payload: {
  script_text: string;
  camera_styles: string[];
  shot_count: number;
  product_info: string;
}) {
  const res = await client.post('/shots/generate-prompts', payload);
  return res.data.data as {
    shots: Array<{ shot_id: string; image_prompt: string; action_prompt: string; words: string }>;
  };
}

export async function generateVideoFromShots(payload: {
  project_id: number;
  shots: Array<{ shot_id: string; image_prompt: string; action_prompt: string; words: string }>;
  product_asset_ids: number[];
  duration: number;
  aspect_ratio: string;
  enable_tts?: boolean;
  tts_voice?: string;
}) {
  const res = await client.post('/agents/generate-video-from-shots', payload);
  return res.data.data as import('../types').GenerationTask;
}

export async function listBgmPresets(): Promise<BgmPreset[]> {
  const res = await client.get('/assets/bgm-presets');
  return res.data.data;
}

export async function uploadBgm(projectId: number, file: File) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('project_id', String(projectId));
  const res = await client.post('/assets/bgm-upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}

export async function applyBgmPreset(projectId: number, presetId: string) {
  const res = await client.post(`/assets/bgm-from-preset?preset_id=${presetId}&project_id=${projectId}`);
  return res.data.data;
}

export interface BgmPreset {
  id: string;
  label: string;
  mood: string;
  description: string;
  filename: string;
  duration: number;
  available: boolean;
  url: string | null;
}

export async function deleteAsset(assetId: number) {
  const res = await client.delete(`/assets/${assetId}`);
  return res.data.data;
}

/** Stream script generation via SSE.
 * Calls onChunk for each text chunk received. Returns full text when done.
 */
export async function generateScriptFromImagesStream(
  payload: {
    project_id: number;
    product_name: string;
    product_description: string;
    image_asset_ids: number[];
  },
  onChunk: (text: string) => void
): Promise<string> {
  const resp = await fetch(`${API_BASE}/scripts/generate-from-images/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return fullText;
      try {
        const parsed = JSON.parse(data);
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.text) {
          fullText += parsed.text;
          onChunk(parsed.text);
        }
      } catch {
        // ignore malformed chunks
      }
    }
  }
  return fullText;
}
