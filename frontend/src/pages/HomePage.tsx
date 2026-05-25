import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home, FolderOpen, Image as ImageIcon, Video, Music,
  LayoutTemplate, BarChart3, Settings, Sparkles, ImagePlus,
  Link as LinkIcon, Upload, Wand2, X, Globe, ChevronRight
} from 'lucide-react';
import { t, getLang, setLang, subscribe } from '../lib/i18n';
import { createProject, uploadAsset, formatApiError } from '../api/client';

interface Template {
  id: string;
  titleKey: string;
  videoSrc: string;
  imgSrc: string;
  isNew?: boolean;
  category: string;
}

const templates: Template[] = [
  { id: 'clothes', titleKey: 'templateClothes', videoSrc: '/templates/clothes.mp4', imgSrc: '/templates/clothes.jpg', category: 'fashion' },
  { id: 'cosmetics', titleKey: 'templateCosmetics', videoSrc: '/templates/cosmetics.mp4', imgSrc: '/templates/cosmetics.jpg', isNew: true, category: 'beauty' },
  { id: 'electronics', titleKey: 'templateElectronics', videoSrc: '/templates/electronics.mp4', imgSrc: '/templates/electronics.jpg', category: '3c' },
  { id: 'food', titleKey: 'templateFood', videoSrc: '/templates/food.mp4', imgSrc: '/templates/food.jpg', category: 'food' },
  { id: 'home', titleKey: 'templateHome', videoSrc: '/templates/home.mp4', imgSrc: '/templates/home.jpg', category: 'home' },
  { id: 'sports', titleKey: 'templateSports', videoSrc: '/templates/sports.mp4', imgSrc: '/templates/sports.jpg', isNew: true, category: 'sports' },
  { id: 'jewelry', titleKey: 'templateJewelry', videoSrc: '/templates/jewelry.mp4', imgSrc: '/templates/jewelry.jpg', category: 'jewelry' },
];

const navItems = [
  { icon: Home, labelKey: 'home', path: '/', active: true },
  { icon: FolderOpen, labelKey: 'projects', path: '/projects' },
  { icon: ImageIcon, labelKey: 'library', path: '/library' },
  { icon: Video, labelKey: 'videos', path: '/videos' },
  { icon: Music, labelKey: 'audio', path: '/audio' },
  { icon: LayoutTemplate, labelKey: 'templates', path: '/templates', badge: 'newBadge' },
  { icon: BarChart3, labelKey: 'analytics', path: '/analytics' },
  { icon: Settings, labelKey: 'settings', path: '/settings' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [, forceUpdate] = useState(0);
  const [query, setQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [pastedLink, setPastedLink] = useState('');
  const [modalMode, setModalMode] = useState<'text' | 'image' | 'video' | 'link' | 'template'>('text');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    const unsub = subscribe(() => forceUpdate((n) => n + 1));
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    // Auto-play all template videos
    videoRefs.current.forEach((video) => {
      video.play().catch(() => {});
    });
  }, []);

  const handleLangSwitch = () => {
    setLang(getLang() === 'zh' ? 'en' : 'zh');
  };

  const handleGenerate = async () => {
    if (!query.trim() && !uploadedFile && !pastedLink && !selectedTemplate) return;
    setCreating(true);
    try {
      const project = await createProject({
        name:
          query.trim() ||
          (selectedTemplate ? t(selectedTemplate.titleKey) : '') ||
          t('untitledScript'),
        description: pastedLink || undefined,
        product_info: query.trim() || undefined,
        video_mode: selectedTemplate?.category || 'product_show',
      });
      if (uploadedFile) {
        await uploadAsset(project.id, uploadedFile);
      }
      setShowModal(false);
      navigate(`/projects/${project.id}`);
    } catch (err: unknown) {
      alert(formatApiError(err) || '创建项目失败');
    } finally {
      setCreating(false);
    }
  };

  const openModal = (mode: 'text' | 'image' | 'video' | 'link' | 'template', tpl?: Template) => {
    setModalMode(mode);
    if (tpl) setSelectedTemplate(tpl);
    setShowModal(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setModalMode(file.type.startsWith('video') ? 'video' : 'image');
      setShowModal(true);
    }
  };

  const handleTemplateClick = (tpl: Template) => {
    setSelectedTemplate(tpl);
    setQuery(t(tpl.titleKey));
    openModal('template', tpl);
  };

  return (
    <div className="flex h-screen bg-[#09090b] text-white overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-20 flex-shrink-0 flex flex-col items-center py-6 bg-[#000000] border-r border-white/10 z-20">
        <div className="mb-8">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
            <Sparkles size={18} className="text-white" />
          </div>
        </div>

        <nav className="flex flex-col gap-2 flex-1 w-full items-center">
          {navItems.map((item) => (
            <div key={item.labelKey} className="relative w-full flex justify-center">
              {item.badge && (
                <span className="absolute -top-1 right-2 bg-blue-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold z-10">{t(item.badge)}</span>
              )}
              <button
                onClick={() => {
                  if (item.path === '/library' || item.path === '/videos' || item.path === '/audio' || item.path === '/templates' || item.path === '/analytics' || item.path === '/settings') {
                    navigate('/projects');
                    return;
                  }
                  if (item.path) navigate(item.path);
                }}
                className={`flex flex-col items-center justify-center gap-1 cursor-pointer w-full py-2 hover:text-white transition-colors ${item.active ? 'text-white' : 'text-gray-500'}`}
              >
                <item.icon size={20} />
                <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
              </button>
            </div>
          ))}
        </nav>

        <div className="flex flex-col gap-3 w-full px-2 mt-auto">
          <button
            onClick={handleLangSwitch}
            className="w-full py-2 text-xs font-semibold rounded-full border border-white/20 hover:bg-white/10 transition-colors flex items-center justify-center gap-1"
          >
            <Globe size={12} />
            {t('switchLang')}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative flex flex-col overflow-y-auto">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a0b2e] via-[#09090b] to-[#09090b]" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px]" />
          <div className="absolute top-20 right-1/4 w-80 h-80 bg-blue-600/15 rounded-full blur-[100px]" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center pt-20 px-8 w-full min-h-full">
          {/* Hero Title */}
          <h1
            className="text-5xl md:text-7xl font-black text-center tracking-tight leading-tight mb-4 drop-shadow-2xl"
            style={{ fontFamily: "'Impact', 'Arial Black', sans-serif" }}
          >
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
              {t('heroTitle1')}
            </span>
            <br />
            <span className="text-white">{t('heroTitle2')}</span>
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
              {t('heroTitle3')}
            </span>
          </h1>

          <p className="text-gray-400 text-center max-w-2xl mb-10 text-lg">
            {t('heroSubtitle')}
          </p>

          {/* Search Box */}
          <div className="w-full max-w-3xl flex items-center bg-black/40 backdrop-blur-xl border border-white/10 rounded-full p-2 pl-5 shadow-2xl mb-6">
            <Sparkles className="text-purple-400 mr-3 flex-shrink-0" size={20} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 text-base min-w-0"
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-400 hover:text-white transition-colors flex-shrink-0"
              title={t('uploadImage')}
            >
              <ImagePlus size={20} />
            </button>
            <button
              onClick={() => openModal('link')}
              className="p-2 text-gray-400 hover:text-white transition-colors flex-shrink-0"
              title={t('pasteLink')}
            >
              <LinkIcon size={20} />
            </button>
            <button
              onClick={handleGenerate}
              disabled={creating || !query.trim()}
              className="ml-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-full font-semibold flex items-center gap-2 transition-all flex-shrink-0"
            >
              <Wand2 size={18} />
              {creating ? t('creating') : t('generate')}
            </button>
          </div>

          {/* Quick action buttons */}
          <div className="flex items-center gap-3 mb-16 flex-wrap justify-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-2 bg-white/5 hover:bg-white/15 border border-white/10 rounded-full backdrop-blur-md text-sm font-medium text-gray-300 hover:text-white transition-all"
            >
              <Upload size={16} />
              {t('uploadImage')}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-2 bg-white/5 hover:bg-white/15 border border-white/10 rounded-full backdrop-blur-md text-sm font-medium text-gray-300 hover:text-white transition-all"
            >
              <Video size={16} />
              {t('uploadVideo')}
            </button>
            <button
              onClick={() => openModal('link')}
              className="flex items-center gap-2 px-5 py-2 bg-white/5 hover:bg-white/15 border border-white/10 rounded-full backdrop-blur-md text-sm font-medium text-gray-300 hover:text-white transition-all"
            >
              <LinkIcon size={16} />
              {t('pasteLink')}
            </button>
            <button
              onClick={() => navigate('/projects/new')}
              className="flex items-center gap-2 px-5 py-2 bg-white/5 hover:bg-white/15 border border-white/10 rounded-full backdrop-blur-md text-sm font-medium text-gray-300 hover:text-white transition-all"
            >
              <LayoutTemplate size={16} />
              {t('chooseTemplate')}
            </button>
          </div>

          {/* Templates Section */}
          <div className="w-full max-w-7xl pb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">{t('trendingTemplates')}</span>
              </h2>
              <button
                onClick={() => navigate('/projects')}
                className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
              >
                {t('viewAll')} <ChevronRight size={14} />
              </button>
            </div>

            {/* Template Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => handleTemplateClick(tpl)}
                  className="group relative rounded-xl overflow-hidden aspect-[3/4] cursor-pointer hover:ring-2 ring-purple-500 transition-all bg-gray-800"
                >
                  <video
                    ref={(el) => {
                      if (el) videoRefs.current.set(tpl.id, el);
                    }}
                    src={tpl.videoSrc}
                    poster={tpl.imgSrc}
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onLoadedData={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {tpl.isNew && (
                    <span className="absolute top-2 left-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                      {t('templateNew')}
                    </span>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <h3 className="text-sm font-semibold text-white drop-shadow-md">
                      {t(tpl.titleKey)}
                    </h3>
                    <p className="text-[10px] text-gray-300 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {t('clickToGenerate')}
                    </p>
                  </div>

                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Sparkles size={18} className="text-white" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-auto py-8 text-center text-gray-500 text-sm">
            {t('footerSlogan')}
          </div>
        </div>
      </main>

      {/* Quick Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#12121a] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">{t('quickCreate')}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            {modalMode === 'link' && (
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">{t('pasteLink')}</label>
                <input
                  type="text"
                  value={pastedLink}
                  onChange={(e) => setPastedLink(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 outline-none focus:border-purple-500"
                />
              </div>
            )}

            {(modalMode === 'image' || modalMode === 'video') && uploadedFile && (
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">
                  {modalMode === 'video' ? t('uploadVideo') : t('uploadImage')}
                </label>
                <div className="bg-black/40 border border-white/10 rounded-lg p-4 flex items-center gap-3">
                  {modalMode === 'image' ? <ImageIcon size={24} className="text-purple-400" /> : <Video size={24} className="text-blue-400" />}
                  <span className="text-sm text-gray-300 truncate">{uploadedFile.name}</span>
                </div>
              </div>
            )}

            {modalMode === 'template' && selectedTemplate && (
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">{t('chooseTemplate')}</label>
                <div className="bg-black/40 border border-white/10 rounded-lg p-4 flex items-center gap-3">
                  <LayoutTemplate size={24} className="text-pink-400" />
                  <span className="text-sm text-gray-300">{t(selectedTemplate.titleKey)}</span>
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">{t('inputProductInfo')}</label>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                rows={3}
                placeholder={t('searchPlaceholder')}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 outline-none focus:border-purple-500 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleGenerate}
                disabled={creating}
                className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Wand2 size={16} />
                {creating ? t('creating') : t('startCreate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
