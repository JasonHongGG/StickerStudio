import React, { useState, useEffect, useMemo } from 'react';
import { UploadSection } from './components/UploadSection';
import { ConfigSection } from './components/ConfigSection';
import { ResultSection } from './components/ResultSection';
import { SettingsModal } from './components/SettingsModal';
import { GeneratedImage, StickerStyle, StickerPackInfo, StickerPlanItem } from './types';
import { STYLES, EMOTIONS, COMMON_ACTIONS, SAME_AS_REF_ID, AUTO_MATCH_ID, CUSTOM_ACTION_ID, CUSTOM_EMOTION_ID } from './constants';
import { fileToBase64, generateSticker } from './services/geminiService';
import { removeBackground } from './services/imageProcessingService';
import { saveImageRecord, getAllImages, deleteImageRecord, updateBatchNameInDB } from './services/storageService';
import { Sparkles, StopCircle, Palette, Settings } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [sourceImage, setSourceImage] = useState<File | null>(null);
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

  const handleUpload = (file: File) => {
    setSourceImage(file);
  };

  const handleRemoveImage = () => {
    setSourceImage(null);
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
    base64Image: string | null, 
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
        
        // Emotion Prompt
        let emotionPrompt = "";
        if (emotion === SAME_AS_REF_ID || emotion === AUTO_MATCH_ID) {
            emotionPrompt = ""; // Logic handled in geminiService by ID
        } else if (emotion === CUSTOM_EMOTION_ID) {
             // Custom text should be handled via ID check in geminiService or passed if stored.
             // Currently simplified.
        } else {
            const emoObj = EMOTIONS.find(e => e.id === emotion);
            emotionPrompt = emoObj ? emoObj.enName : emotion;
        }

        // Action Prompt
        let actionPrompt = "";
        if (action === SAME_AS_REF_ID || action === AUTO_MATCH_ID) {
            actionPrompt = ""; 
        } else {
            const actObj = COMMON_ACTIONS.find(a => a.id === action);
            actionPrompt = actObj ? actObj.enName : action; 
        }

        // 1. Generate via Gemini (Model is hardcoded in service)
        const generatedBase64 = await generateSticker(
            base64Image,
            charDesc,
            {
                emotionPrompt,
                actionPrompt,
                caption,
                emotionId: emotion,
                actionId: action
            }, 
            style.promptSuffix, 
            theme
        );
        
        if (signal.aborted) break;

        // 2. Remove Background (Client Side)
        const noBgDataUrl = await removeBackground(`data:image/png;base64,${generatedBase64}`);
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
    if (!sourceImage && !characterPrompt.trim()) {
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
                    item.emotionId === SAME_AS_REF_ID ? '原情' : 
                    item.emotionId === CUSTOM_EMOTION_ID ? (item.customEmotionText || '自訂') :
                    EMOTIONS.find(e => e.id === item.emotionId)?.name.split(' ')[0] || item.emotionId;
        
        let actName = item.actionId === AUTO_MATCH_ID ? '' : 
                    item.actionId === SAME_AS_REF_ID ? '原動' :
                    item.actionId === CUSTOM_ACTION_ID ? item.customActionText : 
                    COMMON_ACTIONS.find(a => a.id === item.actionId)?.name.split(' ')[0] || item.actionId;

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
      let base64 = null;
      if (sourceImage) {
          base64 = await fileToBase64(sourceImage);
      }
      await processQueue(newImages, base64, characterPrompt, style, themeText, controller.signal);
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
    if (!sourceImage && !characterPrompt) {
        alert("缺少原始素材（圖片或文字），無法重新生成。");
        return;
    }

    const targetImage = generatedImages.find(img => img.id === id);
    if (!targetImage || !targetImage.planDetails) return;

    setGeneratedImages(prev => prev.map(img => 
        img.id === id ? { ...img, status: 'processing' } : img
    ));

    try {
        let base64 = null;
        if (sourceImage) {
            base64 = await fileToBase64(sourceImage);
        }

        const style = STYLES.find(s => s.name === targetImage.styleName) || STYLES[0];
        
        const { emotion, action, caption } = targetImage.planDetails;
        
        // Recover prompts
        let emotionPrompt = "";
        const emoObj = EMOTIONS.find(e => e.id === emotion);
        if (emoObj) emotionPrompt = emoObj.enName;
        else if (emotion !== SAME_AS_REF_ID && emotion !== AUTO_MATCH_ID) emotionPrompt = emotion;

        let actionPrompt = "";
        const actObj = COMMON_ACTIONS.find(a => a.id === action);
        if (actObj) actionPrompt = actObj.enName;
        else if (action !== SAME_AS_REF_ID && action !== AUTO_MATCH_ID) actionPrompt = action;

        const generatedBase64 = await generateSticker(
            base64,
            characterPrompt,
            {
                emotionPrompt,
                actionPrompt,
                caption,
                emotionId: emotion,
                actionId: action
            }, 
            style.promptSuffix, 
            themeText, 
            refinePrompt
        );
        
        const noBgDataUrl = await removeBackground(`data:image/png;base64,${generatedBase64}`);
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

  // --- Render ---

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      
      {/* 1. Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="bg-black text-white p-1.5 rounded-lg shadow-sm">
                  <Palette size={20} />
              </div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">AI Sticker Studio</h1>
           </div>
           
           <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-full transition-all"
              title="設定"
           >
              <Settings size={20} />
           </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-8">
        
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          
          {/* Left Column: Fixed Width Controls (420px) */}
          <div className="w-full lg:w-[420px] flex-shrink-0 flex flex-col gap-6">
            
            <UploadSection 
                image={sourceImage} 
                onUpload={handleUpload}
                onRemove={handleRemoveImage}
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
                hasReferenceImage={!!sourceImage}
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
                            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                                <div className="bg-gradient-to-r from-amber-400 to-orange-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
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
                                disabled={(!sourceImage && !characterPrompt.trim()) || stickerPlan.length === 0}
                                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-3.5 rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:shadow-amber-200/50 transform active:scale-[0.99]"
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
             />
          </div>
        </div>
      </div>
      
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