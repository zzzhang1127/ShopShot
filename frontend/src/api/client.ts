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
}) {
  const res = await client.post('/projects', payload);
  return res.data.data;
}

export async function updateProject(id: number, payload: Record<string, any>) {
  const res = await client.put(`/projects/${id}`, payload);
  return res.data.data;
}

export async function uploadAsset(projectId: number, file: File) {
  const form = new FormData();
  form.append('file', file);
  const res = await client.post(`/upload?project_id=${projectId}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}

export async function listAssets(projectId: number) {
  const res = await client.get(`/assets?project_id=${projectId}`);
  return res.data.data.items;
}

export async function listScripts(projectId: number) {
  const res = await client.get(`/scripts?project_id=${projectId}`);
  return res.data.data;
}

export async function generateScript(projectId: number) {
  const res = await client.post('/scripts/generate', { project_id: projectId });
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

export async function runVideoAgent(projectId: number, payload?: Record<string, any>) {
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
