import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';

interface CustomColorPickerProps {
    color: string; // Hex
    onChange: (color: string) => void;
    onClose: () => void;
}

// Helpers
const hexToHsb = (hex: string) => {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max !== min) {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: h * 360, s: s * 100, b: v * 100 };
};

const hsbToHex = (h: number, s: number, b: number) => {
    s /= 100;
    b /= 100;
    const k = (n: number) => (n + h / 60) % 6;
    const f = (n: number) => b * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)));
    const toHex = (x: number) => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(f(5))}${toHex(f(3))}${toHex(f(1))}`;
};

export const CustomColorPicker: React.FC<CustomColorPickerProps> = ({ color, onChange, onClose }) => {
    const [hsb, setHsb] = useState(hexToHsb(color));
    const [isDraggingSat, setIsDraggingSat] = useState(false);
    const [isDraggingHue, setIsDraggingHue] = useState(false);

    // Refs for interaction areas
    const satRectRef = useRef<HTMLDivElement>(null);
    const hueRectRef = useRef<HTMLDivElement>(null);

    // Sync external color change if needed (optional, care for loops)
    // useEffect(() => { setHsb(hexToHsb(color)); }, [color]);

    const handleSatMove = useCallback((clientX: number, clientY: number) => {
        if (!satRectRef.current) return;
        const rect = satRectRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

        const newS = x * 100;
        const newB = (1 - y) * 100;

        setHsb(prev => {
            const newHsb = { ...prev, s: newS, b: newB };
            onChange(hsbToHex(newHsb.h, newHsb.s, newHsb.b));
            return newHsb;
        });
    }, [onChange]);

    const handleHueMove = useCallback((clientX: number) => {
        if (!hueRectRef.current) return;
        const rect = hueRectRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const newH = x * 360;

        setHsb(prev => {
            const newHsb = { ...prev, h: newH };
            onChange(hsbToHex(newHsb.h, newHsb.s, newHsb.b));
            return newHsb;
        });
    }, [onChange]);

    // Global Event Listeners for Dragging
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (isDraggingSat) handleSatMove(e.clientX, e.clientY);
            if (isDraggingHue) handleHueMove(e.clientX);
        };
        const onUp = () => {
            setIsDraggingSat(false);
            setIsDraggingHue(false);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [isDraggingSat, isDraggingHue, handleSatMove, handleHueMove]);

    // Text Input Handler
    const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
            setHsb(hexToHsb(val));
            onChange(val);
        }
    };

    return (
        <div className="flex flex-col w-64 bg-white/90 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 select-none">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100/50">
                <span className="text-xs font-bold text-gray-500 tracking-wider">COLOR EDITOR</span>
            </div>

            {/* Saturation/Brightness Area */}
            <div
                className="relative w-full h-40 cursor-crosshair"
                ref={satRectRef}
                onMouseDown={(e) => { setIsDraggingSat(true); handleSatMove(e.clientX, e.clientY); }}
                style={{
                    backgroundColor: `hsl(${hsb.h}, 100%, 50%)`,
                    backgroundImage: `
                        linear-gradient(to bottom, transparent, #000),
                        linear-gradient(to right, #fff, transparent)
                    `
                }}
            >
                <div
                    className="absolute w-4 h-4 rounded-full border-2 border-white shadow-lg -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-transform active:scale-110"
                    style={{ left: `${hsb.s}%`, top: `${100 - hsb.b}%`, backgroundColor: color }}
                />
            </div>

            {/* Controls */}
            <div className="p-4 space-y-4">
                {/* Hue Slider */}
                <div className="space-y-1.5">
                    <div
                        ref={hueRectRef}
                        className="h-4 w-full rounded-full cursor-pointer relative shadow-inner"
                        style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
                        onMouseDown={(e) => { setIsDraggingHue(true); handleHueMove(e.clientX); }}
                    >
                        <div
                            className="absolute w-4 h-4 bg-white rounded-full border border-gray-200 shadow top-0 -translate-x-1/2 pointer-events-none"
                            style={{ left: `${(hsb.h / 360) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Info Row: Preview + Hex */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl shadow-inner border border-gray-100" style={{ backgroundColor: color }}></div>
                    <div className="flex-1">
                        <div className="relative group">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-xs">#</span>
                            <input
                                type="text"
                                value={color.replace('#', '')}
                                onChange={handleHexChange}
                                className="w-full bg-gray-50 border border-transparent group-hover:border-gray-200 focus:border-black rounded-lg py-2 pl-6 pr-3 font-mono text-sm text-gray-700 outline-none transition-all uppercase"
                                spellCheck={false}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
