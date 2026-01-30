import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Upload, X, Download, Play, Check, AlertCircle, Image as ImageIcon, Trash2, ArrowRight } from 'lucide-react';
import { removeBackground } from '../services/imageProcessingService';
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
    const [viewMode, setViewMode] = useState<'compare' | 'result'>('compare'); // compare: split/toggle, result: single

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Auto-select first image when added
    useEffect(() => {
        if (images.length > 0 && !selectedImageId) {
            setSelectedImageId(images[0].id);
        } else if (images.length === 0) {
            setSelectedImageId(null);
        }
    }, [images, selectedImageId]);

    // --- Handlers ---

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
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
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
                // Using the existing service
                const resultUrl = await removeBackground(dataUrl);

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

    // --- Render ---
    const selectedImage = images.find(img => img.id === selectedImageId);

    return (
        <div className="min-h-[calc(100vh-100px)] flex flex-col gap-6 animate-in fade-in duration-500">

            {/* Header Removed */}

            <div className="flex flex-col lg:flex-row gap-6 h-[700px]">
                {/* Left: Upload & List Area */}
                <div className="w-full lg:w-[320px] flex flex-col gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200 h-full">

                    {/* Upload Box */}
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`
                flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all h-32 flex-shrink-0
                ${isDragging ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-green-400 hover:bg-gray-50'}
              `}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            multiple
                            accept="image/png, image/jpeg, image/webp"
                            onChange={handleFileSelect}
                        />
                        <Upload className="text-gray-400 mb-2" size={24} />
                        <p className="text-sm text-gray-500 font-medium">點擊或拖放上傳圖片</p>
                    </div>

                    {/* Controls */}
                    {images.length > 0 && (
                        <div className="flex gap-2">
                            <button
                                onClick={handleStartProcessing}
                                disabled={isProcessing || !images.some(img => img.status === 'idle' || img.status === 'error')}
                                className="flex-1 bg-gray-900 text-white py-2 rounded-lg font-bold text-sm hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
                            >
                                {isProcessing ? (
                                    <span className="animate-pulse">處理中... {progress.current}/{progress.total}</span>
                                ) : (
                                    <>
                                        <Play size={16} fill="currentColor" />
                                        開始去背
                                    </>
                                )}
                            </button>
                            <button
                                onClick={handleClearAll}
                                disabled={isProcessing}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="清除全部"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    )}

                    {/* List */}
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-gray-200">
                        {images.map((img) => (
                            <div
                                key={img.id}
                                onClick={() => handleSelectImage(img.id)}
                                className={`
                     flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-all group
                     ${selectedImageId === img.id ? 'bg-green-50 border-green-200 ring-1 ring-green-200' : 'bg-gray-50 border-transparent hover:bg-gray-100'}
                   `}
                            >
                                <div className="w-10 h-10 rounded bg-white border border-gray-200 overflow-hidden flex-shrink-0 relative">
                                    <img src={img.previewUrl} className="w-full h-full object-cover" />
                                    {img.status === 'success' && (
                                        <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center text-white">
                                            <Check size={12} strokeWidth={4} />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-medium truncate ${selectedImageId === img.id ? 'text-green-800' : 'text-gray-700'}`}>
                                        {img.file.name}
                                    </p>
                                    <p className="text-[10px] text-gray-400">
                                        {img.status === 'idle' && '等待處理'}
                                        {img.status === 'processing' && <span className="text-amber-500">處理中...</span>}
                                        {img.status === 'success' && <span className="text-green-600">完成</span>}
                                        {img.status === 'error' && <span className="text-red-500">失敗</span>}
                                    </p>
                                </div>
                                <button
                                    onClick={(e) => handleRemoveImage(img.id, e)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                        {images.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm opacity-60">
                                <ImageIcon size={32} className="mb-2" />
                                <p>尚未加入圖片</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Main Preview Area */}
                <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">

                    {/* Preview Toolbar */}
                    <div className="h-14 border-b border-gray-100 flex items-center justify-between px-4 bg-gray-50/50">
                        <div className="flex items-center gap-4 text-sm font-medium text-gray-600">
                            <span>預覽模式：</span>
                            <div className="flex bg-gray-200 rounded-lg p-1">
                                <button
                                    onClick={() => setViewMode('compare')}
                                    className={`px-3 py-1 rounded-md text-xs transition-all ${viewMode === 'compare' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    對照比較
                                </button>
                                <button
                                    onClick={() => setViewMode('result')}
                                    className={`px-3 py-1 rounded-md text-xs transition-all ${viewMode === 'result' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    僅顯示結果
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {images.some(img => img.status === 'success') && (
                                <button
                                    onClick={handleDownloadAll}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm text-sm font-medium"
                                    title="下載全部處理完成圖片"
                                >
                                    <Download size={16} />
                                    <span className="hidden sm:inline">下載全部 ({images.filter(img => img.status === 'success').length})</span>
                                </button>
                            )}

                            {selectedImage?.status === 'success' && (
                                <button
                                    onClick={() => handleDownloadSingle(selectedImage)}
                                    className="flex items-center gap-2 bg-black text-white hover:bg-gray-800 font-bold text-sm px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                                >
                                    <Download size={16} />
                                    <span className="hidden sm:inline">下載此張</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Main Viewer */}
                    <div className="flex-1 bg-[url('https://repo.sourcelib.xyz/checker-bg.png')] flex items-center justify-center relative group p-8">

                        {selectedImage ? (
                            <>
                                {/* Previous Button */}
                                <button
                                    onClick={handlePrevImage}
                                    className="absolute left-4 z-10 p-3 bg-white/80 hover:bg-white text-gray-700 rounded-full shadow-lg backdrop-blur mx-2 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0"
                                    disabled={images.indexOf(selectedImage) === 0}
                                >
                                    <ArrowLeft size={24} />
                                </button>

                                {/* Image Display */}
                                <div className="relative max-w-full max-h-full flex items-center justify-center shadow-2xl rounded-lg overflow-hidden bg-white/10 backdrop-blur-sm border border-white/20">

                                    {/* 1. Compare Mode: Side by Side if space permits, otherwise use a slider concept? 
                        Let's implement a simple "Hover to Reveal" or "Side by Side"
                        The user asked for "Single image view", which implies focusing on one.
                        
                        Let's do a simple implementation:
                        If 'compare': Show Original on Left (or opacity overlay), Result on Right.
                        Actually, 'compare' usually means "Original" vs "Result".
                        A split slider is best, but let's stick to simple side-by-side or toggle.
                        Let's do: Hover original to see result? Or Click to toggle?
                        User asked for: "can switch next/prev", "single result view".
                      */}

                                    {/* IMPLEMENTATION: If compare mode, we show Toggle. If result mode, just result (or original if not done) */}

                                    {viewMode === 'compare' ? (
                                        <div className="relative group/compare cursor-crosshair">
                                            {/* Base: Original */}
                                            <img
                                                src={selectedImage.previewUrl}
                                                className="max-h-[500px] object-contain"
                                                alt="Original"
                                            />

                                            {/* Overlay: Result (Only if success) */}
                                            {selectedImage.status === 'success' && selectedImage.resultUrl && (
                                                <div className="absolute inset-0 opacity-0 group-hover/compare:opacity-100 transition-opacity duration-300">
                                                    <img
                                                        src={selectedImage.resultUrl}
                                                        className="w-full h-full object-contain"
                                                        alt="Result"
                                                    />
                                                    <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded pointer-events-none">
                                                        去背結果
                                                    </div>
                                                </div>
                                            )}

                                            {selectedImage.status === 'success' && (
                                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-xs font-medium pointer-events-none group-hover/compare:opacity-0 transition-opacity">
                                                    按住/懸停 查看結果
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <img
                                            src={selectedImage.status === 'success' ? selectedImage.resultUrl : selectedImage.previewUrl}
                                            className="max-h-[550px] object-contain"
                                            alt="View"
                                        />
                                    )}

                                    {/* Status Overlay */}
                                    {selectedImage.status === 'processing' && (
                                        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-20">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                                                <span className="font-bold text-green-700">AI 去背處理中...</span>
                                            </div>
                                        </div>
                                    )}

                                    {selectedImage.status === 'error' && (
                                        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                                            <div className="bg-red-500/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg">
                                                <AlertCircle size={20} />
                                                處理失敗
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Next Button */}
                                <button
                                    onClick={handleNextImage}
                                    className="absolute right-4 z-10 p-3 bg-white/80 hover:bg-white text-gray-700 rounded-full shadow-lg backdrop-blur mx-2 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0"
                                    disabled={images.indexOf(selectedImage) === images.length - 1}
                                >
                                    <ArrowRight size={24} />
                                </button>
                            </>
                        ) : (
                            <div className="text-center text-gray-400">
                                <p className="text-lg">請選擇或上傳圖片</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div >
    );
};
