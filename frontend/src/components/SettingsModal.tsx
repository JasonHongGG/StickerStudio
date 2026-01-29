import React, { useState, useEffect } from 'react';
import { X, Save, Server, ShieldCheck, Info } from 'lucide-react';
import { checkHealth, HealthCheckResponseDTO } from '../services/apiClient';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave }) => {
  const [healthStatus, setHealthStatus] = useState<HealthCheckResponseDTO | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // Check backend health when opening
  useEffect(() => {
    if (isOpen) {
      checkBackendHealth();
    }
  }, [isOpen]);

  const checkBackendHealth = async () => {
    setIsChecking(true);
    setHealthError(null);
    try {
      const health = await checkHealth();
      setHealthStatus(health);
    } catch (e) {
      setHealthError('無法連接到後端服務');
      setHealthStatus(null);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSave = () => {
    onSave();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-white">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Server size={20} className="text-gray-900" />
            AI 服務設定
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 bg-white max-h-[70vh] overflow-y-auto custom-scrollbar">

          {/* Backend Status */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-3">後端服務狀態</label>

            {isChecking ? (
              <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="animate-spin w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full"></div>
                <span className="text-sm text-gray-600">正在檢查...</span>
              </div>
            ) : healthError ? (
              <div className="p-4 bg-red-50 rounded-lg border border-red-100 text-red-700">
                <p className="text-sm font-medium">{healthError}</p>
                <p className="text-xs mt-1 text-red-600">請確認後端服務已啟動 (npm run dev in backend/)</p>
                <button
                  onClick={checkBackendHealth}
                  className="mt-2 text-xs text-red-600 underline hover:no-underline"
                >
                  重試連接
                </button>
              </div>
            ) : healthStatus ? (
              <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                <div className="flex items-center gap-2 text-green-700 font-medium">
                  <ShieldCheck size={18} />
                  <span>後端服務運作正常</span>
                </div>
                <div className="mt-2 space-y-1 text-sm text-green-600">
                  <p>AI 服務: <span className="font-mono">{healthStatus.service}</span></p>
                  <p>設定狀態: {healthStatus.configured ? '✓ 已配置' : '✗ 未配置 API Key'}</p>
                </div>
              </div>
            ) : null}
          </div>

          <hr className="border-gray-100" />

          {/* Info Section */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-start gap-2">
              <Info size={18} className="text-blue-600 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">API Key 設定方式</p>
                <p className="text-blue-700">
                  API Key 現在透過後端環境變數管理。請在 <code className="bg-blue-100 px-1 rounded">backend/.env</code> 檔案中設定：
                </p>
                <ul className="mt-2 list-disc list-inside text-blue-700 space-y-0.5">
                  <li><code className="bg-blue-100 px-1 rounded">GEMINI_API_KEY</code> - Google Gemini API Key</li>
                  <li><code className="bg-blue-100 px-1 rounded">AI_SERVICE_TYPE</code> - gemini 或 local</li>
                </ul>
              </div>
            </div>
          </div>

        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            關閉
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-sm font-bold text-white bg-black hover:bg-gray-800 rounded-lg shadow-sm flex items-center gap-2 transition-transform active:scale-95"
          >
            <Save size={16} />
            確認
          </button>
        </div>
      </div>
    </div>
  );
};