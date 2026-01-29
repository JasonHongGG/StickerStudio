import React, { useRef, useState } from 'react';
import { Upload, Type, Image as ImageIcon, Trash2, X, Plus } from 'lucide-react';
import { ReferenceImage } from '../types';

interface UploadSectionProps {
  referenceImages: ReferenceImage[];
  onAddImages: (files: FileList) => void;
  onRemoveImage: (id: string) => void;
  onClearAllImages: () => void;
  characterPrompt: string;
  onPromptChange: (text: string) => void;
}

export const UploadSection: React.FC<UploadSectionProps> = ({
  referenceImages,
  onAddImages,
  onRemoveImage,
  onClearAllImages,
  characterPrompt,
  onPromptChange
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddImages(e.target.files);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingOver(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files?.length > 0) onAddImages(e.dataTransfer.files);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
      <h2 className="text-lg font-bold mb-4 flex items-center">
        <span className="bg-black text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2">1</span>
        角色來源設定
      </h2>

      <div className="space-y-4">
        {/* === Image Reference Section === */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
            <ImageIcon size={16} className="text-blue-500" />
            參考照片 (選填)
            {referenceImages.length > 0 && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-gray-400 font-normal">
                  {referenceImages.length} 張
                </span>
                <button
                  onClick={onClearAllImages}
                  className="text-gray-300 hover:text-red-500 transition-colors p-0.5"
                  title="清除全部"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </label>

          <input
            type="file" ref={inputRef} className="hidden"
            accept="image/png, image/jpeg, image/webp" multiple
            onChange={handleFileChange}
          />

          {referenceImages.length === 0 ? (
            /* ===== EMPTY STATE: Original Simple Design ===== */
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-lg p-6 
                flex flex-col items-center justify-center 
                cursor-pointer transition-colors h-48
                ${isDraggingOver
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-300 hover:bg-gray-50'
                }
              `}
            >
              <Upload className="w-10 h-10 text-gray-400 mb-2" />
              <p className="text-gray-500 font-medium text-sm">點擊上傳照片</p>
              <p className="text-gray-400 text-xs mt-1">支援多張參考圖，AI 將學習角色的完整風格</p>
            </div>
          ) : (
            /* ===== GALLERY STATE: Horizontal Scroll Cards ===== */
            <div
              className={`rounded-lg p-3 -m-3 transition-colors ${isDraggingOver ? 'bg-blue-50 ring-2 ring-blue-300 ring-dashed' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >

              {/* Horizontal Scrolling Gallery */}
              <div className="relative -mx-6 px-6">
                <div className="flex gap-3 overflow-x-auto pb-3 pt-2 scrollbar-thin scrollbar-thumb-gray-200">
                  {referenceImages.map((img, index) => (
                    <div
                      key={img.id}
                      className="relative flex-shrink-0 group"
                    >
                      {/* Card Container */}
                      <div className="w-24 h-32 rounded-lg overflow-hidden bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200">
                        <img
                          src={img.previewUrl}
                          alt={`參考圖 ${index + 1}`}
                          className="w-full h-full object-contain bg-gray-50 transition-transform duration-200 hover:scale-[1.3]"
                        />
                      </div>

                      {/* Index Label */}
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-white border border-gray-200 px-1.5 py-0.5 rounded text-[10px] font-medium text-gray-500 shadow-sm">
                        #{index + 1}
                      </div>

                      {/* Remove Button - positioned inside card area */}
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemoveImage(img.id); }}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                      >
                        <X size={10} strokeWidth={3} />
                      </button>
                    </div>
                  ))}

                  {/* Add More Card */}
                  <div
                    onClick={() => inputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`
                      flex-shrink-0 w-24 h-32 rounded-lg
                      border-2 border-dashed flex flex-col items-center justify-center
                      cursor-pointer transition-all duration-200
                      ${isDraggingOver
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                      }
                    `}
                  >
                    <Plus size={20} className="text-gray-400 mb-1" />
                    <span className="text-xs text-gray-400">新增</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* === Divider === */}
        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-gray-200"></div>
          <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">AND / OR</span>
          <div className="flex-grow border-t border-gray-200"></div>
        </div>

        {/* === Text Description Section === */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
            <Type size={16} className="text-amber-500" />
            角色文字描述 (選填)
          </label>
          <textarea
            value={characterPrompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="例如：一隻戴著紅色圍巾的橘色虎斑貓，眼睛大大的，很可愛..."
            className="w-full h-24 p-3 text-sm border border-gray-300 rounded-xl focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none resize-none bg-white placeholder-gray-400 transition-all"
          />
          <p className="text-xs text-gray-400 mt-1.5">
            * 若只上傳圖片：將完全依據圖片生成。<br />
            * 若只輸入文字：將依據文字生成新角色。<br />
            * 若兩者皆有：將混合圖片特徵與文字描述。
          </p>
        </div>
      </div>
    </div>
  );
};