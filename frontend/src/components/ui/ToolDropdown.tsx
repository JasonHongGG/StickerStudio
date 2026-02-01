import React, { useState } from 'react';
import { TOOLS, ToolId, FUTURE_TOOLS } from '../../config/tools';
import { ChevronDown, LayoutGrid, Wrench } from 'lucide-react';

interface ToolDropdownProps {
    currentToolId?: ToolId | 'main'; // 'main' if on dashboard
    onSelect: (id: ToolId) => void;
    viewMode: 'main' | 'tool'; // 'main' = Wrench icon, 'tool' = "Switch Tools" button
}

export const ToolDropdown: React.FC<ToolDropdownProps> = ({ currentToolId, onSelect, viewMode }) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleSelect = (id: ToolId) => {
        onSelect(id);
        setIsOpen(false);
    };

    return (
        <div className="relative">
            {/* Trigger Button */}
            {viewMode === 'main' ? (
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`p-2 rounded-full transition-all ${isOpen ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}
                    title="實用工具集"
                >
                    <Wrench size={20} />
                </button>
            ) : (
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all"
                >
                    <LayoutGrid size={20} />
                    <span className="font-medium text-sm">切換工具</span>
                    <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
            )}

            {/* Dropdown Content */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                        {viewMode === 'main' ? '可用工具' : '快速切換'}
                    </div>

                    {TOOLS.map((tool) => {
                        const Icon = tool.icon;
                        const isSelected = currentToolId === tool.id;
                        return (
                            <button
                                key={tool.id}
                                onClick={() => handleSelect(tool.id)}
                                className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors group"
                            >
                                <div className={`border p-2 rounded-lg transition-colors ${isSelected ? 'bg-black border-black text-white' : 'bg-white border-gray-200 text-gray-900 group-hover:border-gray-300'}`}>
                                    <Icon size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <div className={`font-bold text-sm ${isSelected ? 'text-black' : 'text-gray-900'}`}>{tool.name}</div>
                                        {tool.status === 'new' && <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold">NEW</span>}
                                        {tool.status === 'beta' && <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold">BETA</span>}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {tool.description}
                                    </div>
                                </div>
                            </button>
                        );
                    })}

                    <div className="border-t border-gray-100 my-1"></div>

                    {FUTURE_TOOLS.map((item, idx) => (
                        <div key={idx} className="px-4 py-3 flex items-center gap-3 opacity-50 cursor-not-allowed">
                            <div className="bg-gray-100 p-2 rounded-lg text-gray-400">
                                <item.icon size={18} />
                            </div>
                            <div>
                                <div className="font-bold text-gray-400 text-sm">{item.name}</div>
                                <div className="text-xs text-gray-400">{item.description}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
