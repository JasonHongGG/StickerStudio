import React, { useState, useEffect } from 'react';
import { X, Save, Server, ShieldCheck, Key, Eye, EyeOff, Trash2, Globe, Cpu } from 'lucide-react';
import { API_CONFIG, STORAGE_KEYS } from '../constants';
import { AIServiceType } from '../services/AIService';
import { AIServiceFactory } from '../services/AIServiceFactory';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave }) => {
  // Service Type State
  const [serviceType, setServiceType] = useState<AIServiceType>('gemini');

  // Gemini State
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  // Local API State
  const [localHost, setLocalHost] = useState('');
  const [localPort, setLocalPort] = useState('');

  // Check if system env key exists (safely)
  const hasSystemKey = typeof process !== 'undefined' && process.env && process.env.API_KEY;

  // Sync state when opening
  useEffect(() => {
    if (isOpen) {
      // Load configurations
      const currentService = localStorage.getItem(STORAGE_KEYS.serviceType) as AIServiceType || 'gemini';
      setServiceType(currentService);

      const savedKey = localStorage.getItem(STORAGE_KEYS.geminiApiKey) || '';
      setApiKey(savedKey);

      const savedHost = localStorage.getItem(STORAGE_KEYS.localApiHost) || API_CONFIG.local.defaultHost;
      setLocalHost(savedHost);

      const savedPort = localStorage.getItem(STORAGE_KEYS.localApiPort) || API_CONFIG.local.defaultPort.toString();
      setLocalPort(savedPort);
    }
  }, [isOpen]);

  const handleSaveAll = () => {
    // Save Service Type
    AIServiceFactory.setServiceType(serviceType);

    // Save Gemini Key
    if (apiKey.trim()) {
      localStorage.setItem(STORAGE_KEYS.geminiApiKey, apiKey.trim());
    } else {
      localStorage.removeItem(STORAGE_KEYS.geminiApiKey);
    }

    // Save Local Config
    if (localHost.trim()) {
      localStorage.setItem(STORAGE_KEYS.localApiHost, localHost.trim());
    } else {
      localStorage.removeItem(STORAGE_KEYS.localApiHost);
    }

    if (localPort.trim()) {
      localStorage.setItem(STORAGE_KEYS.localApiPort, localPort.trim());
    } else {
      localStorage.removeItem(STORAGE_KEYS.localApiPort);
    }

    onSave(); // Notify parent
    onClose();
  };

  const handleClearKey = () => {
    setApiKey('');
    localStorage.removeItem(STORAGE_KEYS.geminiApiKey);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-white">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Server size={20} className="text-amber-500" />
            AI 服務設定
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 bg-white max-h-[70vh] overflow-y-auto custom-scrollbar">

          {/* Service Selection */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-3">選擇 AI 服務來源</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setServiceType('gemini')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${serviceType === 'gemini'
                    ? 'border-amber-500 bg-amber-50 text-amber-900'
                    : 'border-gray-200 hover:border-amber-200 text-gray-600'
                  }`}
              >
                <Globe size={24} className="mb-2" />
                <span className="font-bold text-sm">Gemini API</span>
              </button>
              <button
                onClick={() => setServiceType('local')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${serviceType === 'local'
                    ? 'border-amber-500 bg-amber-50 text-amber-900'
                    : 'border-gray-200 hover:border-amber-200 text-gray-600'
                  }`}
              >
                <Cpu size={24} className="mb-2" />
                <span className="font-bold text-sm">Local Server</span>
              </button>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Dynamic Settings Area */}
          {serviceType === 'gemini' ? (
            // Gemini API Key Section
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <Key size={16} className="text-amber-500" />
                Gemini API Key
              </label>

              <div className="relative group">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={hasSystemKey ? "預設使用系統環境變數" : "請輸入您的 Gemini API Key"}
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
                    環境變數中已偵測到 Key。
                  </p>
                ) : (
                  <p className="text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100">
                    請輸入 Key 以使用 Google Gemini 服務。
                  </p>
                )}
              </div>

              <div className="mt-4">
                <label className="block text-xs font-bold text-gray-500 mb-1">目前模型</label>
                <div className="p-2 bg-gray-50 rounded border border-gray-200 text-xs text-gray-600 font-mono">
                  {API_CONFIG.gemini.modelName}
                </div>
              </div>
            </div>
          ) : (
            // Local API Settings Section
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-sm text-blue-800">
                請確保您的 Local Python Server 已啟動並正在監聽。
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Host</label>
                  <input
                    type="text"
                    value={localHost}
                    onChange={(e) => setLocalHost(e.target.value)}
                    placeholder="127.0.0.1"
                    className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Port</label>
                  <input
                    type="text"
                    value={localPort}
                    onChange={(e) => setLocalPort(e.target.value)}
                    placeholder="8000"
                    className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-xs font-bold text-gray-500 mb-1">Endpoint 預覽</label>
                <div className="p-2 bg-gray-50 rounded border border-gray-200 text-xs text-gray-600 font-mono break-all">
                  http://{localHost || '127.0.0.1'}:{localPort || '8000'}{API_CONFIG.local.endpoints.chat}
                </div>
              </div>
            </div>
          )}

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