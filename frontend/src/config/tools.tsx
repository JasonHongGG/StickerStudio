import React from 'react';
import { Crop, Brush, Layers, Plus } from 'lucide-react';

export type ToolId = 'bg-removal' | 'image-crop' | 'image-paint';

export interface ToolConfig {
    id: ToolId;
    name: string;
    description: string;
    icon: React.FC<any>;
    status: 'beta' | 'stable' | 'new';
}

export const TOOLS: ToolConfig[] = [
    {
        id: 'bg-removal',
        name: '批量去背工具',
        description: '自動移除背景',
        icon: Layers, // Using Layers as a proxy for the custom SVG or we could use Image
        status: 'beta'
    },
    {
        id: 'image-crop',
        name: '圖片裁切工具',
        description: '批量裁切圖片',
        icon: Crop,
        status: 'beta'
    },
    {
        id: 'image-paint',
        name: '圖片塗改工具',
        description: '修補與塗鴉',
        icon: Brush,
        status: 'beta'
    }
];

export const FUTURE_TOOLS = [
    {
        name: '更多工具開發中',
        description: '敬請期待',
        icon: Plus
    }
];
