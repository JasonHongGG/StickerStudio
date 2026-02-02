import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { StickerGenerator } from './components/StickerGenerator';
import { BackgroundRemovalTool } from './components/BackgroundRemovalTool';
import { ImageCropTool } from './components/ImageCropTool';
import { ImagePaintTool } from './components/ImagePaintTool';
import { SettingsModal } from './components/SettingsModal';
import { ToolDropdown } from './components/ui/ToolDropdown';
import { ToolId, TOOLS } from './config/tools';
import { Palette, Settings, ArrowLeft } from 'lucide-react';

const App: React.FC = () => {
  // Page Navigation State handled by Router
  const navigate = useNavigate();
  const location = useLocation();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Derived State
  const isMain = location.pathname === '/';
  const currentToolId = location.pathname.startsWith('/tool/')
    ? (location.pathname.split('/')[2] as ToolId)
    : undefined;

  // Handlers
  const handleToolSelect = (id: ToolId) => {
    navigate(`/tool/${id}`);
  };

  return (
    <div className={`bg-gray-50 font-sans ${!isMain ? 'h-screen overflow-hidden flex flex-col' : 'min-h-screen'}`}>

      {/* 1. Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-[60] shadow-sm">
        <div className="max-w-[1800px] mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">

          {/* --- Main Header Mode --- */}
          {isMain ? (
            <>
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
                <div className="bg-black text-white p-1.5 rounded-lg shadow-sm">
                  <Palette size={20} />
                </div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">AI Sticker Studio</h1>
              </div>

              <div className="flex items-center gap-2">

                {/* Tools Dropdown (Main Style) */}
                <ToolDropdown
                  viewMode="main"
                  currentToolId={undefined}
                  onSelect={handleToolSelect}
                />

                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-full transition-all"
                  title="設定"
                >
                  <Settings size={20} />
                </button>
              </div>
            </>
          ) : (
            /* --- Tool Header Mode --- */
            <>
              {/* Left: Back | Title | Badge */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate('/')}
                  className="p-2 -ml-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all"
                  title="返回主頁"
                >
                  <ArrowLeft size={20} />
                </button>

                <div className="h-6 w-px bg-gray-200"></div>

                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-gray-900">
                    {TOOLS.find(t => t.id === currentToolId)?.name}
                  </h1>
                  <span className="bg-black text-white text-[10px] font-bold px-1.5 py-0.5 rounded leading-none">
                    {TOOLS.find(t => t.id === currentToolId)?.status === 'new' ? 'NEW' : 'BETA'}
                  </span>
                </div>
              </div>

              {/* Right: Tools Switcher Using Component */}
              <ToolDropdown
                viewMode="tool"
                currentToolId={currentToolId as ToolId}
                onSelect={handleToolSelect}
              />
            </>
          )}
        </div>
      </header>

      {/* Main Layout / Routes */}
      <Routes>
        <Route path="/" element={<StickerGenerator />} />

        <Route path="/tool/bg-removal" element={
          <div className="flex-1 w-full overflow-hidden px-4 lg:px-6 py-8">
            <div className="max-w-[1800px] mx-auto h-full">
              <BackgroundRemovalTool />
            </div>
          </div>
        } />

        <Route path="/tool/image-crop" element={
          <div className="flex-1 w-full overflow-hidden px-4 lg:px-6 py-8">
            <div className="max-w-[1800px] mx-auto h-full">
              <ImageCropTool />
            </div>
          </div>
        } />

        <Route path="/tool/image-paint" element={
          <div className="flex-1 w-full overflow-hidden px-4 lg:px-6 py-8">
            <div className="max-w-[1800px] mx-auto h-full">
              <ImagePaintTool />
            </div>
          </div>
        } />

        {/* Redirect unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={() => setIsSettingsOpen(false)}
      />

    </div>
  );
};

export default App;