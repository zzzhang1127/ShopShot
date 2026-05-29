import { useNavigate, useLocation } from 'react-router-dom';
import { Home, FolderOpen, Image as ImageIcon, Video, Music, LayoutTemplate, Sparkles, Globe } from 'lucide-react';
import { t, getLang, setLang, subscribe } from '../lib/i18n';
import { useEffect, useState } from 'react';

const navItems = [
  { icon: Home, labelKey: 'home', path: '/' },
  { icon: FolderOpen, labelKey: 'projects', path: '/projects' },
  { icon: ImageIcon, labelKey: 'library', path: '/library' },
  { icon: Video, labelKey: 'videos', path: '/videos' },
  { icon: Music, labelKey: 'audio', path: '/audio' },
  { icon: LayoutTemplate, labelKey: 'templates', path: '/templates', badge: 'newBadge' },
];

export default function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [, bump] = useState(0);

  useEffect(() => {
    const unsub = subscribe(() => {
      bump((n) => n + 1);
    });
    return () => {
      unsub();
    };
  }, []);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-[#09090b] text-white overflow-hidden font-sans">
      <aside className="w-20 flex-shrink-0 flex flex-col items-center py-6 bg-black border-r border-white/10 z-20">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mb-8 w-9 h-9 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center"
        >
          <Sparkles size={18} />
        </button>
        <nav className="flex flex-col gap-2 flex-1 w-full items-center">
          {navItems.map((item) => (
            <div key={item.path} className="relative w-full flex justify-center">
              {item.badge && (
                <span className="absolute -top-1 right-1 bg-blue-600 text-[9px] px-1 rounded-full font-bold z-10">
                  {t(item.badge)}
                </span>
              )}
              <button
                type="button"
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1 w-full py-2 transition-colors ${
                  isActive(item.path) ? 'text-white' : 'text-gray-500 hover:text-white'
                }`}
              >
                <item.icon size={20} />
                <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
              </button>
            </div>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => setLang(getLang() === 'zh' ? 'en' : 'zh')}
          className="w-full py-2 text-[10px] font-semibold rounded-full border border-white/20 hover:bg-white/10 flex items-center justify-center gap-1"
        >
          <Globe size={12} />
          {t('switchLang')}
        </button>
      </aside>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {title && (
          <header className="h-14 flex items-center px-6 bg-[#13121F]/90 border-b border-white/5 shrink-0">
            <h1 className="text-base font-bold">{title}</h1>
          </header>
        )}
        {children}
      </div>
    </div>
  );
}
