import React, { useState, useEffect, useMemo } from 'react';
import { UploadSection } from './components/UploadSection';
// Fix missing imports for tool card - removed duplicate
import { ConfigSection } from './components/ConfigSection';
import { ResultSection } from './components/ResultSection';
import { BackgroundRemovalTool } from './components/BackgroundRemovalTool';
import { ImageCropTool } from './components/ImageCropTool';
import { SettingsModal } from './components/SettingsModal';
import { GeneratedImage, StickerStyle, StickerPackInfo, StickerPlanItem, ReferenceImage } from './types';
import { STYLES, EMOTIONS, COMMON_ACTIONS, SAME_AS_REF_ID, AUTO_MATCH_ID, CUSTOM_ACTION_ID, CUSTOM_EMOTION_ID } from './constants';
import { generateSticker } from './services/apiClient';
import { removeBackground } from './services/imageProcessingService';
import { composeStyleSheets } from './services/imageCompositor';
import { saveImageRecord, getAllImages, deleteImageRecord, updateBatchNameInDB, updateImageBatchId } from './services/storageService';
import { resolveEmotionPrompt, resolveActionPrompt } from './services/prompts';
import { Sparkles, StopCircle, Palette, Settings, Wrench, ArrowLeft, Plus, ChevronDown, LayoutGrid, Crop } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  // Page Navigation State
  const [currentPage, setCurrentPage] = useState<'main' | 'bg-removal' | 'image-crop'>('main');

  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [characterPrompt, setCharacterPrompt] = useState<string>('');

  // Config State
  const [selectedStyleId, setSelectedStyleId] = useState<string>('none');
  const [stickerPlan, setStickerPlan] = useState<StickerPlanItem[]>([]);
  const [themeText, setThemeText] = useState<string>('');

  // Pack Management State
  const [targetPackId, setTargetPackId] = useState<string>('new');
  const [newPackName, setNewPackName] = useState<string>('');

  // App Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);

  // Generation State
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // --- Initialization ---

  // Load images from IndexedDB on mount
  useEffect(() => {
    const loadImages = async () => {
      try {
        const images = await getAllImages();
        setGeneratedImages(images);
      } catch (e) {
        console.error("Failed to load images from DB", e);
      }
    };
    loadImages();
  }, []);

  // Compute existing packs from generatedImages
  const existingPacks: StickerPackInfo[] = useMemo(() => {
    const packsMap = new Map<string, StickerPackInfo>();
    generatedImages.forEach(img => {
      if (!packsMap.has(img.batchId)) {
        packsMap.set(img.batchId, {
          id: img.batchId,
          name: img.batchName || '未命名貼圖包',
          createdAt: img.createdAt
        });
      }
    });
    return Array.from(packsMap.values()).sort((a, b) => b.createdAt - a.createdAt);
  }, [generatedImages]);

  // --- Handlers ---

  const handleAddImages = (files: FileList) => {
    const newImages: ReferenceImage[] = Array.from(files).map(file => ({
      id: `ref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      previewUrl: URL.createObjectURL(file)
    }));
    setReferenceImages(prev => [...prev, ...newImages]);
  };

  const handleRemoveImage = (id: string) => {
    setReferenceImages(prev => {
      const toRemove = prev.find(img => img.id === id);
      if (toRemove) URL.revokeObjectURL(toRemove.previewUrl);
      return prev.filter(img => img.id !== id);
    });
  };

  const handleClearAllImages = () => {
    referenceImages.forEach(img => URL.revokeObjectURL(img.previewUrl));
    setReferenceImages([]);
  };

  const handleAddToPlan = (item: StickerPlanItem) => {
    setStickerPlan(prev => [...prev, item]);
  };

  const handleRemoveFromPlan = (id: string) => {
    setStickerPlan(prev => prev.filter(item => item.id !== id));
  };

  const handleSaveSettings = () => {
    // Just close the modal, saving is handled inside SettingsModal for Key
    setIsSettingsOpen(false);
  };

  // --- Core Generation Logic ---

  const processQueue = async (
    queue: GeneratedImage[],
    styleSheets: string[],
    charDesc: string,
    style: StickerStyle,
    theme: string,
    signal: AbortSignal
  ) => {
    let completedCount = 0;

    // Process strictly sequentially
    for (const item of queue) {
      if (signal.aborted) break;

      // Update status to processing
      setGeneratedImages(prev => prev.map(img =>
        img.id === item.id ? { ...img, status: 'processing' } : img
      ));

      try {
        // Resolve prompts from IDs
        if (!item.planDetails) throw new Error("Plan details missing");

        const { emotion, action, caption } = item.planDetails;

        // Use centralized prompt utilities
        const emotionPrompt = resolveEmotionPrompt(emotion);
        const actionPrompt = resolveActionPrompt(action);

        // 1. Generate via Backend API
        const generatedBase64 = await generateSticker({
          imageBase64: styleSheets.length > 0 ? styleSheets[0] : null,
          additionalImageBase64: styleSheets.slice(1),
          characterDescription: charDesc,
          plan: {
            emotionPrompt,
            actionPrompt,
            caption,
            emotionId: emotion,
            actionId: action
          },
          styleSuffix: style.promptSuffix,
          theme
        });

        if (signal.aborted) break;

        // 2. Remove Background (Client Side)
        const noBgDataUrl = await removeBackground(`data:image/png;base64,${generatedBase64}`, { fitToStickerSize: true });
        const res = await fetch(noBgDataUrl);
        const blob = await res.blob();

        const completedImg: GeneratedImage = {
          ...item,
          status: 'completed',
          originalImageBlob: blob
        };

        // Update State
        setGeneratedImages(prev => prev.map(img =>
          img.id === item.id ? completedImg : img
        ));

        // Save to DB
        await saveImageRecord(completedImg);

      } catch (error) {
        console.error(`Error generating ${item.expressionName}:`, error);
        setGeneratedImages(prev => prev.map(img =>
          img.id === item.id ? { ...img, status: 'failed', error: 'Failed' } : img
        ));
      } finally {
        completedCount++;
        setProgress(prev => ({ ...prev, current: completedCount }));
      }
    }
  };

  const handleStartGeneration = async () => {
    if (referenceImages.length === 0 && !characterPrompt.trim()) {
      alert("請至少「上傳照片」或「輸入角色描述」其中一項");
      return;
    }

    const style = STYLES.find(s => s.id === selectedStyleId) || STYLES[0];

    // Determine Batch ID and Name
    let batchId = '';
    let batchName = '';

    if (targetPackId === 'new') {
      batchId = `pack-${Date.now()}`;
      batchName = newPackName.trim() || `新貼圖包 ${new Date().toLocaleDateString()}`;
    } else {
      batchId = targetPackId;
      const existing = existingPacks.find(p => p.id === targetPackId);
      batchName = existing ? existing.name : 'Unknown Pack';
    }

    const timestamp = Date.now();
    const newImages: GeneratedImage[] = stickerPlan.map((item, index) => {
      let emoName = item.emotionId === AUTO_MATCH_ID ? '' :
        item.emotionId === SAME_AS_REF_ID ? '原始表情' :
          item.emotionId === CUSTOM_EMOTION_ID ? (item.customEmotionText || '自訂') :
            EMOTIONS.find(e => e.id === item.emotionId)?.name.split(' ')[1] || item.emotionId;

      let actName = item.actionId === AUTO_MATCH_ID ? '' :
        item.actionId === SAME_AS_REF_ID ? '原始動作' :
          item.actionId === CUSTOM_ACTION_ID ? (item.customActionText || '') :
            COMMON_ACTIONS.find(a => a.id === item.actionId)?.name.split(' ')[1] || item.actionId;

      let displayName = `${emoName} ${actName}`.trim();
      if (!displayName) displayName = "貼圖";
      if (item.caption) displayName += ` (${item.caption})`;

      return {
        id: `gen-${index}-${timestamp}-${Math.random()}`,
        expressionName: displayName,
        planDetails: {
          emotion: item.emotionId === CUSTOM_EMOTION_ID ? (item.customEmotionText || '') : item.emotionId,
          action: item.actionId === CUSTOM_ACTION_ID ? (item.customActionText || '') : item.actionId,
          caption: item.caption
        },
        originalImageBlob: new Blob(),
        status: 'pending',
        batchId: batchId,
        batchName: batchName,
        styleName: style.name,
        createdAt: timestamp,
        downloadOptions: { includeMain: false, includeTab: false }
      };
    });

    if (newImages.length === 0) return;

    setGeneratedImages(prev => [...newImages, ...prev]);
    setIsGenerating(true);
    setProgress({ current: 0, total: newImages.length });

    if (targetPackId === 'new') {
      setNewPackName('');
    }

    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Compose style sheets from reference images
      const styleSheets = await composeStyleSheets(referenceImages.map(r => r.file));
      await processQueue(newImages, styleSheets, characterPrompt, style, themeText, controller.signal);
    } catch (e) {
      console.error("Batch processing error", e);
    } finally {
      setIsGenerating(false);
      setAbortController(null);
    }
  };

  const handleStopGeneration = () => {
    if (abortController) {
      abortController.abort();
      setIsGenerating(false);
      setGeneratedImages(prev => prev.map(img =>
        (img.status === 'pending' || img.status === 'processing')
          ? { ...img, status: 'failed', error: 'Stopped' }
          : img
      ));
    }
  };

  // --- Individual Operations ---

  const handleRegenerate = async (id: string, refinePrompt: string = '') => {
    // Check if we have source (either img or text)
    if (referenceImages.length === 0 && !characterPrompt) {
      alert("缺少原始素材（圖片或文字），無法重新生成。");
      return;
    }

    const targetImage = generatedImages.find(img => img.id === id);
    if (!targetImage || !targetImage.planDetails) return;

    setGeneratedImages(prev => prev.map(img =>
      img.id === id ? { ...img, status: 'processing' } : img
    ));

    try {
      // Compose style sheets from reference images
      const styleSheets = await composeStyleSheets(referenceImages.map(r => r.file));

      const style = STYLES.find(s => s.name === targetImage.styleName) || STYLES[0];

      const { emotion, action, caption } = targetImage.planDetails;

      // Use centralized prompt utilities
      const emotionPrompt = resolveEmotionPrompt(emotion);
      const actionPrompt = resolveActionPrompt(action);

      // Call backend API
      const generatedBase64 = await generateSticker({
        imageBase64: styleSheets.length > 0 ? styleSheets[0] : null,
        additionalImageBase64: styleSheets.slice(1),
        characterDescription: characterPrompt,
        plan: {
          emotionPrompt,
          actionPrompt,
          caption,
          emotionId: emotion,
          actionId: action
        },
        styleSuffix: style.promptSuffix,
        theme: themeText,
        refinePrompt
      });

      const noBgDataUrl = await removeBackground(`data:image/png;base64,${generatedBase64}`, { fitToStickerSize: true });
      const res = await fetch(noBgDataUrl);
      const blob = await res.blob();

      const completedImg: GeneratedImage = {
        ...targetImage,
        status: 'completed',
        originalImageBlob: blob
      };

      setGeneratedImages(prev => prev.map(img =>
        img.id === id ? completedImg : img
      ));

      // Update DB
      await saveImageRecord(completedImg);

    } catch (e) {
      setGeneratedImages(prev => prev.map(img =>
        img.id === id ? { ...img, status: 'failed' } : img
      ));
    }
  };

  const handleDeleteResult = async (id: string) => {
    setGeneratedImages(prev => prev.filter(img => img.id !== id));
    try {
      await deleteImageRecord(id);
    } catch (e) {
      console.error("Failed to delete from DB", e);
    }
  };

  const handleUpdateOptions = async (id: string, options: Partial<GeneratedImage['downloadOptions']>) => {
    setGeneratedImages(prev => {
      const nextState = prev.map(img =>
        img.id === id ? { ...img, downloadOptions: { ...img.downloadOptions, ...options } } : img
      );
      const updatedImg = nextState.find(img => img.id === id);
      if (updatedImg) {
        saveImageRecord(updatedImg).catch(console.error);
      }
      return nextState;
    });
  };

  const handleUpdatePackName = async (batchId: string, newName: string) => {
    setGeneratedImages(prev => prev.map(img =>
      img.batchId === batchId ? { ...img, batchName: newName } : img
    ));
    try {
      await updateBatchNameInDB(batchId, newName);
    } catch (e) {
      console.error("Failed to update batch name in DB", e);
    }
  };

  const handleMoveImageToPack = async (imageId: string, targetBatchId: string) => {
    // Find the target batch name
    const targetPack = generatedImages.find(img => img.batchId === targetBatchId);
    const newBatchName = targetPack ? (targetPack.batchName || '未命名貼圖包') : 'Unknown Pack';

    setGeneratedImages(prev => prev.map(img =>
      img.id === imageId ? { ...img, batchId: targetBatchId, batchName: newBatchName } : img
    ));

    try {
      await updateImageBatchId(imageId, targetBatchId, newBatchName);
    } catch (e) {
      console.error("Failed to move image to pack", e);
    }
  };

  // --- Render ---

  return (
    <div className={`bg-gray-50 font-sans ${currentPage !== 'main' ? 'h-screen overflow-hidden flex flex-col' : 'min-h-screen'}`}>

      {/* 1. Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-[60] shadow-sm">
        <div className="max-w-[1800px] mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">

          {/* --- Main Header Mode --- */}
          {currentPage === 'main' ? (
            <>
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentPage('main')}>
                <div className="bg-black text-white p-1.5 rounded-lg shadow-sm">
                  <Palette size={20} />
                </div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">AI Sticker Studio</h1>
              </div>

              <div className="flex items-center gap-2">

                {/* Tools Dropdown (Main Style) */}
                <div className="relative">
                  <button
                    onClick={() => setIsToolsOpen(!isToolsOpen)}
                    className={`p-2 rounded-full transition-all ${isToolsOpen ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}
                    title="實用工具集"
                  >
                    <Wrench size={20} />
                  </button>

                  {/* Dropdown Menu */}
                  {isToolsOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                      <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                        可用工具
                      </div>

                      <button
                        onClick={() => {
                          setCurrentPage('bg-removal');
                          setIsToolsOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                      >
                        <div className="bg-white border border-gray-200 p-2 rounded-lg text-gray-900">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <polyline points="21 15 16 10 5 21"></polyline>
                            <path d="M12 12l2 2 4-4"></path>
                          </svg>
                        </div>
                        <div>
                          <div className="font-bold text-gray-800 text-sm">批量去背工具</div>
                          <div className="text-xs text-gray-500">自動移除背景</div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setCurrentPage('image-crop');
                          setIsToolsOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                      >
                        <div className="bg-white border border-gray-200 p-2 rounded-lg text-gray-900">
                          <Crop size={20} />
                        </div>
                        <div>
                          <div className="font-bold text-gray-800 text-sm">圖片裁切工具</div>
                          <div className="text-xs text-gray-500">批量裁切圖片</div>
                        </div>
                      </button>

                      <div className="border-t border-gray-100 my-1"></div>

                      <div className="px-4 py-3 flex items-center gap-3 opacity-50 cursor-not-allowed">
                        <div className="bg-gray-100 p-2 rounded-lg text-gray-400">
                          <Plus size={20} />
                        </div>
                        <div>
                          <div className="font-bold text-gray-400 text-sm">更多工具開發中</div>
                          <div className="text-xs text-gray-400">敬請期待</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-full transition-all"
                  title="設定"
                >
                  <Settings size={20} />
                </button>
              </div>
            </>
          ) : (
            /* --- Tool Header Mode --- */
            <>
              {/* Left: Back | Title | Badge */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setCurrentPage('main')}
                  className="p-2 -ml-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all"
                  title="返回主頁"
                >
                  <ArrowLeft size={20} />
                </button>

                <div className="h-6 w-px bg-gray-200"></div>

                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-gray-900">
                    {currentPage === 'bg-removal' ? '批量去背工具' : '圖片裁切工具'}
                  </h1>
                  <span className="bg-black text-white text-[10px] font-bold px-1.5 py-0.5 rounded leading-none">BETA</span>
                </div>
              </div>

              {/* Right: Tools Switcher Only */}
              <div className="relative">
                <button
                  onClick={() => setIsToolsOpen(!isToolsOpen)}
                  className="flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all"
                >
                  <LayoutGrid size={20} />
                  <span className="font-medium text-sm">切換工具</span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${isToolsOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Tool-specific Dropdown */}
                {isToolsOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      快速切換
                    </div>
                    <button
                      onClick={() => {
                        setCurrentPage('bg-removal');
                        setIsToolsOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                    >
                      <div className="bg-white border border-gray-200 p-2 rounded-lg text-gray-900 text-black">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                          <circle cx="8.5" cy="8.5" r="1.5"></circle>
                          <polyline points="21 15 16 10 5 21"></polyline>
                          <path d="M12 12l2 2 4-4"></path>
                        </svg>
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 text-sm">批量去背工具</div>
                        <div className={`text-xs font-medium ${currentPage === 'bg-removal' ? 'text-black' : 'text-gray-400'}`}>
                          {currentPage === 'bg-removal' ? '使用中' : '自動移除背景'}
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setCurrentPage('image-crop');
                        setIsToolsOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                    >
                      <div className="bg-white border border-gray-200 p-2 rounded-lg text-gray-900 text-black">
                        <Crop size={18} />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 text-sm">圖片裁切工具</div>
                        <div className={`text-xs font-medium ${currentPage === 'image-crop' ? 'text-black' : 'text-gray-400'}`}>
                          {currentPage === 'image-crop' ? '使用中' : '批量裁切圖片'}
                        </div>
                      </div>
                    </button>

                    <div className="border-t border-gray-100 my-1"></div>

                    <div className="px-4 py-3 flex items-center gap-3 opacity-50 cursor-not-allowed">
                      <div className="bg-gray-100 p-2 rounded-lg text-gray-400">
                        <Plus size={18} />
                      </div>
                      <div>
                        <div className="font-bold text-gray-400 text-sm">更多工具開發中</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      {/* Main Layout */}
      {
        currentPage === 'main' && (
          <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-8">

            <div className="flex flex-col lg:flex-row gap-8 items-start">

              {/* Left Column: Fixed Width Controls (420px) */}
              <div className="w-full lg:w-[420px] flex-shrink-0 flex flex-col gap-6">

                <UploadSection
                  referenceImages={referenceImages}
                  onAddImages={handleAddImages}
                  onRemoveImage={handleRemoveImage}
                  onClearAllImages={handleClearAllImages}
                  characterPrompt={characterPrompt}
                  onPromptChange={setCharacterPrompt}
                />

                <ConfigSection
                  selectedStyle={selectedStyleId}
                  onStyleChange={setSelectedStyleId}
                  stickerPlan={stickerPlan}
                  onAddToPlan={handleAddToPlan}
                  onRemoveFromPlan={handleRemoveFromPlan}
                  themeText={themeText}
                  onThemeChange={setThemeText}
                  // Pack Props
                  existingPacks={existingPacks}
                  targetPackId={targetPackId}
                  onTargetPackIdChange={setTargetPackId}
                  newPackName={newPackName}
                  onNewPackNameChange={setNewPackName}
                  // Source State
                  hasReferenceImage={referenceImages.length > 0}
                />

                {/* Action Bar */}
                <div className="sticky bottom-6 z-30">
                  <div className="bg-white p-4 rounded-xl shadow-xl border border-gray-200 backdrop-blur-sm bg-white/95">
                    {isGenerating ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between text-sm font-bold text-gray-700">
                          <span>生成中，請稍候...</span>
                          <span>{progress.current} / {progress.total}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                          <div className="bg-amber-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
                        </div>
                        <button
                          onClick={handleStopGeneration}
                          className="mt-2 w-full bg-red-100 text-red-600 font-bold py-3 rounded-xl hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
                        >
                          <StopCircle size={20} />
                          停止生成
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleStartGeneration}
                        disabled={(referenceImages.length === 0 && !characterPrompt.trim()) || stickerPlan.length === 0}
                        className="w-full bg-black text-white font-bold py-3.5 rounded-xl hover:bg-gray-800 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2 shadow-lg active:scale-[0.99]"
                      >
                        <Sparkles size={20} />
                        {targetPackId === 'new' ? '建立貼圖包並生成' : '加入貼圖包並生成'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Flexible Results Area */}
              <div className="flex-1 w-full min-w-0">
                <ResultSection
                  results={generatedImages}
                  onDelete={handleDeleteResult}
                  onRegenerate={handleRegenerate}
                  onUpdateOptions={handleUpdateOptions}
                  onUpdatePackName={handleUpdatePackName}
                  onMoveImageToPack={handleMoveImageToPack}
                />
              </div>
            </div>
          </div>
        )
      }



      {/* Background Removal Tool Page */}
      {currentPage === 'bg-removal' && (
        <div className="flex-1 w-full overflow-hidden px-4 lg:px-6 py-8">
          <div className="max-w-[1800px] mx-auto h-full">
            <BackgroundRemovalTool />
          </div>
        </div>
      )}

      {/* Image Crop Tool Page */}
      {currentPage === 'image-crop' && (
        <div className="flex-1 w-full overflow-hidden px-4 lg:px-6 py-8">
          <div className="max-w-[1800px] mx-auto h-full">
            <ImageCropTool />
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
      />
    </div>
  );
};

export default App;