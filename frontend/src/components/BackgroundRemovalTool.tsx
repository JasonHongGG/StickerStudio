import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Upload, X, Download, Play, Check, AlertCircle, Trash2, ArrowRight, Plus, ChevronsLeft, ChevronsRight, Image as ImageIcon, Settings, Pipette } from 'lucide-react';
import { removeBackground } from '../services/imageProcessingService';
import { removeBackgroundWithAI, checkComfyUIHealth } from '../services/bgRemovalApiClient';
import JSZip from 'jszip';

interface BackgroundRemovalToolProps { }

interface ImageItem {
    id: string;
    file: File;
    previewUrl: string;
    resultUrl?: string; // Base64 or Blob URL of result
    status: 'idle' | 'processing' | 'success' | 'error';
    originalSize?: { width: number, height: number };
}

export const BackgroundRemovalTool: React.FC<BackgroundRemovalToolProps> = () => {
    // --- State ---
    const [images, setImages] = useState<ImageItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
    // const [viewMode, setViewMode] = useState<'compare' | 'result'>('compare'); // Removed in favor of permanent slider

    // Slider state: 0 = Full Result, 100 = Full Original. 
    // "Left side Original" means Original is visible from 0 to SliderPos.
    const [sliderPosition, setSliderPosition] = useState(50);
    const isDraggingSlider = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Processing mode: 'algorithm' (client-side) or 'ai' (ComfyUI)
    const [processingMode, setProcessingMode] = useState<'algorithm' | 'ai'>(() => {
        const saved = localStorage.getItem('bgRemovalMode');
        return (saved === 'ai') ? 'ai' : 'algorithm';
    });
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isAIAvailable, setIsAIAvailable] = useState<boolean | null>(null);

    // Algorithm Settings
    const [keyColor, setKeyColor] = useState('#00FF00'); // Default Green
    const [isEyedropperActive, setIsEyedropperActive] = useState(false);

    // Auto-select first image when added
    useEffect(() => {
        if (images.length > 0 && !selectedImageId) {
            setSelectedImageId(images[0].id);
        } else if (images.length === 0) {
            setSelectedImageId(null);
        }
    }, [images, selectedImageId]);

    // Save processing mode to localStorage
    useEffect(() => {
        localStorage.setItem('bgRemovalMode', processingMode);
    }, [processingMode]);

    // Check AI availability on mount
    useEffect(() => {
        checkComfyUIHealth().then(setIsAIAvailable);
    }, []);

    // Reset slider when image changes or status changes
    const selectedImage = images.find(img => img.id === selectedImageId);
    useEffect(() => {
        if (selectedImage?.status === 'success') {
            setSliderPosition(50); // Default to middle for comparison
        } else {
            setSliderPosition(100); // Show full original if not ready
        }
    }, [selectedImageId, selectedImage?.status]);


    // --- Handlers ---

    const handleMouseMove = (clientX: number) => {
        if (!isDraggingSlider.current || !containerRef.current || !selectedImage?.resultUrl) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const percent = Math.min(Math.max((x / rect.width) * 100, 0), 100);
        setSliderPosition(percent);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (isEyedropperActive) {
            handleCanvasClick(e);
            return;
        }
        if (selectedImage?.status !== 'success') return;
        isDraggingSlider.current = true;
        handleMouseMove(e.clientX);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (selectedImage?.status !== 'success') return;
        isDraggingSlider.current = true;
        handleMouseMove(e.touches[0].clientX);
    };

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (isDraggingSlider.current) {
                e.preventDefault();
                handleMouseMove(e.clientX);
            }
        };
        const onUp = () => {
            isDraggingSlider.current = false;
        };
        const onTouchMove = (e: TouchEvent) => {
            if (isDraggingSlider.current) {
                // e.preventDefault(); // Optional: prevent scroll
                handleMouseMove(e.touches[0].clientX);
            }
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('touchmove', onTouchMove);
        window.addEventListener('touchend', onUp);

        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onUp);
        };
    }, [selectedImage]);


    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            addImages(e.target.files);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const addImages = (fileList: FileList) => {
        const newImages: ImageItem[] = Array.from(fileList).map(file => ({
            id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file,
            previewUrl: URL.createObjectURL(file), // Helper to create object URL
            status: 'idle'
        }));
        setImages(prev => [...prev, ...newImages]);
    };

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDragging(false);
        }
    };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            addImages(e.dataTransfer.files);
        }
    };

    const handleRemoveImage = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setImages(prev => {
            const target = prev.find(img => img.id === id);
            if (target) URL.revokeObjectURL(target.previewUrl);
            const remaining = prev.filter(img => img.id !== id);
            // Adjust selection if removed
            if (selectedImageId === id) {
                setSelectedImageId(remaining.length > 0 ? remaining[0].id : null);
            }
            return remaining;
        });
    };

    const handleClearAll = () => {
        images.forEach(img => URL.revokeObjectURL(img.previewUrl));
        setImages([]);
        setSelectedImageId(null);
    };

    const fileToDataUrl = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleStartProcessing = async () => {
        const idleImages = images.filter(img => img.status === 'idle' || img.status === 'error');
        if (idleImages.length === 0) return;

        setIsProcessing(true);
        setProgress({ current: 0, total: idleImages.length });

        // Process sequentially to avoid browser freeze
        for (let i = 0; i < idleImages.length; i++) {
            const target = idleImages[i];

            // Update status to processing
            setImages(prev => prev.map(img => img.id === target.id ? { ...img, status: 'processing' } : img));

            try {
                const dataUrl = await fileToDataUrl(target.file);
                let resultUrl: string;

                if (processingMode === 'ai') {
                    // Use ComfyUI AI backend
                    const resultBase64 = await removeBackgroundWithAI(dataUrl);
                    resultUrl = `data:image/png;base64,${resultBase64}`;
                } else {
                    // Use client-side algorithm
                    // Pass keyColor if it's not the default green? Or always pass it.
                    // The service now handles keyColor option.
                    resultUrl = await removeBackground(dataUrl, {
                        keyColor: keyColor,
                        similarity: 40 // Keep default for now, could expose as slider later
                    });
                }

                setImages(prev => prev.map(img => img.id === target.id ? {
                    ...img,
                    status: 'success',
                    resultUrl
                } : img));

            } catch (error) {
                console.error("Processing failed", error);
                setImages(prev => prev.map(img => img.id === target.id ? { ...img, status: 'error' } : img));
            }

            setProgress(prev => ({ ...prev, current: prev.current + 1 }));
        }

        setIsProcessing(false);
    };

    const handleDownloadSingle = (image: ImageItem) => {
        if (!image.resultUrl) return;
        const link = document.createElement('a');
        link.href = image.resultUrl;
        link.download = `removed_bg_${image.file.name.replace(/\.[^/.]+$/, "")}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadAll = async () => {
        const successImages = images.filter(img => img.status === 'success' && img.resultUrl);
        if (successImages.length === 0) return;

        const zip = new JSZip();

        // Add files
        for (const img of successImages) {
            if (img.resultUrl) {
                const response = await fetch(img.resultUrl);
                const blob = await response.blob();
                zip.file(`removed_${img.file.name.replace(/\.[^/.]+$/, "")}.png`, blob);
            }
        }

        // Generate zip
        const content = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `background_removed_batch_${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSelectImage = (id: string) => {
        setSelectedImageId(id);
    };

    const handlePrevImage = () => {
        if (!selectedImageId) return;
        const idx = images.findIndex(img => img.id === selectedImageId);
        if (idx > 0) setSelectedImageId(images[idx - 1].id);
    };

    const handleNextImage = () => {
        if (!selectedImageId) return;
        const idx = images.findIndex(img => img.id === selectedImageId);
        if (idx < images.length - 1) setSelectedImageId(images[idx + 1].id);
    };

    const handleCanvasClick = (e: React.MouseEvent) => {
        if (!isEyedropperActive || !selectedImage) return;

        // Get color from the image at click position
        // We need to access the image data. 
        // Simplest way: draw to temporary canvas
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = selectedImage.previewUrl;

        // We need to map client coordinates to image coordinates
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();

        // Calculate relative position (0-1)
        // Note: The image is object-contain, so it might not fill the rect.
        // For accurate picking on "contain" images, we need to know the rendered size.
        // This is complex. 
        // Simpler approach: 
        // Just rely on the browser's cursor for now? No, we need the HEX.

        // Let's assume the user clicks on the visible part.
        // We can draw the image to a canvas of the same size as the container?
        // Or better: Use the same logic as ImagePaintTool - draw the image to an offscreen canvas.

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = rect.width;
            canvas.height = rect.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Calculate "contain" fit
                const imgRatio = img.naturalWidth / img.naturalHeight;
                const containerRatio = rect.width / rect.height;
                let drawW, drawH, dx, dy;

                if (imgRatio > containerRatio) {
                    drawW = rect.width;
                    drawH = rect.width / imgRatio;
                    dx = 0;
                    dy = (rect.height - drawH) / 2;
                } else {
                    drawH = rect.height;
                    drawW = rect.height * imgRatio;
                    dy = 0;
                    dx = (rect.width - drawW) / 2;
                }

                ctx.drawImage(img, dx, dy, drawW, drawH);

                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const p = ctx.getImageData(x, y, 1, 1).data;
                const hex = "#" + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1);

                setKeyColor(hex);
                setIsEyedropperActive(false); // Auto-exit mode after pick
            }
        };
    };

    // --- Render ---
    // Calculations for status
    const pendingCount = images.filter(i => i.status === 'idle' || i.status === 'error').length;
    const isProcessingDisabled = isProcessing || pendingCount === 0 || images.length === 0;

    return (
        <div className="flex flex-col lg:flex-row w-full h-full bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-200 animate-in fade-in duration-500">

            {/* --- Left Panel: Structured Sidebar --- */}
            <div className="w-full lg:w-80 flex-shrink-0 border-r border-gray-100 bg-white flex flex-col z-10 font-sans">

                {/* 1. Dynamic Content Area */}
                <div className="flex-1 flex flex-col min-h-0 relative">
                    {/* HIDDEN INPUT (Shared) */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        multiple
                        accept="image/png, image/jpeg, image/webp"
                        onChange={handleFileSelect}
                    />

                    {images.length === 0 ? (
                        /* MODE A: EMPTY STATE (Big Upload Area) */
                        <div className="flex-1 flex flex-col p-5">
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`
                                    flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all gap-4
                                    ${isDragging ? 'border-black bg-gray-50 scale-[0.99]' : 'border-gray-200 hover:border-black hover:bg-gray-50'}
                                `}
                            >
                                <div className={`p-4 rounded-full transition-colors ${isDragging ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 group-hover:bg-black group-hover:text-white'}`}>
                                    <Upload size={24} />
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-gray-900 mb-1">Upload Images</p>
                                    <span className="text-xs font-medium text-gray-500">Drag & drop or click to browse</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* MODE B: POPULATED STATE */
                        <>
                            {/* Queue Header */}
                            <div className="flex-shrink-0 px-5 py-4 border-b border-gray-100 bg-white flex items-center justify-between z-10 shadow-sm">
                                <span className="text-xs font-bold text-gray-900 tracking-wider">
                                    QUEUE ({images.length})
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-1.5 text-gray-500 hover:text-white hover:bg-black rounded-lg transition-all"
                                        title="Add Images"
                                    >
                                        <Plus size={16} />
                                    </button>
                                    <div className="w-px h-4 bg-gray-200 mx-1"></div>
                                    <button
                                        onClick={handleClearAll}
                                        disabled={isProcessing}
                                        className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                                        title="Clear All"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Scrollable Queue List */}
                            <div
                                className={`flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent p-3 space-y-2 relative transition-colors ${isDragging ? 'bg-blue-50/50' : ''}`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                {isDragging && (
                                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-500/10 backdrop-blur-[2px] border-2 border-dashed border-blue-500 rounded-xl m-2 pointer-events-none">
                                        <div className="bg-white px-4 py-2 rounded-full shadow-lg text-blue-600 font-bold text-sm flex items-center gap-2">
                                            <Upload size={16} />
                                            <span>Drop to Add Images</span>
                                        </div>
                                    </div>
                                )}
                                {images.map((img) => (
                                    <div
                                        key={img.id}
                                        onClick={() => handleSelectImage(img.id)}
                                        className={`
                                            group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 border
                                            ${selectedImageId === img.id ? 'bg-gray-900 border-gray-900 shadow-md z-0' : 'bg-white border-transparent hover:bg-gray-50'}
                                        `}
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0 relative">
                                            <img src={img.previewUrl} className="w-full h-full object-cover" />
                                            {img.status === 'success' && (
                                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center backdrop-blur-[1px]">
                                                    <Check size={12} className="text-white" strokeWidth={3} />
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                            <p className={`text-xs font-bold truncate ${selectedImageId === img.id ? 'text-white' : 'text-gray-900'}`}>
                                                {img.file.name}
                                            </p>
                                            <div className="flex items-center gap-1.5 h-3">
                                                {/* Status Text */}
                                                <span className={`text-[10px] font-medium leading-none ${selectedImageId === img.id ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    {img.status === 'idle' && 'Waiting'}
                                                    {img.status === 'processing' && 'Processing...'}
                                                    {img.status === 'success' && 'Ready'}
                                                    {img.status === 'error' && 'Failed'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Hover Remove Button */}
                                        <button
                                            onClick={(e) => handleRemoveImage(img.id, e)}
                                            className={`opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full ${selectedImageId === img.id ? 'text-gray-400 hover:text-white hover:bg-white/20' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'}`}
                                        >
                                            <X size={14} />
                                        </button>

                                        {/* Processing Indicator Overrides all icons if strictly processing */}
                                        {img.status === 'processing' && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* 3. Action Footer (Fixed Bottom) */}
                <div className="flex-shrink-0 p-5 border-t border-gray-100 bg-gray-50/50 z-20 space-y-3">
                    {/* Download All Button - only show when there are successful results */}
                    {images.some(img => img.status === 'success') && (
                        <button
                            onClick={handleDownloadAll}
                            className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                        >
                            <Download size={16} />
                            下載全部結果
                        </button>
                    )}

                    {/* Start Processing Button */}
                    <button
                        onClick={handleStartProcessing}
                        disabled={isProcessingDisabled}
                        className="w-full bg-black text-white py-3.5 rounded-xl font-bold text-sm hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-3"
                    >
                        {isProcessing ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span className="font-mono">{progress.current} / {progress.total}</span>
                            </>
                        ) : (
                            <>
                                <Play size={16} fill="currentColor" />
                                <span>START PROCESSING</span>
                            </>
                        )}
                    </button>
                    <div className="text-center">
                        <p className="text-[10px] text-gray-400">
                            {pendingCount > 0 ? `${pendingCount} image(s) ready to process` : "Add images to start"}
                        </p>
                    </div>
                </div>
            </div>

            {/* --- Right Panel: Comparison Canvas --- */}
            <div className="flex-1 bg-gray-50/30 relative flex flex-col overflow-hidden">

                {/* Right-side Toolbar (Download Current + Settings) */}
                <div className="absolute top-6 right-6 z-30 flex items-center gap-2">
                    {/* Download Current - only show when viewing a processed image */}
                    {selectedImage?.resultUrl && (
                        <button
                            onClick={() => selectedImage && handleDownloadSingle(selectedImage)}
                            className="p-2.5 rounded-full bg-white/80 backdrop-blur-md text-gray-700 border border-gray-200/50 hover:bg-white hover:shadow-xl transition-all shadow-lg"
                            title="下載此張"
                        >
                            <Download size={18} />
                        </button>
                    )}

                    {/* Settings Button */}
                    {/* Settings Button */}
                    {/* Eyedropper & Color Swatch (Only for Algorithm Mode) */}
                    {processingMode === 'algorithm' && (
                        <div className="flex items-center gap-2 mr-2 bg-white/80 backdrop-blur-md rounded-full px-2 py-1.5 shadow-lg border border-gray-200/50">
                            <button
                                onClick={() => setIsEyedropperActive(!isEyedropperActive)}
                                className={`p-1.5 rounded-full transition-all ${isEyedropperActive ? 'bg-black text-white' : 'text-gray-500 hover:text-black'}`}
                                title="Pick Background Color"
                            >
                                <Pipette size={16} />
                            </button>
                            <div className="w-px h-4 bg-gray-300"></div>
                            <div
                                className="w-5 h-5 rounded-full border border-gray-200 shadow-sm"
                                style={{ backgroundColor: keyColor }}
                                title={`Key Color: ${keyColor}`}
                            ></div>
                        </div>
                    )}

                    <div className="relative">
                        <button
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            className={`p-2.5 rounded-full transition-all shadow-lg border ${isSettingsOpen
                                ? 'bg-black text-white border-black'
                                : 'bg-white/80 backdrop-blur-md text-gray-700 border-gray-200/50 hover:bg-white hover:shadow-xl'}`}
                            title="處理設定"
                        >
                            <Settings size={18} />
                        </button>

                        {/* Settings Popover */}
                        {isSettingsOpen && (
                            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-3 px-4 animate-in fade-in zoom-in-95 duration-200">
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                                    處理模式
                                </div>

                                <div className="space-y-2">
                                    <button
                                        onClick={() => { setProcessingMode('algorithm'); setIsSettingsOpen(false); }}
                                        className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-colors ${processingMode === 'algorithm'
                                            ? 'bg-black text-white'
                                            : 'hover:bg-gray-50 text-gray-700'}`}
                                    >
                                        <div className={`w-3 h-3 rounded-full border-2 ${processingMode === 'algorithm' ? 'bg-white border-white' : 'border-gray-300'}`} />
                                        <div>
                                            <div className="font-bold text-sm">演算法去背</div>
                                            <div className={`text-xs ${processingMode === 'algorithm' ? 'text-white/70' : 'text-gray-400'}`}>瀏覽器端處理</div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => { setProcessingMode('ai'); setIsSettingsOpen(false); }}
                                        disabled={isAIAvailable === false}
                                        className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-colors ${processingMode === 'ai'
                                            ? 'bg-black text-white'
                                            : isAIAvailable === false
                                                ? 'opacity-50 cursor-not-allowed text-gray-400'
                                                : 'hover:bg-gray-50 text-gray-700'}`}
                                    >
                                        <div className={`w-3 h-3 rounded-full border-2 ${processingMode === 'ai' ? 'bg-white border-white' : 'border-gray-300'}`} />
                                        <div>
                                            <div className="font-bold text-sm flex items-center gap-2">
                                                AI 去背
                                                {isAIAvailable === null && <span className="text-[10px] text-gray-400">(檢測中...)</span>}
                                                {isAIAvailable === false && <span className="text-[10px] text-red-400">(離線)</span>}
                                                {isAIAvailable === true && <span className="text-[10px] text-green-500">(可用)</span>}
                                            </div>
                                            <div className={`text-xs ${processingMode === 'ai' ? 'text-white/70' : 'text-gray-400'}`}>ComfyUI 伺服器處理</div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Canvas Area */}
                <div className="flex-1 bg-[url('https://repo.sourcelib.xyz/checker-bg.png')] flex items-center justify-center relative group p-10 overflow-hidden select-none">
                    {selectedImage ? (
                        <>
                            {/* Nav Buttons */}
                            <button
                                onClick={handlePrevImage}
                                className="absolute left-6 top-1/2 -translate-y-1/2 p-3 bg-white hover:bg-gray-50 text-black rounded-full shadow-xl transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0 active:scale-95 border border-gray-100 z-50"
                                disabled={images.indexOf(selectedImage) === 0}
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <button
                                onClick={handleNextImage}
                                className="absolute right-6 top-1/2 -translate-y-1/2 p-3 bg-white hover:bg-gray-50 text-black rounded-full shadow-xl transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0 active:scale-95 border border-gray-100 z-50"
                                disabled={images.indexOf(selectedImage) === images.length - 1}
                            >
                                <ArrowRight size={20} />
                            </button>

                            {/* Comparison Slider Container */}
                            <div
                                className={`relative shadow-2xl rounded-lg overflow-hidden bg-white select-none ${isEyedropperActive ? 'cursor-crosshair' : 'cursor-ew-resize'}`}
                                ref={containerRef}
                                onMouseDown={handleMouseDown}
                                onTouchStart={handleTouchStart}
                            >
                                {/* 0. Layout Anchor (Invoice/Opacity-0) - Always Original Image to define container size */}
                                <img
                                    src={selectedImage.previewUrl}
                                    className="block max-h-[85vh] max-w-[85vw] w-auto h-auto opacity-0 pointer-events-none select-none"
                                    aria-hidden="true"
                                    alt="Layout Anchor"
                                />

                                {/* 1. Result Layer (Bottom) - Absolute, fills container */}
                                {/* Hide Result Layer if Eyedropper is active to show full original for picking */}
                                <div className={`absolute inset-0 flex items-center justify-center ${isEyedropperActive ? 'opacity-0' : 'opacity-100'}`}>
                                    <img
                                        src={selectedImage.status === 'success' && selectedImage.resultUrl ? selectedImage.resultUrl : selectedImage.previewUrl}
                                        className="w-full h-full object-contain pointer-events-none select-none"
                                        draggable={false}
                                        alt="Result"
                                    />
                                </div>

                                {/* 2. Original Layer (Top) - Clipped Overlay */}
                                {/* If Eyedropper is active, show Full Original (no clip) to allow picking from anywhere */}
                                <div
                                    className="absolute inset-0 overflow-hidden pointer-events-none select-none"
                                    style={{ clipPath: isEyedropperActive ? 'inset(0 0 0 0)' : `inset(0 ${100 - sliderPosition}% 0 0)` }}
                                >
                                    <img
                                        src={selectedImage.previewUrl}
                                        className="w-full h-full object-contain pointer-events-none select-none"
                                        draggable={false}
                                        alt="Original"
                                    />
                                </div>

                                {/* Labels - Moved outside to prevent clipping */}
                                <div className="absolute top-4 left-4 bg-black/80 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg pointer-events-none z-20">
                                    原始圖片
                                </div>

                                {/* Result Label (On bottom layer) */}
                                {selectedImage.status === 'success' && (
                                    <div className="absolute top-4 right-4 bg-black/80 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg pointer-events-none">
                                        去背結果
                                    </div>
                                )}

                                {/* 3. Slider Handle */}
                                {selectedImage.status === 'success' && (
                                    <div
                                        className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-20 shadow-[0_0_10px_rgba(0,0,0,0.3)] pointer-events-none"
                                        style={{ left: `${sliderPosition}%` }}
                                    >
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-900 border border-gray-200">
                                            <div className="flex gap-[-2px]">
                                                <ChevronsLeft size={10} strokeWidth={3} className="-mr-1" />
                                                <ChevronsRight size={10} strokeWidth={3} className="-ml-1" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Loading Overlay */}
                                {selectedImage.status === 'processing' && (
                                    <div className="absolute inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center z-30 pointer-events-none">
                                        <div className="bg-white p-4 rounded-2xl shadow-2xl flex flex-col items-center gap-3">
                                            <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
                                            <span className="font-bold text-xs text-black">去除背景中...</span>
                                        </div>
                                    </div>
                                )}

                                {/* Error Overlay */}
                                {selectedImage.status === 'error' && (
                                    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                                        <div className="bg-red-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg font-bold text-sm">
                                            <AlertCircle size={18} />
                                            處理失敗
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="text-center opacity-40 flex flex-col items-center gap-4 select-none">
                            <div className="p-6 bg-gray-100 rounded-full border-2 border-dashed border-gray-300">
                                <ImageIcon size={48} className="text-gray-400" />
                            </div>
                            <p className="text-lg font-bold text-gray-400">請選擇圖片以開始預覽</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
