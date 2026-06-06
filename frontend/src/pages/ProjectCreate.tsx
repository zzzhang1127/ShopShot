import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createProject } from '../api/client';
import { t } from '../lib/i18n';

export default function ProjectCreate() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [productInfo, setProductInfo] = useState('');
  const [videoMode, setVideoMode] = useState('product_show');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const project = await createProject({ name, description, product_info: productInfo, video_mode: videoMode });
      navigate(`/projects/${project.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-6">
      <div className="max-w-xl mx-auto">
        <div className="mb-6">
          <Link to="/projects" className="text-blue-400 hover:text-blue-300 transition-colors">
            {t('backToProjects')}
          </Link>
        </div>
        <h1 className="text-2xl font-bold mb-4">{t('createProject')}</h1>
        {error && <p className="text-red-400 mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('name')}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('description')}</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('productInfo')}</label>
            <textarea
              value={productInfo}
              onChange={(e) => setProductInfo(e.target.value)}
              rows={4}
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 outline-none focus:border-cyan-500 transition-colors resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('videoMode')}</label>
            <select
              value={videoMode}
              onChange={(e) => setVideoMode(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-cyan-500 transition-colors"
            >
              <option value="product_show">{t('productShow')}</option>
              <option value="story">{t('story')}</option>
              <option value="promotion">{t('promotion')}</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-400 hover:to-cyan-500 text-white font-semibold transition-all disabled:opacity-50"
          >
            {submitting ? t('creating') : t('create')}
          </button>
        </form>
      </div>
    </div>
  );
}
