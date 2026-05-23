import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

export const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

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

export async function runVideoAgent(projectId: number) {
  const res = await client.post(`/agents/run/${projectId}/video`);
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
