import React, { useState, useMemo } from 'react';
import { STYLES, EMOTIONS, COMMON_ACTIONS, SAME_AS_REF_ID, AUTO_MATCH_ID, CUSTOM_ACTION_ID, CUSTOM_EMOTION_ID } from '../constants';
import { Check, FolderOpen, ChevronDown, Plus, Palette, Smile, Activity, Type, Trash2, ArrowRight, Gift, Sparkles, RefreshCcw } from 'lucide-react';
import { StickerPackInfo, StickerPlanItem } from '../types';

interface ConfigSectionProps {
    selectedStyle: string;
    onStyleChange: (id: string) => void;

    // New Plan Props
    stickerPlan: StickerPlanItem[];
    onAddToPlan: (item: StickerPlanItem) => void;
    onRemoveFromPlan: (id: string) => void;

    themeText: string;
    onThemeChange: (text: string) => void;

    // Pack Management
    existingPacks: StickerPackInfo[];
    targetPackId: string; // 'new' or UUID
    onTargetPackIdChange: (id: string) => void;
    newPackName: string;
    onNewPackNameChange: (name: string) => void;

    hasReferenceImage: boolean;
}

export const ConfigSection: React.FC<ConfigSectionProps> = ({
    selectedStyle,
    onStyleChange,
    stickerPlan,
    onAddToPlan,
    onRemoveFromPlan,
    themeText,
    onThemeChange,
    existingPacks,
    targetPackId,
    onTargetPackIdChange,
    newPackName,
    onNewPackNameChange,
    hasReferenceImage
}) => {
    const [isPackDropdownOpen, setIsPackDropdownOpen] = useState(false);
    const [isStyleDropdownOpen, setIsStyleDropdownOpen] = useState(false);

    // Wizard State
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [tempEmotion, setTempEmotion] = useState<string>(AUTO_MATCH_ID);
    const [tempAction, setTempAction] = useState<string>(AUTO_MATCH_ID);

    const [customEmotionText, setCustomEmotionText] = useState('');
    const [customActionText, setCustomActionText] = useState('');
    const [tempCaption, setTempCaption] = useState('');

    // Helpers
    const isEmotionSpecified = tempEmotion !== AUTO_MATCH_ID;
    const isActionSpecified = tempAction !== AUTO_MATCH_ID;
    const isCustomAction = tempAction === CUSTOM_ACTION_ID;
    const isCustomEmotion = tempEmotion === CUSTOM_EMOTION_ID;
    const isValidPlan = isEmotionSpecified || isActionSpecified;

    // Toggle Handlers
    const toggleEmotion = (id: string) => {
        setTempEmotion(prev => prev === id ? AUTO_MATCH_ID : id);
    };

    const toggleAction = (id: string) => {
        setTempAction(prev => prev === id ? AUTO_MATCH_ID : id);
    };

    // Reset Wizard
    const resetWizard = () => {
        setStep(1);
        setTempEmotion(AUTO_MATCH_ID);
        setTempAction(AUTO_MATCH_ID);
        setCustomEmotionText('');
        setCustomActionText('');
        setTempCaption('');
    };

    const handleAddSticker = () => {
        if (!isValidPlan) return;

        const newItem: StickerPlanItem = {
            id: Date.now().toString(),
            emotionId: tempEmotion,
            customEmotionText: isCustomEmotion ? customEmotionText : undefined,
            actionId: tempAction,
            customActionText: isCustomAction ? customActionText : undefined,
            caption: tempCaption.trim()
        };

        onAddToPlan(newItem);
        resetWizard();
    };

    // Get Display Names for Summary
    const summary = useMemo(() => {
        const emoName = tempEmotion === AUTO_MATCH_ID ? '配合動作' :
            tempEmotion === SAME_AS_REF_ID ? '與原圖情緒一致' :
                tempEmotion === CUSTOM_EMOTION_ID ? (customEmotionText || '自訂情緒') :
                    EMOTIONS.find(e => e.id === tempEmotion)?.name || '未知';

        const actName = tempAction === AUTO_MATCH_ID ? '配合情緒' :
            tempAction === SAME_AS_REF_ID ? '與原圖動作一致' :
                tempAction === CUSTOM_ACTION_ID ? (customActionText || '自訂動作') :
                    COMMON_ACTIONS.find(a => a.id === tempAction)?.name || '未知';

        return { emoName, actName };
    }, [tempEmotion, tempAction, customActionText, customEmotionText]);

    const getSelectedPackName = () => {
        if (targetPackId === 'new') return '建立新貼圖包 (New Pack)';
        const pack = existingPacks.find(p => p.id === targetPackId);
        return pack ? pack.name : '選擇貼圖包';
    };

    const selectedStyleName = STYLES.find(s => s.id === selectedStyle)?.name || '選擇風格';

    return (
        <div className="flex flex-col gap-6">

            {/* === CARD 2: Pack Selection === */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative z-30">
                <h2 className="text-lg font-bold flex items-center mb-4">
                    <span className="bg-black text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2 shrink-0">2</span>
                    儲存位置
                </h2>

                {/* Target Pack Selection */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <FolderOpen size={16} className="text-amber-500" />
                        選擇貼圖包
                    </label>

                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => {
                                setIsPackDropdownOpen(!isPackDropdownOpen);
                                setIsStyleDropdownOpen(false);
                            }}
                            className={`w-full bg-white border rounded-xl p-3 text-sm flex items-center justify-between transition-all duration-200 ${isPackDropdownOpen
                                    ? 'border-amber-400 ring-4 ring-amber-100'
                                    : 'border-gray-300 hover:border-amber-300 hover:shadow-sm'
                                }`}
                        >
                            <span className={`truncate font-medium ${targetPackId === 'new' ? 'text-blue-600' : 'text-gray-700'}`}>
                                {getSelectedPackName()}
                            </span>
                            <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${isPackDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isPackDropdownOpen && (
                            <div className="absolute z-20 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100 scrollbar-thin">
                                <button
                                    type="button"
                                    onClick={() => {
                                        onTargetPackIdChange('new');
                                        setIsPackDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-4 py-3 text-sm flex items-center gap-2 hover:bg-blue-50 transition-colors border-b border-gray-50 ${targetPackId === 'new' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-blue-600'
                                        }`}
                                >
                                    <div className="bg-blue-100 p-1 rounded-md">
                                        <Plus size={14} />
                                    </div>
                                    建立新貼圖包 (New Pack)
                                </button>

                                {existingPacks.length > 0 && (
                                    <div className="py-2">
                                        <div className="px-4 py-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider">現有貼圖包</div>
                                        {existingPacks.map(pack => (
                                            <button
                                                key={pack.id}
                                                type="button"
                                                onClick={() => {
                                                    onTargetPackIdChange(pack.id);
                                                    setIsPackDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors ${targetPackId === pack.id
                                                        ? 'bg-amber-50 text-amber-900 font-bold'
                                                        : 'text-gray-700 hover:bg-gray-50'
                                                    }`}
                                            >
                                                <FolderOpen size={14} className={targetPackId === pack.id ? 'text-amber-500' : 'text-gray-400'} />
                                                <span className="truncate flex-1">{pack.name}</span>
                                                {targetPackId === pack.id && <Check size={14} className="text-amber-600" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {targetPackId === 'new' && (
                        <div className="animate-in fade-in slide-in-from-top-1 duration-200 mt-3">
                            <input
                                type="text"
                                value={newPackName}
                                onChange={(e) => onNewPackNameChange(e.target.value)}
                                placeholder="輸入新貼圖包名稱 (例: 龍年賀歲)"
                                className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none bg-white placeholder-gray-400 transition-all shadow-sm"
                                autoFocus
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* === CARD 3: Sticker Planner (Wizard UI) === */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative z-20">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold flex items-center">
                        <span className="bg-black text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2 shrink-0">3</span>
                        規劃貼圖內容
                    </h2>
                    {stickerPlan.length > 0 && (
                        <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
                            清單: {stickerPlan.length} 張
                        </span>
                    )}
                </div>

                {/* Style Selection */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <Palette size={16} className="text-gray-500" />
                        藝術風格
                    </label>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => {
                                setIsStyleDropdownOpen(!isStyleDropdownOpen);
                                setIsPackDropdownOpen(false);
                            }}
                            className={`w-full bg-white border rounded-xl p-3 text-sm flex items-center justify-between transition-all duration-200 ${isStyleDropdownOpen
                                    ? 'border-amber-400 ring-4 ring-amber-100'
                                    : 'border-gray-300 hover:border-amber-300 hover:shadow-sm'
                                }`}
                        >
                            <span className="truncate font-medium text-gray-700">{selectedStyleName}</span>
                            <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${isStyleDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isStyleDropdownOpen && (
                            <div className="absolute z-20 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100 scrollbar-thin">
                                <div className="py-2">
                                    {STYLES.map((style) => (
                                        <button
                                            key={style.id}
                                            type="button"
                                            onClick={() => {
                                                onStyleChange(style.id);
                                                setIsStyleDropdownOpen(false);
                                            }}
                                            className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors ${selectedStyle === style.id
                                                    ? 'bg-amber-50 text-amber-900 font-bold'
                                                    : 'text-gray-700 hover:bg-gray-50'
                                                }`}
                                        >
                                            <span className="truncate flex-1">{style.name}</span>
                                            {selectedStyle === style.id && <Check size={14} className="text-amber-600" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* === Wizard Container === */}
                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-gray-50/50">

                    {/* Wizard Header / Steps */}
                    <div className="flex border-b border-gray-200 bg-white">
                        <button
                            onClick={() => setStep(1)}
                            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${step === 1 ? 'text-amber-600 bg-amber-50' : 'text-gray-400 hover:bg-gray-50'}`}
                        >
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 1 ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
                            情緒
                        </button>
                        <div className="w-px bg-gray-100"></div>
                        <button
                            onClick={() => setStep(2)}
                            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${step === 2 ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:bg-gray-50'}`}
                        >
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 2 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
                            動作
                        </button>
                        <div className="w-px bg-gray-100"></div>
                        <button
                            onClick={() => setStep(3)}
                            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${step === 3 ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`}
                        >
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 3 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>3</div>
                            台詞
                        </button>
                    </div>

                    {/* Wizard Content Area */}
                    <div className="p-4 bg-gray-50/50 min-h-[300px]">

                        {/* STEP 1: Emotion */}
                        {step === 1 && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-200">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                        <Smile size={16} className="text-amber-500" /> 選擇角色情緒
                                    </h3>
                                    <span className="text-xs text-gray-400">點擊切換，未選則配合動作</span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 h-64 overflow-y-auto custom-scrollbar pr-1 content-start">
                                    {/* Same as Ref Option (Only if Ref Image exists) */}
                                    {hasReferenceImage && (
                                        <button
                                            onClick={() => toggleEmotion(SAME_AS_REF_ID)}
                                            className={`p-3 rounded-lg border text-xs font-bold text-left transition-all flex items-center gap-2 ${tempEmotion === SAME_AS_REF_ID
                                                    ? 'border-amber-500 bg-amber-50 text-amber-900 ring-1 ring-amber-200'
                                                    : 'border-gray-200 bg-white text-gray-600 hover:border-amber-300 hover:shadow-sm'
                                                }`}
                                        >
                                            <Sparkles size={14} className={tempEmotion === SAME_AS_REF_ID ? 'text-amber-500' : 'text-gray-400'} />
                                            與原圖一致
                                            {tempEmotion === SAME_AS_REF_ID && <Check size={14} className="ml-auto text-amber-600" />}
                                        </button>
                                    )}

                                    {/* Custom Emotion */}
                                    <button
                                        onClick={() => toggleEmotion(CUSTOM_EMOTION_ID)}
                                        className={`p-3 rounded-lg border text-xs font-bold text-left transition-all flex items-center gap-2 ${isCustomEmotion
                                                ? 'border-amber-500 bg-amber-50 text-amber-900 ring-1 ring-amber-200'
                                                : 'border-gray-200 bg-white text-gray-600 hover:border-amber-300 hover:shadow-sm'
                                            }`}
                                    >
                                        <Edit2Icon size={14} className={isCustomEmotion ? 'text-amber-500' : 'text-gray-400'} />
                                        自訂情緒...
                                        {isCustomEmotion && <Check size={14} className="ml-auto text-amber-600" />}
                                    </button>

                                    {/* Custom Input Area (Shows when custom emotion selected) */}
                                    {isCustomEmotion && (
                                        <div className="col-span-2 mb-1 animate-in zoom-in-95 duration-200">
                                            <input
                                                type="text"
                                                value={customEmotionText}
                                                onChange={(e) => setCustomEmotionText(e.target.value)}
                                                placeholder="輸入情緒描述 (例如: 翻白眼、鄙視、崩潰)"
                                                className="w-full p-2.5 text-sm border-2 border-amber-200 rounded-lg focus:border-amber-400 outline-none bg-white"
                                                autoFocus
                                            />
                                        </div>
                                    )}

                                    {EMOTIONS.map(e => {
                                        const isSelected = tempEmotion === e.id;
                                        return (
                                            <button
                                                key={e.id}
                                                onClick={() => toggleEmotion(e.id)}
                                                className={`p-3 rounded-lg border text-xs text-left transition-all flex items-center justify-between ${isSelected
                                                        ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold ring-1 ring-amber-200'
                                                        : 'border-gray-200 bg-white text-gray-600 hover:border-amber-300 hover:shadow-sm'
                                                    }`}
                                            >
                                                <span className="truncate">{e.name}</span>
                                                {isSelected && <Check size={14} className="text-amber-600 shrink-0" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* STEP 2: Action */}
                        {step === 2 && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-200">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                        <Activity size={16} className="text-blue-500" /> 選擇角色動作
                                    </h3>
                                    <span className="text-xs text-gray-400">點擊切換，未選則配合情緒</span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 h-64 overflow-y-auto custom-scrollbar pr-1 content-start">
                                    {/* Same as Ref (Only if Ref Image exists) */}
                                    {hasReferenceImage && (
                                        <button
                                            onClick={() => toggleAction(SAME_AS_REF_ID)}
                                            className={`p-3 rounded-lg border text-xs font-bold text-left transition-all flex items-center gap-2 ${tempAction === SAME_AS_REF_ID
                                                    ? 'border-blue-500 bg-blue-50 text-blue-900 ring-1 ring-blue-200'
                                                    : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:shadow-sm'
                                                }`}
                                        >
                                            <Sparkles size={14} className={tempAction === SAME_AS_REF_ID ? 'text-blue-500' : 'text-gray-400'} />
                                            與原圖一致
                                            {tempAction === SAME_AS_REF_ID && <Check size={14} className="ml-auto text-blue-600" />}
                                        </button>
                                    )}

                                    {/* Custom Action */}
                                    <button
                                        onClick={() => toggleAction(CUSTOM_ACTION_ID)}
                                        className={`p-3 rounded-lg border text-xs font-bold text-left transition-all flex items-center gap-2 ${isCustomAction
                                                ? 'border-blue-500 bg-blue-50 text-blue-900 ring-1 ring-blue-200'
                                                : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:shadow-sm'
                                            }`}
                                    >
                                        <Edit2Icon size={14} className={isCustomAction ? 'text-blue-500' : 'text-gray-400'} />
                                        自訂動作
                                        {isCustomAction && <Check size={14} className="ml-auto text-blue-600" />}
                                    </button>

                                    {/* Custom Input Area (Shows when custom selected) */}
                                    {isCustomAction && (
                                        <div className="col-span-2 mb-1 animate-in zoom-in-95 duration-200">
                                            <input
                                                type="text"
                                                value={customActionText}
                                                onChange={(e) => setCustomActionText(e.target.value)}
                                                placeholder="輸入動作描述 (例如: 騎腳踏車、打掃房間)"
                                                className="w-full p-2.5 text-sm border-2 border-blue-200 rounded-lg focus:border-blue-400 outline-none bg-white"
                                                autoFocus
                                            />
                                        </div>
                                    )}

                                    {COMMON_ACTIONS.map(a => {
                                        const isSelected = tempAction === a.id;
                                        return (
                                            <button
                                                key={a.id}
                                                onClick={() => toggleAction(a.id)}
                                                className={`p-3 rounded-lg border text-xs text-left transition-all flex items-center justify-between ${isSelected
                                                        ? 'border-blue-500 bg-blue-50 text-blue-900 font-bold ring-1 ring-blue-200'
                                                        : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:shadow-sm'
                                                    }`}
                                            >
                                                <span className="truncate">{a.name}</span>
                                                {isSelected && <Check size={14} className="text-blue-600 shrink-0" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* STEP 3: Caption */}
                        {step === 3 && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-200 flex flex-col h-64">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                        <Type size={16} className="text-green-500" /> 貼圖台詞 (選填)
                                    </h3>
                                </div>

                                <div className="flex-1 flex flex-col justify-center gap-4 px-2">
                                    <input
                                        type="text"
                                        value={tempCaption}
                                        onChange={(e) => setTempCaption(e.target.value)}
                                        placeholder="請輸入台詞 (留空則不生成文字)"
                                        className="w-full p-4 text-base border-2 border-gray-200 rounded-xl focus:border-green-400 focus:ring-4 focus:ring-green-50 outline-none bg-white transition-all text-center placeholder-gray-300"
                                        autoFocus
                                    />
                                    <p className="text-center text-xs text-gray-400">
                                        Tip: 簡短的文字效果最好 (例如：早安、OK、謝謝)
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Wizard Footer / Navigation */}
                    <div className="bg-gray-50 border-t border-gray-200 p-3">
                        {/* Summary Bar */}
                        <div className="flex items-center gap-2 text-xs mb-3 px-1">
                            <span className="text-gray-400 font-medium">預覽:</span>
                            <span className={`px-2 py-0.5 rounded-md border ${tempEmotion === AUTO_MATCH_ID ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-amber-50 text-amber-700 border-amber-200 font-bold'}`}>
                                {summary.emoName}
                            </span>
                            <span className="text-gray-300">+</span>
                            <span className={`px-2 py-0.5 rounded-md border ${tempAction === AUTO_MATCH_ID ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-blue-50 text-blue-700 border-blue-200 font-bold'}`}>
                                {summary.actName}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Unified Reset Button (Always visible) */}
                            <button
                                onClick={resetWizard}
                                className="p-2.5 rounded-lg border border-gray-200 text-gray-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors"
                                title="重新設定"
                            >
                                <RefreshCcw size={18} />
                            </button>

                            {/* Next / Add Button */}
                            {step < 3 ? (
                                <button
                                    onClick={() => setStep(prev => prev + 1 as 1 | 2 | 3)}
                                    className="flex-1 bg-gray-900 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                                >
                                    下一步 <ArrowRight size={16} />
                                </button>
                            ) : (
                                <button
                                    onClick={handleAddSticker}
                                    disabled={!isValidPlan}
                                    className="flex-1 bg-gray-900 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-gray-800 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Plus size={16} /> 加入清單
                                </button>
                            )}
                        </div>
                        {!isValidPlan && step === 3 && (
                            <p className="text-[10px] text-red-500 text-center mt-2">
                                * 至少需指定「情緒」或「動作」其中一項，不能皆為自動。
                            </p>
                        )}
                    </div>
                </div>

                {/* Plan List */}
                {stickerPlan.length > 0 ? (
                    <div className="mt-6 space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                        {stickerPlan.map((item, _index) => {
                            const emoName = item.emotionId === AUTO_MATCH_ID ? '自動' :
                                item.emotionId === SAME_AS_REF_ID ? '原圖情緒' :
                                    item.emotionId === CUSTOM_EMOTION_ID ? (item.customEmotionText || '自訂') :
                                        EMOTIONS.find(e => e.id === item.emotionId)?.name || item.emotionId;

                            const actName = item.actionId === AUTO_MATCH_ID ? '自動' :
                                item.actionId === SAME_AS_REF_ID ? '原圖動作' :
                                    item.actionId === CUSTOM_ACTION_ID ? (item.customActionText || '自訂') :
                                        COMMON_ACTIONS.find(a => a.id === item.actionId)?.name || item.actionId;

                            return (
                                <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg shadow-sm hover:border-amber-200 transition-colors group">
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                        <div className="flex items-center gap-2 text-sm text-gray-800">
                                            <span className={`font-bold ${item.emotionId === AUTO_MATCH_ID ? 'text-gray-400' : 'text-amber-600'}`}>{emoName}</span>
                                            <span className="text-gray-300">+</span>
                                            <span className={`font-bold ${item.actionId === AUTO_MATCH_ID ? 'text-gray-400' : 'text-blue-600'}`}>{actName}</span>
                                        </div>
                                        {item.caption && (
                                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                                <Type size={10} /> "{item.caption}"
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => onRemoveFromPlan(item.id)}
                                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="mt-4 text-center py-6 text-gray-400 border border-dashed border-gray-200 rounded-lg bg-gray-50/30">
                        <p className="text-sm">尚未加入任何貼圖</p>
                    </div>
                )}
            </div>

            {/* === CARD 4: Theme === */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 z-10">
                <h2 className="text-lg font-bold flex items-center mb-4">
                    <span className="bg-black text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2 shrink-0">4</span>
                    特輯主題 (選填)
                </h2>
                <div className="relative">
                    <div className="absolute top-3 left-3 text-gray-400"><Gift size={18} /></div>
                    <input
                        type="text"
                        value={themeText}
                        onChange={(e) => onThemeChange(e.target.value)}
                        placeholder="例如：聖誕節、職場厭世、萬聖節變裝..."
                        className="w-full border border-gray-300 rounded-xl p-3 pl-10 text-sm focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none bg-white transition-all hover:border-amber-300"
                    />
                </div>
            </div>
        </div>
    );
};

// Helper Icon for Custom Action
const Edit2Icon = ({ size, className }: { size: number, className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
    </svg>
);