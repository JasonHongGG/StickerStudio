import React, { useRef } from 'react';
import { Upload, RefreshCw, Type, Image as ImageIcon, X, Trash2 } from 'lucide-react';

interface UploadSectionProps {
  image: File | null;
  onUpload: (file: File) => void;
  onRemove: () => void;
  characterPrompt: string;
  onPromptChange: (text: string) => void;
}

export const UploadSection: React.FC<UploadSectionProps> = ({ 
  image, 
  onUpload, 
  onRemove,
  characterPrompt, 
  onPromptChange 
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files[0]);
    }
  };

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the file input click
    onRemove();
    // Reset file input so the same file can be selected again if needed
    if (inputRef.current) {
        inputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
      <h2 className="text-lg font-bold mb-4 flex items-center">
        <span className="bg-black text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2">1</span>
        角色來源設定
      </h2>

      <div className="space-y-4">
        {/* Image Upload Area */}
        <div>
           <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <ImageIcon size={16} className="text-blue-500" />
              參考照片 (選填)
           </label>
            
            {/* Hidden File Input */}
            <input 
                type="file" 
                ref={inputRef} 
                className="hidden" 
                accept="image/png, image/jpeg, image/webp"
                onChange={handleFileChange}
            />

            {!image ? (
                <div 
                onClick={() => inputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors h-48"
                >
                <Upload className="w-10 h-10 text-gray-400 mb-2" />
                <p className="text-gray-500 font-medium text-sm">點擊上傳照片</p>
                <p className="text-gray-400 text-xs mt-1">人物、寵物或物品 (作為外觀參考)</p>
                </div>
            ) : (
                <div 
                    className="relative border border-gray-200 rounded-lg bg-gray-50 group overflow-hidden cursor-pointer h-48 flex items-center justify-center"
                    onClick={() => inputRef.current?.click()}
                >
                    <img 
                        src={URL.createObjectURL(image)} 
                        alt="Uploaded" 
                        className="w-full h-full object-contain"
                    />
                    
                    {/* Hover Overlay for Change */}
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-[2px] z-10">
                        <RefreshCw className="text-white w-8 h-8 mb-2 drop-shadow-lg" />
                        <span className="text-white font-bold text-sm tracking-wide drop-shadow-md border border-white/50 px-3 py-1 rounded-full bg-white/10">
                        更換照片
                        </span>
                    </div>

                    {/* Delete Button (Transparent Glass Style) */}
                    <button
                        onClick={handleRemoveClick}
                        className="absolute top-2 right-2 z-20 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm border border-white/30 bg-black/20 text-white/90 hover:bg-red-500/80 hover:border-red-400 hover:text-white shadow-sm"
                        title="移除照片"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            )}
        </div>

        {/* Divider text */}
        <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">AND / OR</span>
            <div className="flex-grow border-t border-gray-200"></div>
        </div>

        {/* Text Prompt Area */}
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
                * 若只上傳圖片：將完全依據圖片生成。<br/>
                * 若只輸入文字：將依據文字生成新角色。<br/>
                * 若兩者皆有：將混合圖片特徵與文字描述。
            </p>
        </div>
      </div>
    </div>
  );
};