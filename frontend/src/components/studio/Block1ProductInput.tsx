import { useRef, useState } from 'react';
import { Upload, Link as LinkIcon, ImagePlus, Sparkles, Loader2 } from 'lucide-react';
import type { Asset } from '../../types';

function assetUrl(rel: string) {
  return rel.startsWith('http') ? rel : `/files/${rel}`;
}

interface Block1Props {
  productImages: Asset[];
  productName: string;
  productDescription: string;
  onProductNameChange: (v: string) => void;
  onProductDescriptionChange: (v: string) => void;
  onFileUpload: (files: File[]) => void;
  onUrlImport: (url: string) => void;
  onGenerateScript: () => void;
  generating: boolean;
  onDrop: (e: React.DragEvent) => void;
  onFocus: () => void;
}

export default function Block1ProductInput({
  productImages,
  productName,
  productDescription,
  onProductNameChange,
  onProductDescriptionChange,
  onFileUpload,
  onUrlImport,
  onGenerateScript,
  generating,
  onDrop,
  onFocus,
}: Block1Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) onFileUpload(files);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (files.length) {
      onFileUpload(files);
    } else {
      onDrop(e);
    }
  };

  const handleUrlImport = () => {
    const u = urlInput.trim();
    if (u) {
      onUrlImport(u);
      setUrlInput('');
    }
  };

  const canGenerate =
    productImages.length > 0 && (productName.trim() || productDescription.trim());

  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden"
      onClick={onFocus}
    >
      {/* 标题栏 */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5 bg-white/[0.02]">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-xs font-bold text-cyan-400">
          1
        </div>
        <h2 className="text-sm font-semibold text-white">商品输入</h2>
        <span className="text-[11px] text-gray-500 ml-auto">上传商品图 + 填写描述</span>
      </div>

      <div className="p-5 flex gap-4">
        {/* 左：文本输入区 */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">商品名称</label>
            <input
              type="text"
              value={productName}
              onChange={(e) => onProductNameChange(e.target.value)}
              placeholder="例：红色高跟鞋 10cm细跟"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1.5">商品描述 / 卖点 / 参数</label>
            <textarea
              value={productDescription}
              onChange={(e) => onProductDescriptionChange(e.target.value)}
              placeholder="例：意大利进口牛皮，防滑橡胶底，适合职场/约会/晚宴，轻盈仅280g，舒适度提升50%..."
              rows={4}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/50 resize-none transition-colors"
            />
          </div>

          {/* URL 导入 */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <LinkIcon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUrlImport()}
                placeholder="粘贴图片链接后回车"
                className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-gray-600 outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
            <button
              type="button"
              onClick={handleUrlImport}
              disabled={!urlInput.trim()}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 hover:bg-white/10 disabled:opacity-40 transition-colors"
            >
              导入
            </button>
          </div>
        </div>

        {/* 右：上传区 */}
        <div className="w-44 flex flex-col gap-2">
          {productImages.length === 0 ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex-1 min-h-[120px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                isDragOver
                  ? 'border-blue-500/60 bg-blue-500/5'
                  : 'border-white/15 hover:border-white/30 bg-white/[0.02]'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus size={20} className="text-gray-500" />
              <div className="text-center">
                <p className="text-xs text-gray-400">点击上传</p>
                <p className="text-[10px] text-gray-600 mt-0.5">或拖拽图片到此</p>
                <p className="text-[10px] text-gray-600">1-4 张</p>
              </div>
            </div>
          ) : (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex-1 rounded-xl border border-dashed transition-all p-1.5 ${
                isDragOver ? 'border-blue-500/60 bg-blue-500/5' : 'border-white/10'
              }`}
            >
              <div className="grid grid-cols-2 gap-1.5">
                {productImages.map((img) => (
                  <div key={img.id} className="aspect-square rounded-lg overflow-hidden bg-white/5 relative group">
                    <img
                      src={img.url.startsWith('http') ? img.url : `/files/${img.url}`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-[10px]">预览</span>
                    </div>
                  </div>
                ))}
                {productImages.length < 4 && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-lg border border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:border-white/40 transition-colors"
                  >
                    <ImagePlus size={16} className="text-gray-600" />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={productImages.length >= 4}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 hover:bg-white/10 disabled:opacity-40 transition-colors"
            >
              <Upload size={12} /> 上传图片
            </button>
          </div>

          {productImages.length > 0 && (
            <p className="text-center text-[10px] text-gray-500">
              已选 {productImages.length}/4 张，右侧可预览/删除
            </p>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={handleFilesChange}
            className="hidden"
          />
        </div>
      </div>

      {/* 生成按钮 */}
      <div className="px-5 pb-5">
        <button
          type="button"
          onClick={onGenerateScript}
          disabled={generating || !canGenerate}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20"
        >
          {generating ? (
            <>
              <Loader2 size={15} className="animate-spin" /> 生成剧本中…
            </>
          ) : (
            <>
              <Sparkles size={15} /> 生成剧本
            </>
          )}
        </button>
        {!canGenerate && (
          <p className="text-center text-[10px] text-gray-600 mt-2">
            请先上传至少 1 张商品图并填写商品名称或描述
          </p>
        )}
      </div>
    </div>
  );
}
