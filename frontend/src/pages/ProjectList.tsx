import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { listProjects } from '../api/client';
import { t, subscribe } from '../lib/i18n';
import type { Project } from '../types';
import AppShell from '../components/AppShell';

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const unsub = subscribe(() => forceUpdate((n) => n + 1));
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    listProjects()
      .then((data) => {
        setProjects(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || t('loadingError'));
        setLoading(false);
      });
  }, []);

  return (
    <AppShell title={t('projects')}>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft size={18} />
              {t('backToHome')}
            </Link>
            <Link
              to="/projects/new"
              className="px-5 py-2 text-sm rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold hover:from-indigo-400 hover:to-purple-500 transition-all"
            >
              {t('newProject')}
            </Link>
          </div>

          {loading ? (
            <p className="text-gray-400">{t('loading')}</p>
          ) : error ? (
            <p className="text-red-400">{error}</p>
          ) : projects.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-400 text-lg mb-4">{t('noProjects')}</p>
              <Link
                to="/projects/new"
                className="inline-block px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold"
              >
                {t('newProject')}
              </Link>
            </div>
          ) : (
            <div className="grid gap-4">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="block p-5 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/50 hover:bg-white/[0.07] transition-all"
                >
                  <div className="font-semibold text-lg">{p.name}</div>
                  <div className="text-sm text-gray-400 mt-1">
                    {t('status')}: {p.status} | {t('mode')}: {p.video_mode || 'product_show'} |{' '}
                    {new Date(p.created_at).toLocaleString()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
