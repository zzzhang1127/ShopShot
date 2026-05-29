export interface Project {
  id: number;
  name: string;
  description?: string;
  product_url?: string;
  product_info?: string;
  video_mode?: string;
  target_platform?: string;
  target_ratio?: string;
  target_resolution?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: number;
  name: string;
  type: string;
  url: string;
  source?: string;
  mime_type?: string;
  duration?: number;
  project_id?: number;
  created_at?: string;
}

export interface Script {
  id: number;
  project_id?: number;
  video_type?: string;
  title?: string;
  tags?: string;
  status: string;
  created_at?: string;
}

export interface Shot {
  id: number;
  script_id?: number;
  project_id?: number;
  shot_id: string;
  type?: string;
  status: string;
  image_prompt?: string;
  action_prompt?: string;
  words?: string;
  duration: number;
  sequence: number;
  reference_asset_id?: number;
  generated_image_asset_id?: number;
  generated_video_asset_id?: number;
}

export interface Video {
  id: number;
  project_id?: number;
  url: string;
  thumbnail_url?: string;
  status: string;
  created_at?: string;
}

export interface GenerationTask {
  id: string;
  project_id?: number;
  type: string;
  status: string;
  progress: number;
  step?: string;
  error?: string;
  result?: string;
  created_at?: string;
}
