import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  getProject,
  listAssets,
  uploadAsset,
  listVideos,
  listScripts,
  listShots,
  getTaskStatus,
  getLatestTask,
  formatApiError,
  downloadImageUrl,
  extractCameraStyle,
  generateScriptFromImages,
  generateScriptFromImagesStream,
  generateShotPrompts,
  generateVideoFromShots,
  deleteAsset,
  listLibraryVideos,
  updateProject,
  listBgmPresets,
  uploadBgm,
  applyBgmPreset,
} from '../api/client';
import { listCustomTemplates } from '../lib/templateStore';
import type { Asset, Project, Video as VideoType, GenerationTask, Shot, Script } from '../types';
import LeftFileManager from '../components/studio/LeftFileManager';
import RightPreviewPanel from '../components/studio/RightPreviewPanel';
import Block1ProductInput from '../components/studio/Block1ProductInput';
import Block2ScriptEdit from '../components/studio/Block2ScriptEdit';
import Block3ShotPrompts, { type ShotPromptItem } from '../components/studio/Block3ShotPrompts';
import Block4VideoResult from '../components/studio/Block4VideoResult';
import MediaLightbox from '../components/MediaLightbox';
import GenerationProgress from '../components/GenerationProgress';
import type { PreviewMedia } from '../components/MediaLightbox';

function assetUrl(rel: string) {
  return rel.startsWith('http') ? rel : `/files/${rel}`;
}

interface ShotTemplateItem {
  asset: Asset;
  cameraStyle: string;
}

type LibraryTpl = { id: string; title: string; previewVideo?: string; coverImage?: string };

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);

  const [project, setProject] = useState<Project | null>(null);
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [task, setTask] = useState<GenerationTask | null>(null);
  const [preview, setPreview] = useState<PreviewMedia | null>(null);
  const [libraryVideos, setLibraryVideos] = useState<LibraryTpl[]>([]);
  const [dbShots, setDbShots] = useState<Shot[]>([]);

  // four-block state
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [scriptText, setScriptText] = useState('');
  const [duration, setDuration] = useState<5 | 10 | 15 | 20>(20);
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [shotTemplates, setShotTemplates] = useState<ShotTemplateItem[]>([]);
  const [shotPrompts, setShotPrompts] = useState<ShotPromptItem[]>([]);
  const [activeBlock, setActiveBlock] = useState<1 | 2 | 3 | 4>(1);

  // audio settings
  const [enableTts, setEnableTts] = useState(false);
  const [ttsVoice, setTtsVoice] = useState('zh-CN-XiaoxiaoNeural');
  const [bgmPresets, setBgmPresets] = useState<import('../api/client').BgmPreset[]>([]);
  const [selectedBgmPresetId, setSelectedBgmPresetId] = useState<string | null>(null);
  const [uploadedBgmName, setUploadedBgmName] = useState<string | null>(null);

  // loading states
  const [generatingScript, setGeneratingScript] = useState(false);
  const [generatingShotPrompts, setGeneratingShotPrompts] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);

  // drag state (for pass-through to blocks)
  const draggedAsset = useRef<Asset | null>(null);
  const draggedTemplate = useRef<{ id: string; title: string; previewVideo?: string } | null>(null);

  const productImages = allAssets.filter((a) => a.type === 'image' && a.source !== 'generated');
  const shotTemplateAssets = allAssets.filter((a) => a.source === 'shot_template');
  const generatedVideoAssets = allAssets.filter((a) => a.type === 'video' && a.source === 'generated');

  const busy =
    task != null &&
    task.status !== 'succeeded' &&
    task.status !== 'failed' &&
    task.status !== 'cancelled';
  const isGeneratingVideo = busy;

  // Build shotVideos: pair generated shot videos with their shot IDs
  // Priority: match via DB shots → fallback to name-based → fallback to index
  const shotVideos = (() => {
    const shotAssets = generatedVideoAssets.filter((a) => /^shot_\d+_/.test(a.name));
    if (dbShots.length > 0) {
      return dbShots
        .filter((s) => s.generated_video_asset_id)
        .map((s) => {
          const asset = allAssets.find((a) => a.id === s.generated_video_asset_id);
          return asset ? { assetId: asset.id, url: asset.url, shotId: s.shot_id } : null;
        })
        .filter((x): x is { assetId: number; url: string; shotId: string } => x !== null);
    }
    return shotAssets.map((a, idx) => ({
      assetId: a.id,
      url: a.url,
      shotId: shotPrompts[idx]?.shotId ?? `P${idx + 1}`,
    }));
  })();

  const load = useCallback(async () => {
    const p = await getProject(projectId);
    setProject(p);
    setProductName(p.name || '');
    setProductDescription(p.product_info || '');
    const [a, v] = await Promise.all([listAssets(projectId), listVideos(projectId)]);
    setAllAssets(a);
    setVideos(v);

    // Restore shot prompts from DB (latest script)
    try {
      const scripts: Script[] = await listScripts(projectId);
      if (scripts.length > 0) {
        const latestScript = scripts[0];
        const shots: Shot[] = await listShots(latestScript.id);
        setDbShots(shots);
        // Only restore if user hasn't manually set shotPrompts yet
        setShotPrompts((prev) => {
          if (prev.length > 0) return prev;
          return shots.map((s) => ({
            shotId: s.shot_id,
            imagePrompt: s.image_prompt || '',
            actionPrompt: s.action_prompt || '',
            words: s.words || '',
          }));
        });
      }
    } catch {
      // ignore - shots not critical
    }
  }, [projectId]);

  useEffect(() => {
    load().then(async () => {
      try {
        const latestTask = await getLatestTask(projectId);
        if (latestTask && (latestTask.status === 'queued' || latestTask.status === 'running')) {
          setTask(latestTask);
        }
      } catch {
        /* ignore */
      }
    });
    // Load BGM presets
    listBgmPresets().then(setBgmPresets).catch(() => setBgmPresets([]));
  }, [load, projectId]);

  useEffect(() => {
    // Load library templates (custom + built-in)
    try {
      const custom = listCustomTemplates();
      const mapped: LibraryTpl[] = custom.map((c) => ({
        id: c.id,
        title: c.title,
        previewVideo: c.previewVideo,
        coverImage: c.coverImage,
      }));
      setLibraryVideos(mapped);
    } catch {
      setLibraryVideos([]);
    }
    listLibraryVideos(30)
      .then((items: any[]) => {
        const mapped: LibraryTpl[] = items.map((i: any) => ({
          id: String(i.id || i.asset_id || ''),
          title: i.title || i.name || 'template',
          previewVideo: i.url ? assetUrl(i.url) : undefined,
          coverImage: i.thumbnail_url ? assetUrl(i.thumbnail_url) : undefined,
        }));
        setLibraryVideos((prev) => {
          const ids = new Set(prev.map((x) => x.id));
          return [...prev, ...mapped.filter((m) => !ids.has(m.id))];
        });
      })
      .catch(() => {});
  }, []);

  // Sync shot templates from DB assets
  useEffect(() => {
    setShotTemplates((prev) => {
      const existingIds = new Set(prev.map((s) => s.asset.id));
      const newItems = shotTemplateAssets
        .filter((a) => !existingIds.has(a.id))
        .map((a) => ({ asset: a, cameraStyle: '' }));
      // Remove stale
      const validIds = new Set(shotTemplateAssets.map((a) => a.id));
      const filtered = prev.filter((s) => validIds.has(s.asset.id));
      return [...filtered, ...newItems];
    });
  }, [shotTemplateAssets]);

  // Poll task
  useEffect(() => {
    if (!task?.id) return;
    if (task.status === 'succeeded' || task.status === 'failed' || task.status === 'cancelled') {
      load().finally(() => {});
      return;
    }
    const iv = setInterval(async () => {
      try {
        const latest = await getTaskStatus(task.id);
        setTask(latest);
      } catch {
        /* ignore */
      }
    }, 2000);
    return () => clearInterval(iv);
  }, [task?.id, task?.status, load]);

  // ── handlers ────────────────────────────────────────────────────────────────

  const handleProductImagesUpload = async (files: File[]) => {
    if (productImages.length + files.length > 4) {
      alert('最多上传 4 张商品图');
      return;
    }
    setUploadingImage(true);
    try {
      for (const file of files) {
        await uploadAsset(projectId, file, 'upload');
      }
      setAllAssets(await listAssets(projectId));
    } catch (err) {
      alert(formatApiError(err));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUrlImport = async (url: string) => {
    if (productImages.length >= 4) {
      alert('最多上传 4 张商品图');
      return;
    }
    setUploadingImage(true);
    try {
      await downloadImageUrl(projectId, url);
      setAllAssets(await listAssets(projectId));
    } catch (err) {
      alert(`图片导入失败\n\n${formatApiError(err)}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleProductImageDelete = async (assetId: number) => {
    try {
      await deleteAsset(assetId);
      setAllAssets((prev) => prev.filter((a) => a.id !== assetId));
    } catch (err) {
      alert(formatApiError(err));
    }
  };

  const handleProductImageReorder = (from: number, to: number) => {
    setAllAssets((prev) => {
      const imgs = prev.filter((a) => a.type === 'image' && a.source !== 'generated');
      const rest = prev.filter((a) => !(a.type === 'image' && a.source !== 'generated'));
      const reordered = [...imgs];
      const [item] = reordered.splice(from, 1);
      reordered.splice(to, 0, item);
      return [...reordered, ...rest];
    });
  };

  const handleGenerateScript = async () => {
    if (productImages.length === 0) {
      alert('请先上传至少 1 张商品图');
      return;
    }
    setGeneratingScript(true);
    setScriptText('');       // clear before streaming
    setActiveBlock(2);       // switch to Block2 so user sees text appearing
    try {
      await updateProject(projectId, {
        product_info: productDescription || productName,
      });
      await generateScriptFromImagesStream(
        {
          project_id: projectId,
          product_name: productName,
          product_description: productDescription,
          image_asset_ids: productImages.map((a) => a.id),
        },
        (chunk) => setScriptText((prev) => prev + chunk)
      );
    } catch (err) {
      alert(`剧本生成失败\n\n${formatApiError(err)}`);
    } finally {
      setGeneratingScript(false);
    }
  };

  const handleTemplateUpload = async (file: File) => {
    setUploadingTemplate(true);
    try {
      const result = await extractCameraStyle(projectId, file);
      setAllAssets(await listAssets(projectId));
      setShotTemplates((prev) => {
        const exists = prev.find((s) => s.asset.id === result.asset_id);
        if (exists) return prev;
        return [
          ...prev,
          {
            asset: {
              id: result.asset_id,
              name: result.filename,
              type: 'video',
              url: result.asset_url,
              source: 'shot_template',
            },
            cameraStyle: result.camera_style,
          },
        ];
      });
    } catch (err) {
      alert(`模板上传失败\n\n${formatApiError(err)}`);
    } finally {
      setUploadingTemplate(false);
    }
  };

  const handleTemplateDelete = (assetId: number) => {
    setShotTemplates((prev) => prev.filter((s) => s.asset.id !== assetId));
    if (assetId > 0) {
      deleteAsset(assetId).catch(() => {});
    }
  };

  const handleTemplateReorder = (from: number, to: number) => {
    setShotTemplates((prev) => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
  };

  const handleTemplateCameraStyleChange = (assetId: number, style: string) => {
    setShotTemplates((prev) =>
      prev.map((s) => (s.asset.id === assetId ? { ...s, cameraStyle: style } : s))
    );
  };

  const handleGenerateShotPrompts = async () => {
    if (!scriptText.trim()) {
      alert('请先生成或输入剧本文案');
      return;
    }
    const shotCount = { 5: 1, 10: 2, 15: 3, 20: 4 }[duration] ?? 4;
    setGeneratingShotPrompts(true);
    try {
      const result = await generateShotPrompts({
        script_text: scriptText,
        camera_styles: shotTemplates.map((s) => s.cameraStyle).filter(Boolean),
        shot_count: shotCount,
        product_info: `${productName} ${productDescription}`.trim(),
      });
      setShotPrompts(
        result.shots.map((s) => ({
          shotId: s.shot_id,
          imagePrompt: s.image_prompt,
          actionPrompt: s.action_prompt,
          words: s.words,
        }))
      );
      setActiveBlock(3);
    } catch (err) {
      alert(`分镜提示词生成失败\n\n${formatApiError(err)}`);
    } finally {
      setGeneratingShotPrompts(false);
    }
  };

  const handleShotPromptChange = (
    idx: number,
    field: keyof ShotPromptItem,
    value: string
  ) => {
    setShotPrompts((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
  };

  const handleBgmUpload = async (file: File) => {
    try {
      await uploadBgm(projectId, file);
      setUploadedBgmName(file.name);
      setSelectedBgmPresetId(null);
    } catch (err) {
      alert(`BGM 上传失败\n\n${formatApiError(err)}`);
    }
  };

  const handleSelectBgmPreset = (id: string | null) => {
    setSelectedBgmPresetId(id);
    if (id) {
      setUploadedBgmName(null);
    } else {
      // 取消选择时同步清空已上传 BGM 名称
      setUploadedBgmName(null);
    }
  };

  const handleGenerateVideo = async () => {
    if (shotPrompts.length === 0) {
      alert('请先生成分镜提示词');
      return;
    }
    if (productImages.length === 0) {
      alert('请先上传商品图（视频需要商品图作为参考）');
      return;
    }
    setTask(null);
    setActiveBlock(4);
    try {
      // If a BGM preset is selected, apply it to the project first
      if (selectedBgmPresetId) {
        try {
          await applyBgmPreset(projectId, selectedBgmPresetId);
        } catch {
          // non-fatal: continue without BGM
        }
      }
      const newTask = await generateVideoFromShots({
        project_id: projectId,
        shots: shotPrompts.map((s) => ({
          shot_id: s.shotId,
          image_prompt: s.imagePrompt,
          action_prompt: s.actionPrompt,
          words: s.words,
        })),
        product_asset_ids: productImages.map((a) => a.id),
        duration,
        aspect_ratio: aspectRatio,
        enable_tts: enableTts,
        tts_voice: ttsVoice,
      });
      setTask(newTask);
    } catch (err) {
      alert(`视频生成启动失败\n\n${formatApiError(err)}`);
    }
  };

  // drag handlers for left sidebar → blocks
  const handleBlock1Drop = (_e: React.DragEvent) => {
    // product images from left sidebar are already in productImages — no-op
  };

  const handleBlock2Drop = (e: React.DragEvent) => {
    const type = e.dataTransfer.getData('type');
    if (type === 'shot_template' && draggedAsset.current) {
      const asset = draggedAsset.current;
      setShotTemplates((prev) => {
        if (prev.find((s) => s.asset.id === asset.id)) return prev;
        return [...prev, { asset, cameraStyle: 'slow push-in, product centered' }];
      });
    }
    if (type === 'library_template' && draggedTemplate.current) {
      const tpl = draggedTemplate.current;
      if (tpl.previewVideo) {
        setShotTemplates((prev) => {
          if (prev.find((s) => s.asset.name === tpl.title)) return prev;
          const pseudoAsset: Asset = {
            id: -(Date.now()), // negative ID flags it as a non-DB reference
            name: tpl.title,
            type: 'video',
            url: tpl.previewVideo!,
            source: 'shot_template',
          };
          return [...prev, { asset: pseudoAsset, cameraStyle: 'slow push-in, product centered' }];
        });
      }
    }
    draggedAsset.current = null;
    draggedTemplate.current = null;
  };

  const handlePreview = (url: string, type: 'image' | 'video' = 'video') => {
    setPreview({ url, type, title: '' });
  };

  if (!project) {
    return (
      <div className="h-screen bg-black text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500/50 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm text-gray-400">加载项目…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black text-gray-300 font-sans overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-black" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-600/6 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-blue-600/6 rounded-full blur-[120px]" />
      </div>

      <MediaLightbox media={preview} onClose={() => setPreview(null)} />

      {/* 任务进度条：sticky 置顶，始终可见 */}
      {task && (
        <div className="absolute top-0 left-0 right-0 z-50 transition-all duration-300">
          {(busy || task.status === 'succeeded' || task.status === 'failed') && (
            <GenerationProgress
              task={task}
              onCancel={undefined}
              cancelling={false}
            />
          )}
        </div>
      )}

      {/* 左侧文件管理器 */}
      <div className="relative z-10">
        <LeftFileManager
          projectName={project.name}
          projectId={projectId}
          productImages={productImages}
          shotTemplates={shotTemplateAssets}
          libraryVideos={libraryVideos}
          onDragProductImage={(a) => { draggedAsset.current = a; }}
          onDragTemplateVideo={(a) => { draggedAsset.current = a; }}
          onDragLibraryTemplate={(tpl) => { draggedTemplate.current = tpl; }}
        />
      </div>

      {/* 中央工作区 */}
      <main className="relative z-10 flex-1 overflow-y-auto" style={{ paddingTop: task && (busy || task.status === 'succeeded' || task.status === 'failed') ? '52px' : undefined }}>
        <div className="max-w-3xl mx-auto px-5 py-5 space-y-4">

          <Block1ProductInput
            productImages={productImages}
            productName={productName}
            productDescription={productDescription}
            onProductNameChange={setProductName}
            onProductDescriptionChange={setProductDescription}
            onFileUpload={handleProductImagesUpload}
            onUrlImport={handleUrlImport}
            onGenerateScript={handleGenerateScript}
            generating={generatingScript || uploadingImage}
            onDrop={handleBlock1Drop}
            onFocus={() => setActiveBlock(1)}
          />

          <Block2ScriptEdit
            scriptText={scriptText}
            onScriptChange={setScriptText}
            duration={duration}
            onDurationChange={(d) => setDuration(d)}
            shotTemplates={shotTemplates.map((s) => ({
              assetId: s.asset.id,
              url: s.asset.url,
              filename: s.asset.name,
              cameraStyle: s.cameraStyle,
            }))}
            onTemplateUpload={handleTemplateUpload}
            onGenerateShotPrompts={handleGenerateShotPrompts}
            generating={generatingShotPrompts || uploadingTemplate}
            disabled={false}
            onDrop={handleBlock2Drop}
            onFocus={() => setActiveBlock(2)}
          />

          <Block3ShotPrompts
            shotPrompts={shotPrompts}
            onShotPromptChange={handleShotPromptChange}
            onGenerateVideo={handleGenerateVideo}
            generating={isGeneratingVideo}
            disabled={isGeneratingVideo}
            aspectRatio={aspectRatio}
            onAspectRatioChange={setAspectRatio}
            enableTts={enableTts}
            onEnableTtsChange={setEnableTts}
            ttsVoice={ttsVoice}
            onTtsVoiceChange={setTtsVoice}
            bgmPresets={bgmPresets}
            selectedBgmPresetId={selectedBgmPresetId}
            onSelectBgmPreset={handleSelectBgmPreset}
            onUploadBgm={handleBgmUpload}
            uploadedBgmName={uploadedBgmName}
            onFocus={() => setActiveBlock(3)}
          />

          <Block4VideoResult
            videos={videos}
            shotVideos={shotVideos}
            taskStatus={task?.status}
            taskProgress={task?.progress}
            taskStep={task?.step}
            onPreview={(url) => handlePreview(url, 'video')}
            projectName={project.name}
            onFocus={() => setActiveBlock(4)}
          />
        </div>
      </main>

      {/* 右侧预览栏 */}
      <div className="relative z-10">
        <RightPreviewPanel
          activeBlock={activeBlock}
          productImages={productImages}
          shotTemplates={shotTemplates}
          onProductImageDelete={handleProductImageDelete}
          onProductImageReorder={handleProductImageReorder}
          onTemplateDelete={handleTemplateDelete}
          onTemplateReorder={handleTemplateReorder}
          onTemplateCameraStyleChange={handleTemplateCameraStyleChange}
          onPreview={handlePreview}
        />
      </div>
    </div>
  );
}
