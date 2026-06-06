/** 带货模板类型（与后端 catalog 对齐） */
export interface OfficialTemplate {
  id: string;
  title: string;
  previewVideo: string;
  coverImage: string;
  isNew?: boolean;
  category: string;
  category_label?: string;
  prompt: string;
  hook?: string;
  selling_points?: string[];
  shot_plan?: string[];
  cta?: string;
  duration?: number;
  ratio?: string;
  video_mode?: string;
  tags?: string[];
  source?: string;
}

export function mapCatalogItem(raw: Record<string, unknown>): OfficialTemplate {
  return {
    id: String(raw.id),
    title: String(raw.title),
    category: String(raw.category),
    category_label: raw.category_label ? String(raw.category_label) : undefined,
    prompt: String(raw.prompt || ''),
    hook: raw.hook ? String(raw.hook) : undefined,
    selling_points: Array.isArray(raw.selling_points) ? (raw.selling_points as string[]) : [],
    shot_plan: Array.isArray(raw.shot_plan) ? (raw.shot_plan as string[]) : [],
    cta: raw.cta ? String(raw.cta) : undefined,
    previewVideo: String(raw.preview_video || raw.previewVideo || ''),
    coverImage: String(raw.cover_image || raw.coverImage || ''),
    duration: typeof raw.duration === 'number' ? raw.duration : 20,
    ratio: raw.ratio ? String(raw.ratio) : '9:16',
    video_mode: raw.video_mode ? String(raw.video_mode) : String(raw.category),
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    isNew: Boolean(raw.is_new ?? raw.isNew),
    source: raw.source ? String(raw.source) : undefined,
  };
}
