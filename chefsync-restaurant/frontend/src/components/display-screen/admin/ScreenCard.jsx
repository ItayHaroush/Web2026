import {
    FaTv, FaEdit, FaTrash, FaCopy, FaSync,
    FaToggleOn, FaToggleOff, FaExternalLinkAlt,
    FaListUl, FaCheck
} from 'react-icons/fa';
import { DESIGN_PRESETS } from '../shared/presetStyles';

const getScreenViewUrl = (token) => `${window.location.origin}/screen/${token}`;

export default function ScreenCard({
    screen,
    copiedId,
    isManager,
    onEdit,
    onDelete,
    onToggle,
    onRegenerate,
    onCopyLink,
    onOpenItems,
}) {
    return (
        <div
            className={`group bg-white rounded-[3rem] shadow-sm border p-8 flex flex-col gap-6 hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 relative overflow-hidden ${!screen.is_active ? 'border-gray-200 opacity-60' : 'border-gray-100'}`}
        >
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-indigo-50 rounded-[1.5rem] flex items-center justify-center text-indigo-600 shadow-inner group-hover:scale-110 transition-transform duration-500">
                        <FaTv size={24} />
                    </div>
                    <div>
                        <h3 className="font-black text-gray-900 text-xl leading-tight group-hover:text-indigo-600 transition-colors">
                            {screen.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${screen.display_type === 'rotating'
                                ? 'bg-purple-50 text-purple-600 border-purple-100'
                                : 'bg-gray-100 text-gray-500 border-gray-100'
                                }`}>
                                {screen.display_type === 'rotating' ? 'קרוסלה' : 'סטטי'}
                            </span>
                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${screen.content_mode === 'manual'
                                ? 'bg-amber-50 text-amber-600 border-amber-100'
                                : 'bg-teal-50 text-teal-600 border-teal-100'
                                }`}>
                                {screen.content_mode === 'manual' ? 'ידני' : 'אוטומטי'}
                            </span>
                            {screen.aspect_ratio && screen.aspect_ratio !== '16:9' && (
                                <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border bg-blue-50 text-blue-600 border-blue-100">
                                    {screen.aspect_ratio}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${screen.is_connected ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`}></span>
                    <span className={`text-xs font-black ${screen.is_connected ? 'text-green-600' : 'text-red-400'}`}>
                        {screen.is_connected ? 'מחובר' : 'מנותק'}
                    </span>
                </div>
            </div>

            {/* Info */}
            <div className="flex items-center gap-3 text-sm text-gray-500">
                <span className="font-bold">עיצוב: {DESIGN_PRESETS.find(p => p.id === screen.design_preset)?.label || screen.design_preset}</span>
                <span>|</span>
                <span className="font-bold">רענון: {screen.refresh_interval}s</span>
                {screen.display_type === 'rotating' && (
                    <>
                        <span>|</span>
                        <span className="font-bold">סיבוב: {screen.rotation_speed}s</span>
                    </>
                )}
            </div>

            {/* Link */}
            <div className="flex items-center gap-2 bg-gray-50 rounded-2xl p-3">
                <input
                    type="text"
                    value={getScreenViewUrl(screen.token)}
                    readOnly
                    className="flex-1 bg-transparent border-none text-sm text-gray-600 font-mono truncate focus:outline-none"
                    dir="ltr"
                />
                <button
                    onClick={() => onCopyLink(screen)}
                    className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all"
                    title="העתק קישור"
                >
                    {copiedId === screen.id ? <FaCheck size={14} /> : <FaCopy size={14} />}
                </button>
                <a
                    href={getScreenViewUrl(screen.token)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all"
                    title="פתח בחלון חדש"
                >
                    <FaExternalLinkAlt size={14} />
                </a>
            </div>

            {/* Actions */}
            {isManager && (
                <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-50">
                    <button
                        onClick={() => onEdit(screen)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all text-sm font-black"
                    >
                        <FaEdit size={14} /> ערוך
                    </button>
                    {screen.content_mode === 'manual' && (
                        <button
                            onClick={() => onOpenItems(screen.id)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-600 hover:text-white transition-all text-sm font-black"
                        >
                            <FaListUl size={14} /> תוכן
                        </button>
                    )}
                    <button
                        onClick={() => onToggle(screen.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all text-sm font-black ${screen.is_active
                            ? 'bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white'
                            : 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white'
                            }`}
                    >
                        {screen.is_active ? <FaToggleOff size={14} /> : <FaToggleOn size={14} />}
                        {screen.is_active ? 'השבת' : 'הפעל'}
                    </button>
                    <button
                        onClick={() => onRegenerate(screen.id)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all text-sm font-black"
                    >
                        <FaSync size={14} /> חדש קישור
                    </button>
                    <button
                        onClick={() => onDelete(screen.id)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all text-sm font-black"
                    >
                        <FaTrash size={14} /> מחק
                    </button>
                </div>
            )}
        </div>
    );
}
