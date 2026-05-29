/** Pixelle-Video 流水线 → ShopShot 后端映射 */
export type PipelinePreset =
  | 'quick_create'
  | 'asset_based'
  | 'digital_human'
  | 'i2v'
  | 'action_transfer';

export type MediaTab = 'image' | 'video' | 'audio' | 'templates';

export type PixellePipeline = {
  id: PipelinePreset;
  pixelleKey: string;
  nameKey: string;
  descKey: string;
  mediaTab: MediaTab;
  requiresComfy?: boolean;
  requiresUpload?: boolean;
  shopshotMode: 'quick' | 'advanced';
};

export const PIXELLE_PIPELINES: PixellePipeline[] = [
  {
    id: 'quick_create',
    pixelleKey: 'standard',
    nameKey: 'pipelineQuickCreate',
    descKey: 'pipelineQuickCreateDesc',
    mediaTab: 'video',
    shopshotMode: 'quick',
  },
  {
    id: 'asset_based',
    pixelleKey: 'asset_based',
    nameKey: 'pipelineAssetBased',
    descKey: 'pipelineAssetBasedDesc',
    mediaTab: 'video',
    requiresUpload: true,
    shopshotMode: 'advanced',
  },
  {
    id: 'digital_human',
    pixelleKey: 'digital_human',
    nameKey: 'pipelineDigitalHuman',
    descKey: 'pipelineDigitalHumanDesc',
    mediaTab: 'video',
    requiresComfy: true,
    shopshotMode: 'advanced',
  },
  {
    id: 'i2v',
    pixelleKey: 'i2v',
    nameKey: 'pipelineI2V',
    descKey: 'pipelineI2VDesc',
    mediaTab: 'video',
    requiresComfy: true,
    requiresUpload: true,
    shopshotMode: 'advanced',
  },
  {
    id: 'action_transfer',
    pixelleKey: 'action_transfer',
    nameKey: 'pipelineActionTransfer',
    descKey: 'pipelineActionTransferDesc',
    mediaTab: 'video',
    requiresComfy: true,
    requiresUpload: true,
    shopshotMode: 'advanced',
  },
];

export function pipelineForMediaTab(tab: MediaTab): PipelinePreset {
  if (tab === 'image') return 'i2v';
  if (tab === 'audio') return 'quick_create';
  return 'quick_create';
}

export function getPipeline(id: PipelinePreset): PixellePipeline | undefined {
  return PIXELLE_PIPELINES.find((p) => p.id === id);
}
