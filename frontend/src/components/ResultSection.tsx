import React, { useState, useEffect } from 'react';
import { GeneratedImage } from '../types';
import { Download, Trash2, RefreshCw, Layout, Layers, Box, FolderOpen, Star, Database, Edit2, Check, X, ZoomIn } from 'lucide-react';
import JSZip from 'jszip';
import { resizeImage } from '../services/imageProcessingService';
import {
    DndContext,
    DragOverlay,
    useDraggable,
    useDroppable,
    DragEndEvent,
    DragStartEvent,
    useSensor,
    useSensors,
    PointerSensor
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface ResultSectionProps {
    results: GeneratedImage[];
    onDelete: (id: string) => void;
    onRegenerate: (id: string, refinePrompt?: string) => void;
    onUpdateOptions: (id: string, options: Partial<GeneratedImage['downloadOptions']>) => void;
    onUpdatePackName: (batchId: string, newName: string) => void;
    onMoveImageToPack: (imageId: string, targetBatchId: string) => void;
}

// --- Lightbox Component ---
const ImageLightbox: React.FC<{ image: GeneratedImage | null; onClose: () => void }> = ({ image, onClose }) => {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        if (image && image.originalImageBlob) {
            const newUrl = URL.createObjectURL(image.originalImageBlob);
            setUrl(newUrl);
            return () => URL.revokeObjectURL(newUrl);
        }
    }, [image]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    if (!image || !url) return null;

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
            >
                <X size={24} />
            </button>

            <div
                className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
                onClick={(e) => e.stopPropagation()}
            >
                <img
                    src={url}
                    alt={image.expressionName}
                    className="max-w-full max-h-[80vh] object-contain drop-shadow-2xl rounded-lg bg-[url('https://raw.githubusercontent.com/transparent-textures/patterns/master/patterns/transparent-square-tiles.png')] bg-repeat"
                />
                <div className="mt-4 text-center">
                    <h3 className="text-white text-xl font-bold">{image.expressionName}</h3>
                    <p className="text-gray-400 text-sm mt-1">{image.styleName}</p>
                </div>
            </div>
        </div>
    );
};

// --- Regenerate Modal Component ---
const RegenerateModal: React.FC<{
    isOpen: boolean;
    image: GeneratedImage | null;
    onClose: () => void;
    onConfirm: (prompt: string) => void;
}> = ({ isOpen, image, onClose, onConfirm }) => {
    const [prompt, setPrompt] = useState('');

    useEffect(() => {
        if (isOpen) setPrompt(''); // Reset prompt on open
    }, [isOpen]);

    if (!isOpen || !image) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <RefreshCw size={18} className="text-blue-500" />
                        微調並重新生成
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    <div className="mb-4">
                        <span className="text-xs font-bold text-gray-400 uppercase">目標表情</span>
                        <p className="text-lg font-bold text-gray-800">{image.expressionName}</p>
                    </div>

                    <div className="mb-2">
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            額外調整指令 (選填)
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="例如：把眼睛畫大一點、手不要遮住臉、動作再誇張一點..."
                            className="w-full h-24 p-3 text-sm border border-gray-300 rounded-xl focus:border-blue-400 focus:ring-4 focus:ring-blue-100 outline-none resize-none bg-white placeholder-gray-400 transition-all"
                            autoFocus
                        />
                        <p className="text-xs text-gray-400 mt-2">若留空，將單純依照原設定重新生成。</p>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        取消
                    </button>
                    <button
                        onClick={() => onConfirm(prompt)}
                        className="px-5 py-2 text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 rounded-lg shadow-sm shadow-blue-200 flex items-center gap-2 transition-transform active:scale-95"
                    >
                        <RefreshCw size={16} />
                        {prompt.trim() ? '帶指令生成' : '直接生成'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Draggable Image Card ---
const DraggableImageCard: React.FC<{
    img: GeneratedImage;
    onDelete: (id: string) => void;
    onRegenerateClick: (img: GeneratedImage) => void;
    onUpdateOptions: (id: string, options: Partial<GeneratedImage['downloadOptions']>) => void;
    onViewImage: (img: GeneratedImage) => void;
    isOverlay?: boolean;
}> = ({ img, onDelete, onRegenerateClick, onUpdateOptions, onViewImage, isOverlay }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: img.id,
        data: { batchId: img.batchId }
    });

    const style = transform ? {
        transform: CSS.Translate.toString(transform),
    } : undefined;

    const isCompleted = img.status === 'completed';
    const isMainSelected = img.downloadOptions.includeMain;
    const isLabelSelected = img.downloadOptions.includeTab;
    const itemTimeStr = new Date(img.createdAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: true });

    // Handle Image Download
    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!img.originalImageBlob) return;

        const downloadBlob = async (blob: Blob, suffix: string = '') => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${img.expressionName}${suffix}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        await downloadBlob(img.originalImageBlob, '');

        if (img.downloadOptions.includeMain) {
            const mainBlob = await resizeImage(img.originalImageBlob, 240, 240);
            await downloadBlob(mainBlob, '_main');
        }

        if (img.downloadOptions.includeTab) {
            const tabBlob = await resizeImage(img.originalImageBlob, 96, 74);
            await downloadBlob(tabBlob, '_tab');
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`group relative bg-white rounded-xl overflow-hidden border transition-all duration-300 flex flex-col 
                ${isOverlay ? 'shadow-2xl scale-75 rotate-2 z-50 cursor-grabbing ring-4 ring-gray-200 opacity-90' : 'hover:shadow-lg cursor-grab active:cursor-grabbing'}
                ${isDragging ? 'opacity-0' : 'opacity-100'}
                ${isCompleted ? 'border-gray-900' : 'border-gray-200'}
            `}
        >
            {/* Top Left Badges */}
            <div className="absolute top-2 left-2 flex flex-col gap-1 z-10 pointer-events-none">
                {isMainSelected && <span className="bg-black text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm"><Star size={10} fill="currentColor" />主圖</span>}
                {isLabelSelected && <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm"><Layers size={10} />標籤</span>}
            </div>

            {/* Top Right Controls (StopPropagation for non-drag actions) */}
            <div
                className="absolute top-2 right-2 flex flex-col gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 md:opacity-100"
                onPointerDown={(e) => e.stopPropagation()}
            >
                <button onClick={(e) => { e.stopPropagation(); onDelete(img.id); }} className="w-7 h-7 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 border border-gray-100 shadow-sm transition-colors" title="刪除"><Trash2 size={14} /></button>
                <button onClick={(e) => { e.stopPropagation(); onRegenerateClick(img); }} className="w-7 h-7 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-full text-gray-400 hover:text-blue-500 hover:bg-blue-50 border border-gray-100 shadow-sm transition-colors" title="重新生成"><RefreshCw size={14} /></button>
            </div>

            {/* Image Display Area */}
            <div
                className={`h-64 flex items-center justify-center p-4 bg-gray-50/30 relative overflow-hidden ${isCompleted ? 'cursor-zoom-in' : ''}`}
                onClick={(e) => {
                    if (isCompleted) {
                        e.stopPropagation(); // prevent drag start if clicking image directly? No, image is main drag handle usually.
                        // Actually, we want click to view lightbox, but drag to move.
                        // dnd-kit handles this usually.
                        onViewImage(img);
                    }
                }}
            >
                {img.status === 'processing' && <div className="flex flex-col items-center text-blue-600 animate-pulse"><RefreshCw className="animate-spin mb-2" size={24} /><span className="text-xs font-medium">生成中...</span></div>}
                {img.status === 'pending' && <span className="text-gray-300 text-xs">等待中...</span>}
                {img.status === 'failed' && <span className="text-red-400 text-xs text-center px-1">生成失敗</span>}
                {isCompleted && img.originalImageBlob && (
                    <>
                        {/* We use pointer-events-none on image so drag event bubbles to container */}
                        <img src={URL.createObjectURL(img.originalImageBlob)} alt={img.expressionName} className="w-full h-full object-contain drop-shadow-sm pointer-events-none" />
                        {!isOverlay && (
                            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[1px]">
                                <div className="bg-white/90 rounded-full p-2 shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform"><ZoomIn size={20} className="text-gray-700" /></div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Info */}
            <div className="px-4 mt-2 flex justify-between items-baseline">
                <h3 className="text-base font-bold text-gray-800 truncate pr-2" title={img.expressionName}>{img.expressionName}</h3>
                <span className="text-gray-400 text-xs whitespace-nowrap font-mono">{itemTimeStr}</span>
            </div>

            {/* Bottom Action Buttons (StopPropagation) */}
            <div
                className="p-4 grid grid-cols-3 gap-3 mt-auto"
                onPointerDown={(e) => e.stopPropagation()}
            >
                <button onClick={handleDownload} disabled={!isCompleted} className="aspect-square flex flex-col items-center justify-center gap-1 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-gray-200">
                    <Download size={20} /> <span className="text-xs font-medium">下載</span>
                </button>
                <button onClick={(e) => { e.stopPropagation(); onUpdateOptions(img.id, { includeMain: !isMainSelected }) }} className={`aspect-square flex flex-col items-center justify-center gap-1 rounded-lg transition-all ${isMainSelected ? 'bg-black text-white shadow-md' : 'bg-white border border-black text-black hover:bg-gray-50'}`}>
                    <Layout size={20} /> <span className="text-xs font-medium">主圖</span>
                </button>
                <button onClick={(e) => { e.stopPropagation(); onUpdateOptions(img.id, { includeTab: !isLabelSelected }) }} className={`aspect-square flex flex-col items-center justify-center gap-1 rounded-lg transition-all ${isLabelSelected ? 'bg-blue-500 text-white shadow-md shadow-blue-200' : 'bg-white border border-blue-500 text-blue-600 hover:bg-blue-50'}`}>
                    <Layers size={20} /> <span className="text-xs font-medium">標籤</span>
                </button>
            </div>
        </div>
    );
}

// --- Droppable Batch Group ---
const BatchGroup: React.FC<{
    batchId: string;
    groupImages: GeneratedImage[];
    onDelete: (id: string) => void;
    onRegenerateClick: (img: GeneratedImage) => void;
    onUpdateOptions: (id: string, options: Partial<GeneratedImage['downloadOptions']>) => void;
    onUpdatePackName: (batchId: string, newName: string) => void;
    onViewImage: (img: GeneratedImage) => void;
}> = ({ batchId, groupImages, onDelete, onRegenerateClick, onUpdateOptions, onUpdatePackName, onViewImage }) => {

    const [isEditing, setIsEditing] = useState(false);
    const firstImg = groupImages[0];
    const date = new Date(firstImg.createdAt);
    const timeStr = date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: true });

    const displayName = firstImg.batchName || `${firstImg.styleName} (${timeStr})`;
    const [tempName, setTempName] = useState(displayName);
    const zipName = `${displayName}.zip`;

    // Drop Zone Setup
    const { isOver, setNodeRef } = useDroppable({
        id: batchId,
    });

    const handleSaveName = () => {
        if (tempName.trim() !== '') {
            onUpdatePackName(batchId, tempName.trim());
        } else {
            setTempName(displayName);
        }
        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setTempName(displayName);
        setIsEditing(false);
    };

    const handleDownloadZip = async () => {
        if (groupImages.length === 0) return;

        const zip = new JSZip();
        const folder = zip.folder("stickers");
        if (!folder) return;

        for (const img of groupImages) {
            if (img.status !== 'completed' || !img.originalImageBlob) continue;
            folder.file(`${img.expressionName}.png`, img.originalImageBlob);
            if (img.downloadOptions.includeMain) {
                const b = await resizeImage(img.originalImageBlob, 240, 240);
                folder.file(`${img.expressionName}_main.png`, b);
            }
            if (img.downloadOptions.includeTab) {
                const b = await resizeImage(img.originalImageBlob, 96, 74);
                folder.file(`${img.expressionName}_tab.png`, b);
            }
        }

        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = zipName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div
            ref={setNodeRef}
            className={`p-6 rounded-xl shadow-sm border transition-all duration-300
                ${isOver ? 'bg-gray-50 border-gray-400 ring-4 ring-gray-100' : 'bg-white border-gray-100'}
            `}
        >
            {/* Group Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-4 border-b border-gray-100 gap-4">
                <div className="flex items-center gap-3 flex-1 overflow-hidden">
                    <FolderOpen className={`shrink-0 ${isOver ? 'text-gray-900 scale-110' : 'text-gray-400'} transition-all`} size={24} />
                    <div className="flex-1 min-w-0">
                        {isEditing ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={tempName}
                                    onChange={(e) => setTempName(e.target.value)}
                                    className="border border-gray-300 rounded px-2 py-1 text-lg font-bold text-gray-800 outline-none focus:ring-4 focus:ring-gray-100 focus:border-gray-400 transition-all w-full max-w-sm"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveName();
                                        if (e.key === 'Escape') handleCancelEdit();
                                    }}
                                />
                                <button onClick={handleSaveName} className="p-1.5 bg-green-100 text-green-700 rounded-md hover:bg-green-200"><Check size={16} /></button>
                                <button onClick={handleCancelEdit} className="p-1.5 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200"><X size={16} /></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 group">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2 text-lg truncate">
                                    {displayName}
                                    <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full font-normal shrink-0">{groupImages.length} 張</span>
                                </h3>
                                <button onClick={() => { setTempName(displayName); setIsEditing(true); }} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-blue-500 p-1"><Edit2 size={14} /></button>
                            </div>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">最新更新: {new Date(Math.max(...groupImages.map(i => i.createdAt))).toLocaleString('zh-TW')}</p>
                    </div>
                </div>

                <div className="flex gap-2 shrink-0">
                    <button onClick={handleDownloadZip} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-gray-800 transition-colors">
                        <Box size={16} /> 下載 ZIP
                    </button>
                    <button onClick={() => { if (window.confirm('確定要刪除整組貼圖嗎？')) groupImages.forEach(img => onDelete(img.id)); }} className="text-gray-400 hover:text-red-500 p-2">
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                {groupImages.map((img) => (
                    <DraggableImageCard
                        key={img.id}
                        img={img}
                        onDelete={onDelete}
                        onRegenerateClick={onRegenerateClick}
                        onUpdateOptions={onUpdateOptions}
                        onViewImage={onViewImage}
                    />
                ))}
            </div>
        </div>
    );
};

export const ResultSection: React.FC<ResultSectionProps> = ({
    results,
    onDelete,
    onRegenerate,
    onUpdateOptions,
    onUpdatePackName,
    onMoveImageToPack
}) => {
    const [viewingImage, setViewingImage] = useState<GeneratedImage | null>(null);
    const [regeneratingImage, setRegeneratingImage] = useState<GeneratedImage | null>(null);
    const [activeDragItem, setActiveDragItem] = useState<GeneratedImage | null>(null);

    // Group by Batch ID
    const groupedResults = React.useMemo(() => {
        const groups: Record<string, GeneratedImage[]> = {};
        results.forEach(img => {
            if (!groups[img.batchId]) {
                groups[img.batchId] = [];
            }
            groups[img.batchId].push(img);
        });
        return Object.entries(groups).sort((a, b) => {
            const maxA = Math.max(...a[1].map(i => i.createdAt));
            const maxB = Math.max(...b[1].map(i => i.createdAt));
            return maxB - maxA;
        });
    }, [results]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Require 8px movement to start drag (prevents accidental clicks)
            },
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        const img = results.find(r => r.id === active.id);
        if (img) setActiveDragItem(img);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveDragItem(null);

        if (!over) return;

        const activeId = active.id as string;
        const targetBatchId = over.id as string;

        const currentImg = results.find(r => r.id === activeId);

        // Only move if dropped in a different batch
        if (currentImg && currentImg.batchId !== targetBatchId) {
            onMoveImageToPack(activeId, targetBatchId);
        }
    };

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="flex flex-col gap-6">
                <ImageLightbox
                    image={viewingImage}
                    onClose={() => setViewingImage(null)}
                />

                <RegenerateModal
                    isOpen={!!regeneratingImage}
                    image={regeneratingImage}
                    onClose={() => setRegeneratingImage(null)}
                    onConfirm={(prompt) => {
                        if (regeneratingImage) {
                            onRegenerate(regeneratingImage.id, prompt);
                            setRegeneratingImage(null);
                        }
                    }}
                />

                {/* Header Section */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                        <span className="text-gray-800">貼圖歷史紀錄 (分組)</span>
                    </h2>
                    <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg flex items-center gap-2 text-sm text-gray-600">
                        <Database size={16} />
                        <span>您可以**長按並拖曳**貼圖來整理群組。圖片已自動儲存於瀏覽器資料庫中。</span>
                    </div>
                </div>

                {groupedResults.length === 0 ? (
                    <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-gray-300 min-h-[400px]">
                        <Layout size={64} className="mb-4 opacity-50" />
                        <p>尚未生成貼圖。您的創作會依據貼圖包自動分組。</p>
                    </div>
                ) : (
                    groupedResults.map(([batchId, groupImages]) => (
                        <BatchGroup
                            key={batchId}
                            batchId={batchId}
                            groupImages={groupImages}
                            onDelete={onDelete}
                            onRegenerateClick={setRegeneratingImage}
                            onUpdateOptions={onUpdateOptions}
                            onUpdatePackName={onUpdatePackName}
                            onViewImage={setViewingImage}
                        />
                    ))
                )}

                {/* Drag Overlay */}
                <DragOverlay>
                    {activeDragItem ? (
                        <DraggableImageCard
                            img={activeDragItem}
                            onDelete={() => { }} // No-op during drag
                            onRegenerateClick={() => { }}
                            onUpdateOptions={() => { }}
                            onViewImage={() => { }}
                            isOverlay
                        />
                    ) : null}
                </DragOverlay>
            </div>
        </DndContext>
    );
};