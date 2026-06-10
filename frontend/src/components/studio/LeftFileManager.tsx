import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Home, Layers, Film, Image as ImageIcon, Video, Sparkles } from 'lucide-react';
import type { Asset } from '../../types';

function assetUrl(rel: string) {
  return rel.startsWith('http') ? rel : `/files/${rel}`;
}

interface LeftFileManagerProps {
  projectName: string;
  projectId: number;
  productImages: Asset[];
  shotTemplates: Asset[];
  libraryVideos: Array<{ id: string; title: string; previewVideo?: string; coverImage?: string }>;
  onDragProductImage: (asset: Asset) => void;
  onDragTemplateVideo: (asset: Asset) => void;
  onDragLibraryTemplate: (tpl: { id: string; title: string; previewVideo?: string }) => void;
}

export default function LeftFileManager({
  projectName,
  projectId,
  productImages,
  shotTemplates,
  libraryVideos,
  onDragProductImage,
  onDragTemplateVideo,
  onDragLibraryTemplate,
}: LeftFileManagerProps) {
  const navigate = useNavigate();
  const [openSections, setOpenSections] = useState({ project: true, templates: true });

  const toggle = (key: keyof typeof openSections) =>
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-black/90 border-r border-white/8 overflow-y-auto text-xs select-none">
      {/* logo + nav */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-white/5">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="w-7 h-7 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-md flex items-center justify-center shrink-0"
        >
          <Sparkles size={14} />
        </button>
        <span className="text-white font-semibold truncate text-[11px]">{projectName}</span>
      </div>

      {/* 顶部导航 */}
      <div className="flex flex-col gap-0.5 px-2 pt-2 pb-1">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
        >
          <Home size={13} /> 首页
        </button>
        <button
          type="button"
          onClick={() => navigate('/projects')}
          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
        >
          <Layers size={13} /> 项目列表
        </button>
        <button
          type="button"
          onClick={() => navigate('/library')}
          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
        >
          <Film size={13} /> 资源库
        </button>
      </div>

      <div className="mx-2 my-1 border-t border-white/5" />

      {/* 项目资产 */}
      <div>
        <button
          type="button"
          onClick={() => toggle('project')}
          className="w-full flex items-center gap-1 px-3 py-1.5 text-gray-400 hover:text-white transition-colors"
        >
          {openSections.project ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span className="font-semibold uppercase tracking-wider text-[10px]">项目资产</span>
        </button>
        {openSections.project && (
          <div className="px-2 pb-1 space-y-0.5">
            {/* 商品图 */}
            <div className="px-2 py-1 text-gray-500 flex items-center gap-1">
              <ImageIcon size={11} /> 商品图 ({productImages.length})
            </div>
            {productImages.map((a) => (
              <div
                key={a.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('type', 'product_image');
                  e.dataTransfer.setData('asset_id', String(a.id));
                  onDragProductImage(a);
                }}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 cursor-grab active:cursor-grabbing text-gray-300 hover:text-white"
              >
                <img
                  src={assetUrl(a.url)}
                  alt={a.name}
                  className="w-6 h-6 rounded object-cover shrink-0 border border-white/10"
                />
                <span className="truncate text-[10px]">{a.name}</span>
              </div>
            ))}
            {productImages.length === 0 && (
              <div className="px-2 py-1 text-gray-600 text-[10px]">暂无商品图</div>
            )}

            {/* 分镜模板 */}
            <div className="px-2 py-1 text-gray-500 flex items-center gap-1 mt-1">
              <Video size={11} /> 分镜模板 ({shotTemplates.length})
            </div>
            {shotTemplates.map((a) => (
              <div
                key={a.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('type', 'shot_template');
                  e.dataTransfer.setData('asset_id', String(a.id));
                  onDragTemplateVideo(a);
                }}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 cursor-grab active:cursor-grabbing text-gray-300 hover:text-white"
              >
                <div className="w-6 h-6 rounded bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <Video size={10} className="text-sky-400" />
                </div>
                <span className="truncate text-[10px]">{a.name}</span>
              </div>
            ))}
            {shotTemplates.length === 0 && (
              <div className="px-2 py-1 text-gray-600 text-[10px]">暂无模板</div>
            )}
          </div>
        )}
      </div>

      <div className="mx-2 my-1 border-t border-white/5" />

      {/* 模板库 */}
      <div>
        <button
          type="button"
          onClick={() => toggle('templates')}
          className="w-full flex items-center gap-1 px-3 py-1.5 text-gray-400 hover:text-white transition-colors"
        >
          {openSections.templates ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span className="font-semibold uppercase tracking-wider text-[10px]">模板库</span>
        </button>
        {openSections.templates && (
          <div className="px-2 pb-2 space-y-0.5">
            {libraryVideos.slice(0, 20).map((tpl) => (
              <div
                key={tpl.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('type', 'library_template');
                  e.dataTransfer.setData('template_id', tpl.id);
                  onDragLibraryTemplate(tpl);
                }}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 cursor-grab active:cursor-grabbing text-gray-300 hover:text-white"
              >
                {tpl.coverImage ? (
                  <img
                    src={tpl.coverImage}
                    alt={tpl.title}
                    className="w-6 h-6 rounded object-cover shrink-0 border border-white/10"
                  />
                ) : (
                  <div className="w-6 h-6 rounded bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <Film size={10} className="text-blue-400" />
                  </div>
                )}
                <span className="truncate text-[10px]">{tpl.title}</span>
              </div>
            ))}
            {libraryVideos.length === 0 && (
              <div className="px-2 py-1 text-gray-600 text-[10px]">模板库为空</div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
