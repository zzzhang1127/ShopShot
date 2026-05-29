export interface UserTemplate {
  id: string;
  title: string;
  prompt: string;
  category: string;
  source: 'official' | 'custom';
  ratio?: string;
  duration?: number;
  previewVideo?: string;
  coverImage?: string;
  createdAt: string;
}

const STORAGE_KEY = 'shopshot_custom_templates_v1';

function safeParse(raw: string | null): UserTemplate[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function listCustomTemplates(): UserTemplate[] {
  const items = safeParse(localStorage.getItem(STORAGE_KEY));
  return items.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
}

export function saveCustomTemplate(tpl: Omit<UserTemplate, 'createdAt'>): UserTemplate {
  const all = listCustomTemplates();
  const next: UserTemplate = { ...tpl, createdAt: new Date().toISOString() };
  const dedup = all.filter((x) => x.id !== tpl.id);
  const merged = [next, ...dedup].slice(0, 50);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return next;
}

export function removeCustomTemplate(id: string): void {
  const all = listCustomTemplates().filter((x) => x.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
