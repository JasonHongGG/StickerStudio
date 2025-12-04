import React, { useState, useEffect } from 'react';
import { X, Save, Server, ShieldCheck } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentModel: string;
  onSave: (model: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, currentModel, onSave }) => {
  const [model, setModel] = useState(currentModel);

  // Sync state when opening
  useEffect(() => {
    if (isOpen) setModel(currentModel);
  }, [isOpen, currentModel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-white">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Server size={20} className="text-amber-500" />
            系統設定
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-6 bg-white">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-3">Gemini 模型選擇</label>
            <div className="space-y-3">
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${model === 'gemini-2.5-flash-image' ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-200' : 'border-gray-200 hover:border-amber-200 hover:bg-gray-50'}`}>
                <input 
                  type="radio" 
                  name="model" 
                  value="gemini-2.5-flash-image"
                  checked={model === 'gemini-2.5-flash-image'}
                  onChange={(e) => setModel(e.target.value)}
                  className="mt-1 text-amber-500 focus:ring-amber-400 accent-amber-500"
                />
                <div>
                  <div className="font-bold text-gray-800 text-sm">Gemini 2.5 Flash Image</div>
                  <div className="text-xs text-gray-500 mt-0.5">速度快、成本低，預設模型，適合快速生成多張貼圖。</div>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${model === 'gemini-3-pro-image-preview' ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-200' : 'border-gray-200 hover:border-amber-200 hover:bg-gray-50'}`}>
                <input 
                  type="radio" 
                  name="model" 
                  value="gemini-3-pro-image-preview"
                  checked={model === 'gemini-3-pro-image-preview'}
                  onChange={(e) => setModel(e.target.value)}
                  className="mt-1 text-amber-500 focus:ring-amber-400 accent-amber-500"
                />
                <div>
                  <div className="font-bold text-gray-800 text-sm">Gemini 3 Pro Image (Preview)</div>
                  <div className="text-xs text-gray-500 mt-0.5">高畫質預覽版，對複雜指令理解力更強，適合精細創作。</div>
                </div>
              </label>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
             <div className="flex items-center gap-2 mb-2 text-gray-800 font-bold text-sm">
                <ShieldCheck size={16} className="text-green-600" />
                API Key 設定
             </div>
             <p className="text-xs text-gray-500 leading-relaxed">
                本環境已自動注入 <code className="bg-gray-200 px-1 py-0.5 rounded text-gray-700">process.env.API_KEY</code>，系統會自動管理金鑰安全性，無需手動輸入。
             </p>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            取消
          </button>
          <button 
            onClick={() => {
              onSave(model);
              onClose();
            }}
            className="px-5 py-2 text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm shadow-amber-200 flex items-center gap-2 transition-transform active:scale-95"
          >
            <Save size={16} />
            儲存設定
          </button>
        </div>
      </div>
    </div>
  );
};