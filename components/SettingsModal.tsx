import React, { useState, useEffect } from 'react';
import { X, Save, Server, ShieldCheck, Key, Eye, EyeOff, Trash2 } from 'lucide-react';
import { MODEL_CONFIG } from '../constants';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  
  // Check if system env key exists (safely)
  const hasSystemKey = typeof process !== 'undefined' && process.env && process.env.API_KEY;

  // Sync state when opening
  useEffect(() => {
    if (isOpen) {
        // Load key from local storage
        const savedKey = localStorage.getItem('gemini_api_key') || '';
        setApiKey(savedKey);
    }
  }, [isOpen]);

  const handleSaveAll = () => {
    // Save API Key (locally)
    if (apiKey.trim()) {
        localStorage.setItem('gemini_api_key', apiKey.trim());
    } else {
        localStorage.removeItem('gemini_api_key');
    }

    onSave(); // Notify parent if needed
    onClose();
  };

  const handleClearKey = () => {
    setApiKey('');
    localStorage.removeItem('gemini_api_key');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
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
        
        <div className="p-6 space-y-6 bg-white max-h-[70vh] overflow-y-auto custom-scrollbar">
          
          {/* API Key Section */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <Key size={16} className="text-amber-500" />
                Gemini API Key
            </label>
            
            <div className="relative group">
                <input 
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={hasSystemKey ? "預設使用系統環境變數 (可在此覆寫)" : "請輸入您的 Gemini API Key"}
                    className="w-full border border-gray-300 rounded-xl p-3 pr-24 text-sm focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none bg-white transition-all font-mono placeholder-gray-400"
                />
                
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {apiKey && (
                        <button 
                            onClick={handleClearKey}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="清除 Key"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                    <button 
                        onClick={() => setShowKey(!showKey)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
            </div>

            <div className="mt-2 text-xs text-gray-500 space-y-1">
                {hasSystemKey ? (
                    <p className="flex items-center gap-1.5 text-green-700 bg-green-50 p-2 rounded-lg border border-green-100">
                        <ShieldCheck size={14} />
                        環境變數中已偵測到 Key，若上方留空將自動使用系統 Key。
                    </p>
                ) : (
                    <p className="text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100">
                        未偵測到系統環境變數，請務必手動輸入 Key 才能使用。
                    </p>
                )}
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Model Info (Read Only) */}
          <div>
             <label className="block text-sm font-bold text-gray-700 mb-2">目前使用模型</label>
             <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-600 font-mono">
                {MODEL_CONFIG.modelName}
             </div>
             <p className="text-xs text-gray-400 mt-1">
                系統預設使用 Gemini 3 Pro (Preview) 模型以獲得最佳貼圖品質。
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
            onClick={handleSaveAll}
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