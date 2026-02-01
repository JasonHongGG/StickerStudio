import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Trash2, Plus, Archive, Pipette, Palette, Brush, ArrowLeft, ArrowRight, Download, Eraser } from 'lucide-react';
import JSZip from 'jszip';
import { CustomColorPicker } from './ui/CustomColorPicker';

interface ImagePaintToolProps { }

interface ImageItem {
    id: string;
    file: File;
    previewUrl: string;
    drawingDataUrl?: string; // Saved drawing layer
    status: 'idle' | 'edited';
    transformState?: {
        scale: number;
        x: number;
        y: number;
    };
}

export const ImagePaintTool: React.FC<ImagePaintToolProps> = () => {
    // --- State ---
    const [images, setImages] = useState<ImageItem[]>([]);
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

    // Tool State
    const [brushColor, setBrushColor] = useState('#ffffff');
    const [brushSize, setBrushSize] = useState(20);
    const [activeTool, setActiveTool] = useState<'brush' | 'eraser' | 'eyedropper'>('brush');
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

    // Canvas State
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const isPanning = useRef(false);
    const isDrawing = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const cursorRef = useRef<HTMLDivElement>(null);
    const [isHovering, setIsHovering] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Auto-select first image
    useEffect(() => {
        if (images.length > 0 && !selectedImageId) {
            setSelectedImageId(images[0].id);
        } else if (images.length === 0) {
            setSelectedImageId(null);
        }
    }, [images, selectedImageId]);

    const selectedImage = images.find(img => img.id === selectedImageId);
    const selectedIndex = images.findIndex(img => img.id === selectedImageId);

    // --- Canvas Logic ---

    // Initialize Canvas on Image Load/Select
    useEffect(() => {
        if (!selectedImageId || !canvasRef.current || !containerRef.current) return;

        const imgItem = images.find(i => i.id === selectedImageId);
        if (!imgItem) return;

        const img = new Image();
        img.src = imgItem.previewUrl || '';
        img.onload = () => {
            // Restore Transform if exists, else Auto-Fit
            if (imgItem.transformState) {
                setScale(imgItem.transformState.scale);
                setPosition({ x: imgItem.transformState.x, y: imgItem.transformState.y });
            } else {
                // Fit logic
                const container = containerRef.current!;
                const scaleX = container.clientWidth / img.naturalWidth;
                const scaleY = container.clientHeight / img.naturalHeight;
                const fitScale = Math.min(scaleX, scaleY) * 0.95;

                setScale(fitScale);
                setPosition({ x: 0, y: 0 }); // Center
            }

            // Setup Canvas size to match image resolution
            const canvas = canvasRef.current!;
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;

            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                // Restore drawing if exists
                const savedDrawing = imgItem.drawingDataUrl;
                if (savedDrawing) {
                    const drawImg = new Image();
                    drawImg.src = savedDrawing;
                    drawImg.onload = () => ctx.drawImage(drawImg, 0, 0);
                }
            }
        };
    }, [selectedImageId]);

    // Save drawing to state on change (debounced or on unmount/switch would be better, but explicit save is easier)
    // For now, we save on mouse up.

    // Save drawing to state on change (debounced or on unmount/switch would be better, but explicit save is easier)
    // For now, we save on mouse up.

    const saveDrawingState = () => {
        if (!selectedImageId || !canvasRef.current) return;
        const dataUrl = canvasRef.current.toDataURL();
        setImages(prev => prev.map(img =>
            img.id === selectedImageId ? { ...img, drawingDataUrl: dataUrl, status: 'edited' } : img
        ));
    };

    const saveCurrentState = (targetId: string) => {
        setImages(prev => prev.map(img =>
            img.id === targetId ? {
                ...img,
                transformState: { scale, x: position.x, y: position.y }
            } : img
        ));
    };

    // --- Handlers ---

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) addImages(e.target.files);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const addImages = (fileList: FileList) => {
        const newImages: ImageItem[] = Array.from(fileList).map(file => ({
            id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file,
            previewUrl: URL.createObjectURL(file),
            status: 'idle'
        }));
        setImages(prev => [...prev, ...newImages]);
    };

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
    };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) addImages(e.dataTransfer.files);
    };

    const handleRemoveImage = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setImages(prev => {
            const target = prev.find(img => img.id === id);
            if (target) URL.revokeObjectURL(target.previewUrl);
            const remaining = prev.filter(img => img.id !== id);
            if (selectedImageId === id) setSelectedImageId(remaining.length > 0 ? remaining[0].id : null);
            return remaining;
        });
    };

    const handleClearAll = () => {
        images.forEach(img => URL.revokeObjectURL(img.previewUrl));
        setImages([]);
        setSelectedImageId(null);
    };

    // --- Navigation Handlers ---
    // --- Navigation Handlers ---
    const handleSelectImage = (id: string) => {
        if (selectedImageId) saveCurrentState(selectedImageId);
        setSelectedImageId(id);
    };

    const handlePrevImage = () => {
        if (selectedIndex > 0) {
            if (selectedImageId) saveCurrentState(selectedImageId);
            setSelectedImageId(images[selectedIndex - 1].id);
        }
    };

    const handleNextImage = () => {
        if (selectedIndex < images.length - 1) {
            if (selectedImageId) saveCurrentState(selectedImageId);
            setSelectedImageId(images[selectedIndex + 1].id);
        }
    };

    // --- Interaction ---

    const getCanvasPoint = (e: React.MouseEvent) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        // We know the canvas is transformed by CSS: translate(posX, posY) scale(scale)
        // And centered in container? No, we used absolute positioning center in CSS previously but here we might need consistent logic.
        // Let's assume the canvas is rendered nicely.

        // Actually, getting precise coordinates on a transformed element is tricky.
        // Easiest is to use the bounding client rect of the canvas itself.
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / (rect.width / canvasRef.current.width);
        const y = (e.clientY - rect.top) / (rect.height / canvasRef.current.height);
        return { x, y };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!selectedImage) return;
        e.preventDefault();

        // Eyedropper Mode
        if (activeTool === 'eyedropper') {
            pickColor(e);
            setActiveTool('brush');
            return;
        }

        // Spacebar or Middle Click -> Pan
        if (e.button === 1 || e.shiftKey) { // Simple pan trigger
            isPanning.current = true;
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            return;
        }

        // Draw
        isDrawing.current = true;
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            const { x, y } = getCanvasPoint(e);
            ctx.globalCompositeOperation = activeTool === 'eraser' ? 'destination-out' : 'source-over';
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.strokeStyle = brushColor;
            ctx.lineWidth = brushSize;
            ctx.lineTo(x, y); // Dot
            ctx.stroke();
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        // Update Cursor Position directly for performance
        if (cursorRef.current) {
            cursorRef.current.style.left = `${e.clientX}px`;
            cursorRef.current.style.top = `${e.clientY}px`;
        }

        if (isPanning.current) {
            const deltaX = e.clientX - lastMousePos.current.x;
            const deltaY = e.clientY - lastMousePos.current.y;
            setPosition(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            return;
        }

        if (isDrawing.current && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                const { x, y } = getCanvasPoint(e);
                ctx.lineTo(x, y);
                ctx.stroke();
            }
        }
    };

    const handleMouseUp = () => {
        if (isDrawing.current) {
            isDrawing.current = false;
            const ctx = canvasRef.current?.getContext('2d');
            ctx?.closePath();
            saveDrawingState();
        }
        isPanning.current = false;
    };

    const handleMouseEnter = () => setIsHovering(true);
    const handleMouseLeave = () => {
        setIsHovering(false);
        handleMouseUp();
    };

    const pickColor = (e: React.MouseEvent) => {
        if (!selectedImage) return;

        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = selectedImage.previewUrl;

        img.onload = () => {
            const offCanvas = document.createElement('canvas');
            offCanvas.width = img.naturalWidth;
            offCanvas.height = img.naturalHeight;
            const ctx = offCanvas.getContext('2d');
            if (ctx) {
                const { x, y } = getCanvasPoint(e);
                ctx.drawImage(img, 0, 0);
                if (canvasRef.current) {
                    ctx.drawImage(canvasRef.current, 0, 0);
                }
                const p = ctx.getImageData(x, y, 1, 1).data;
                const hex = "#" + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1);
                setBrushColor(hex);
            }
        };
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (!selectedImage) return;
        const sensitivity = 0.0001;
        const delta = -e.deltaY * sensitivity;
        setScale(s => Math.min(Math.max(0.1, s + delta), 5));
    };

    // --- Export ---
    const handleDownloadSingle = async () => {
        if (!selectedImage) return;

        const canvas = document.createElement('canvas');
        const img = new Image();
        img.src = selectedImage.previewUrl;
        img.onload = () => {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                if (selectedImage.drawingDataUrl) {
                    const drawLayer = new Image();
                    drawLayer.src = selectedImage.drawingDataUrl;
                    drawLayer.onload = () => {
                        ctx.drawImage(drawLayer, 0, 0);
                        canvas.toBlob(blob => {
                            if (blob) {
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `painted_${selectedImage.file.name}`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }
                        });
                    }
                } else {
                    canvas.toBlob(blob => {
                        if (blob) {
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `painted_${selectedImage.file.name}`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        }
                    });
                }
            }
        };
    };

    const handleDownloadAll = async () => {
        if (images.length === 0) return;
        const zip = new JSZip();

        for (const imgItem of images) {
            // We need to combine background + drawing
            await new Promise<void>((resolve) => {
                const canvas = document.createElement('canvas');
                const img = new Image();
                img.src = imgItem.previewUrl;
                img.onload = () => {
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0);
                        if (imgItem.drawingDataUrl) {
                            const drawLayer = new Image();
                            drawLayer.src = imgItem.drawingDataUrl;
                            drawLayer.onload = () => {
                                ctx.drawImage(drawLayer, 0, 0);
                                canvas.toBlob(blob => {
                                    if (blob) zip.file(`painted_${imgItem.file.name}`, blob);
                                    resolve();
                                });
                            }
                        } else {
                            canvas.toBlob(blob => {
                                if (blob) zip.file(`painted_${imgItem.file.name}`, blob);
                                resolve();
                            });
                        }
                    } else resolve();
                };
            });
        }

        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url;
        link.download = `painted_images_${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- Render ---

    return (
        <div className="flex flex-col lg:flex-row w-full h-full bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-200 animate-in fade-in duration-500 font-sans">

            {/* Sidebar */}
            <div className="w-full lg:w-80 flex-shrink-0 border-r border-gray-100 bg-white flex flex-col z-50">
                {/* 1. Queue */}
                <div className="flex-1 flex flex-col min-h-0 relative">
                    <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={handleFileSelect} />

                    {images.length === 0 ? (
                        <div className="flex-1 flex flex-col p-5">
                            <div
                                onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}
                                className={`flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all gap-4 ${isDragging ? 'border-black bg-gray-50 scale-[0.99]' : 'border-gray-200 hover:border-black hover:bg-gray-50'}`}
                            >
                                <div className={`p-4 rounded-full transition-colors ${isDragging ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 group-hover:bg-black group-hover:text-white'}`}>
                                    <Upload size={24} />
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-gray-900 mb-1">Upload Images</p>
                                    <span className="text-xs font-medium text-gray-500">Drag & drop or click</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex-shrink-0 px-5 py-4 border-b border-gray-100 bg-white flex items-center justify-between z-10 shadow-sm">
                                <span className="text-xs font-bold text-gray-900 tracking-wider">QUEUE ({images.length})</span>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => fileInputRef.current?.click()} className="p-1.5 text-gray-500 hover:text-white hover:bg-black rounded-lg transition-all"><Plus size={16} /></button>
                                    <div className="w-px h-4 bg-gray-200 mx-1"></div>
                                    <button onClick={handleClearAll} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16} /></button>
                                </div>
                            </div>
                            <div
                                className={`flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent p-3 space-y-2 relative transition-colors ${isDragging ? 'bg-blue-50/50' : ''}`}
                                onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                            >
                                {isDragging && (
                                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-500/10 backdrop-blur-[2px] border-2 border-dashed border-blue-500 rounded-xl m-2 pointer-events-none">
                                        <div className="bg-white px-4 py-2 rounded-full shadow-lg text-blue-600 font-bold text-sm flex items-center gap-2">
                                            <Upload size={16} /><span>Drop to Add Images</span>
                                        </div>
                                    </div>
                                )}
                                {images.map(img => (
                                    <div
                                        key={img.id} onClick={() => handleSelectImage(img.id)}
                                        className={`group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 border ${selectedImageId === img.id ? 'bg-gray-900 border-gray-900 shadow-md z-0' : 'bg-white border-transparent hover:bg-gray-50'}`}
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0 relative">
                                            <img src={img.previewUrl} className="w-full h-full object-cover" />
                                            {img.status === 'edited' && selectedImageId !== img.id && <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center"><Brush size={12} className="text-white" /></div>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs font-bold truncate ${selectedImageId === img.id ? 'text-white' : 'text-gray-900'}`}>{img.file.name}</p>
                                            <span className={`text-[10px] font-medium ${selectedImageId === img.id ? 'text-gray-400' : 'text-gray-500'}`}>{img.status === 'idle' ? 'Ready' : 'Edited'}</span>
                                        </div>
                                        <button onClick={(e) => handleRemoveImage(img.id, e)} className={`opacity-0 group-hover:opacity-100 p-1.5 rounded-full ${selectedImageId === img.id ? 'text-gray-400 hover:text-white' : 'text-gray-300 hover:text-red-500'}`}><X size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* 2. Combined Paint Toolbar & Footer (Matches Crop Tool Style) */}
                <div className="flex-shrink-0 p-4 border-t border-gray-100 bg-gray-50/50 z-20 flex flex-col gap-3">

                    {/* Compact Row: Tools + Color + Slider */}
                    <div className="flex flex-col gap-3">
                        {/* Tools Row */}
                        <div className="flex items-center justify-between w-full">
                            <div className="flex bg-white border border-gray-200 p-1 rounded-xl shadow-sm">
                                <button
                                    onClick={() => setActiveTool('brush')}
                                    className={`p-2 rounded-lg transition-all ${activeTool === 'brush' ? 'bg-black text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                                    title="Brush"
                                >
                                    <Brush size={18} />
                                </button>
                                <button
                                    onClick={() => setActiveTool('eraser')}
                                    className={`p-2 rounded-lg transition-all ${activeTool === 'eraser' ? 'bg-black text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                                    title="Eraser"
                                >
                                    <Eraser size={18} />
                                </button>
                                <button
                                    onClick={() => setActiveTool(activeTool === 'eyedropper' ? 'brush' : 'eyedropper')}
                                    className={`p-2 rounded-lg transition-all ${activeTool === 'eyedropper' ? 'bg-black text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                                    title="Eyedropper"
                                >
                                    <Pipette size={18} />
                                </button>
                            </div>



                            {/* Color Picker */}
                            <div className="relative">
                                <button
                                    onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                                    className="p-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2 pr-3 relative"
                                    title="Choose Color"
                                >
                                    <Palette size={16} className="text-gray-500" />
                                    <div className="w-8 h-8 rounded-lg border border-gray-100 shadow-inner" style={{ backgroundColor: brushColor }}></div>
                                </button>
                                {isColorPickerOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsColorPickerOpen(false)}></div>
                                        <div className="absolute bottom-full right-0 mb-4 z-50">
                                            <CustomColorPicker
                                                color={brushColor}
                                                onChange={setBrushColor}
                                                onClose={() => setIsColorPickerOpen(false)}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Brush Size Slider (Compact) */}
                        <div className="flex items-center gap-3 px-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase w-12">Size {brushSize}</span>
                            <input
                                type="range" min="1" max="100" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))}
                                className="h-1.5 bg-gray-200 rounded-full appearance-none flex-1 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-black [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md hover:[&::-webkit-slider-thumb]:scale-110 transition-all cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* Download Button */}
                    <button
                        onClick={handleDownloadAll}
                        disabled={images.length === 0}
                        className="w-full bg-black text-white py-3 rounded-xl font-bold text-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        <Archive size={16} />
                        <span>DOWNLOAD ZIP</span>
                    </button>

                    <div className="text-center">
                        <p className="text-[10px] text-gray-400">Shift + Drag to Pan</p>
                    </div>
                </div>
            </div>

            {/* Canvas Area */}
            <div className="flex-1 bg-gray-900 relative flex flex-col overflow-hidden">
                <div
                    ref={containerRef}
                    className={`flex-1 relative overflow-hidden flex items-center justify-center group ${activeTool === 'eyedropper' ? 'cursor-crosshair' : (isPanning.current ? 'cursor-move' : 'cursor-crosshair')}`}
                    onDragStart={(e) => e.preventDefault()}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    {selectedImage ? (
                        <>
                            {/* NEW: Navigation Buttons */}
                            {/* NEW: Navigation Buttons */}
                            {selectedIndex > 0 && (
                                <button
                                    onClick={handlePrevImage}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="absolute left-6 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 active:scale-95 border border-white/10 z-40"
                                >
                                    <ArrowLeft size={24} />
                                </button>
                            )}
                            {selectedIndex < images.length - 1 && (
                                <button
                                    onClick={handleNextImage}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="absolute right-6 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 active:scale-95 border border-white/10 z-40"
                                >
                                    <ArrowRight size={24} />
                                </button>
                            )}



                            {/* Floating Cursor for Brush */}
                            <div
                                ref={cursorRef}
                                className={`fixed pointer-events-none rounded-full backdrop-blur-[1px] z-50 shadow-sm transition-opacity duration-75 ${activeTool !== 'eyedropper' && !isPanning.current && isHovering ? 'opacity-100' : 'opacity-0'
                                    }`}
                                style={{
                                    width: brushSize * scale,
                                    height: brushSize * scale,
                                    transform: 'translate(-50%, -50%)',
                                    border: activeTool === 'eraser' ? '2px solid rgba(0,0,0,0.2)' : 'none', // Eraser needs faint border to be seen
                                    backgroundColor: activeTool === 'eraser' ? 'rgba(255,255,255,0.5)' : brushColor,
                                }}
                            />



                            {/* The Content: Image + Canvas */}
                            {/* We wrap them in a div that handles the transform */}
                            <div
                                style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}
                                className="relative origin-center user-select-none"
                            >
                                <img
                                    src={selectedImage.previewUrl}
                                    className="pointer-events-none select-none block"
                                    draggable={false}
                                />
                                <canvas
                                    ref={canvasRef}
                                    className="absolute inset-0 pointer-events-none"
                                />
                            </div>


                            {/* Helper Text (Moved to end) */}
                            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-xs font-bold pointer-events-none z-30 backdrop-blur-sm">
                                Scal: {Math.round(scale * 100)}% | Pos: {Math.round(position.x)}, {Math.round(position.y)}
                            </div>

                            {/* NEW: Single Download Button (Top Right) - Moved to end */}
                            <div className="absolute top-6 right-6 z-50 flex items-center gap-2 pointer-events-auto">
                                <button
                                    onClick={handleDownloadSingle}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-full backdrop-blur-md transition-all border border-white/10 shadow-lg"
                                    title="Download Current Image"
                                >
                                    <Download size={20} />
                                </button>
                                {activeTool === 'eyedropper' && <div className="bg-black text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg animate-pulse">Eyedropper Active</div>}
                            </div>
                        </>
                    ) : (
                        <div className="text-center opacity-40 flex flex-col items-center gap-4 select-none text-white">
                            <div className="p-6 bg-white/10 rounded-full border-2 border-dashed border-white/20">
                                <Brush size={48} className="text-white/50" />
                            </div>
                            <p className="text-lg font-bold text-white/50">Select an image to paint</p>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
};
