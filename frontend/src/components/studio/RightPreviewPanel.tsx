import { useRef, useState } from 'react';
import { X, GripVertical, ZoomIn } from 'lucide-react';
import type { Asset } from '../../types';

function assetUrl(rel: string) {
  return rel.startsWith('http') ? rel : `/files/${rel}`;
}

interface ShotTemplateItem {
  asset: Asset;
  cameraStyle: string;
}

interface RightPreviewPanelProps {
  activeBlock: 1 | 2 | 3 | 4;
  productImages: Asset[];
  shotTemplates: ShotTemplateItem[];
  onProductImageDelete: (id: number) => void;
  onProductImageReorder: (from: number, to: number) => void;
  onTemplateDelete: (assetId: number) => void;
  onTemplateReorder: (from: number, to: number) => void;
  onTemplateCameraStyleChange: (assetId: number, style: string) => void;
  onPreview: (url: string, type: 'image' | 'video') => void;
}

export default function RightPreviewPanel({
  activeBlock,
  productImages,
  shotTemplates,
  onProductImageDelete,
  onProductImageReorder,
  onTemplateDelete,
  onTemplateReorder,
  onTemplateCameraStyleChange,
  onPreview,
}: RightPreviewPanelProps) {
  const draggingIdx = useRef(-1);

  const handleDragStart = (idx: number) => {
    draggingIdx.current = idx;
  };
  const handleDrop = (
    idx: number,
    reorder: (from: number, to: number) => void
  ) => {
    if (draggingIdx.current >= 0 && draggingIdx.current !== idx) {
      reorder(draggingIdx.current, idx);
    }
    draggingIdx.current = -1;
  };

  const showImages = activeBlock === 1 || activeBlock === 3 || activeBlock === 4;
  const showTemplates = activeBlock === 2;

  return (
    <aside className="w-72 flex-shrink-0 flex flex-col bg-black/90 border-l border-white/8 overflow-y-auto">
      {showImages && (
        <div className="flex-1">
          <div className="px-4 py-3 border-b border-white/5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              商品图 ({productImages.length}/4)
            </h3>
            <p className="text-[10px] text-gray-600 mt-0.5">
              {activeBlock === 1 ? '拖拽调整顺序，点击预览大图' : '当前项目商品参考图'}
            </p>
          </div>

          {productImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                <span className="text-2xl">🖼️</span>
              </div>
              <p className="text-sm text-gray-500">在板块一上传商品图</p>
              <p className="text-[11px] text-gray-600 mt-1">支持拖拽、URL导入</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 p-3">
              {productImages.map((img, idx) => (
                <div
                  key={img.id}
                  draggable={activeBlock === 1}
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(idx, onProductImageReorder)}
                  className="relative group rounded-lg overflow-hidden border border-white/10 bg-white/5"
                  style={{ aspectRatio: '1/1' }}
                >
                  <img
                    src={assetUrl(img.url)}
                    alt={img.name}
                    className="w-full h-full object-cover"
                  />
                  {activeBlock === 1 && (
                    <>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all" />
                      <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <GripVertical size={14} className="text-white cursor-grab" />
                      </div>
                      <button
                        type="button"
                        onClick={() => onProductImageDelete(img.id)}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={10} className="text-white" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onPreview(assetUrl(img.url), 'image')}
                        className="absolute bottom-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ZoomIn size={10} className="text-white" />
                      </button>
                    </>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 px-1.5 py-1">
                    <p className="text-[9px] text-gray-300 truncate">P{idx + 1}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showTemplates && (
        <div className="flex-1">
          <div className="px-4 py-3 border-b border-white/5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              分镜参考模板 ({shotTemplates.length})
            </h3>
            <p className="text-[10px] text-gray-600 mt-0.5">拖拽调整顺序，编辑运镜描述</p>
          </div>

          {shotTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                <span className="text-2xl">🎬</span>
              </div>
              <p className="text-sm text-gray-500">在板块二上传分镜模板</p>
              <p className="text-[11px] text-gray-600 mt-1">支持从左侧库拖入</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-3">
              {shotTemplates.map((item, idx) => (
                <div
                  key={item.asset.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(idx, onTemplateReorder)}
                  className="rounded-lg border border-white/10 bg-white/5 overflow-hidden"
                >
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <GripVertical size={13} className="text-gray-600 cursor-grab shrink-0" />
                    <div
                      className="w-10 h-7 rounded bg-white/5 overflow-hidden cursor-pointer shrink-0"
                      onClick={() => onPreview(`/files/${item.asset.url}`, 'video')}
                    >
                      <video
                        src={`/files/${item.asset.url}`}
                        className="w-full h-full object-cover"
                        muted
                      />
                    </div>
                    <span className="text-[10px] text-gray-300 flex-1 truncate">{item.asset.name}</span>
                    <button
                      type="button"
                      onClick={() => onTemplateDelete(item.asset.id)}
                      className="w-5 h-5 flex items-center justify-center text-gray-600 hover:text-red-400 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <div className="px-2 pb-2">
                    <textarea
                      value={item.cameraStyle}
                      onChange={(e) => onTemplateCameraStyleChange(item.asset.id, e.target.value)}
                      placeholder="运镜描述（AI 自动提取，可手动修改）"
                      rows={2}
                      className="w-full px-2 py-1.5 text-[10px] bg-black/30 border border-white/10 rounded text-gray-300 placeholder-gray-600 outline-none focus:border-blue-500/50 resize-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
