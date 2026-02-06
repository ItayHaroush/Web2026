import { FaTimes, FaListUl, FaCheckCircle, FaCheck, FaChevronUp, FaChevronDown } from 'react-icons/fa';
import { BADGE_OPTIONS } from '../shared/presetStyles';

export default function ScreenItemsModal({
    show,
    loading,
    allMenuItems,
    selectedItems,
    tier,
    onToggleItem,
    onToggleBadge,
    onMoveItem,
    onSave,
    onClose,
}) {
    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[3.5rem] shadow-2xl max-w-4xl w-full overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-10 py-8 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-amber-100 rounded-[1.5rem] text-amber-600 shadow-sm">
                            <FaListUl size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 tracking-tight">בחירת פריטים</h2>
                            <p className="text-gray-500 font-medium text-sm mt-0.5">בחרו פריטים וסדרו אותם לפי העדפה</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-2xl transition-all"
                    >
                        <FaTimes size={24} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-amber-500"></div>
                    </div>
                ) : (
                    <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
                        {/* Left: All menu items */}
                        <div className="flex-1 border-l border-gray-100 overflow-y-auto p-6 custom-scrollbar">
                            <h3 className="font-black text-gray-700 mb-4 text-sm uppercase tracking-widest">כל הפריטים</h3>
                            {allMenuItems.length === 0 ? (
                                <p className="text-gray-400 text-center py-10">אין פריטי תפריט</p>
                            ) : (
                                <div className="space-y-2">
                                    {allMenuItems.map((item) => {
                                        const isSelected = selectedItems.some(s => s.menu_item_id === item.id);
                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => onToggleItem(item)}
                                                className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-right ${
                                                    isSelected
                                                        ? 'bg-amber-50 border-2 border-amber-300'
                                                        : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                                                }`}
                                            >
                                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                                                    isSelected ? 'bg-amber-500 text-white' : 'bg-gray-200'
                                                }`}>
                                                    {isSelected && <FaCheck size={10} />}
                                                </div>
                                                {item.image_url && (
                                                    <img src={item.image_url} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-black text-sm text-gray-800 truncate">{item.name}</div>
                                                    <div className="text-[10px] text-gray-400 font-medium">
                                                        {item.category?.name || item.category_name || ''} | {item.price} ₪
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Right: Selected items with reorder */}
                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 custom-scrollbar">
                            <h3 className="font-black text-gray-700 mb-4 text-sm uppercase tracking-widest">
                                נבחרו ({selectedItems.length})
                            </h3>
                            {selectedItems.length === 0 ? (
                                <p className="text-gray-400 text-center py-10 text-sm">לחצו על פריטים מהרשימה להוספה</p>
                            ) : (
                                <div className="space-y-2">
                                    {selectedItems.map((item, index) => (
                                        <div
                                            key={item.menu_item_id}
                                            className="p-3 bg-white rounded-2xl border border-gray-100 shadow-sm"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex flex-col gap-0.5 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => onMoveItem(index, -1)}
                                                        disabled={index === 0}
                                                        className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30 transition-colors"
                                                    >
                                                        <FaChevronUp size={10} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onMoveItem(index, 1)}
                                                        disabled={index === selectedItems.length - 1}
                                                        className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30 transition-colors"
                                                    >
                                                        <FaChevronDown size={10} />
                                                    </button>
                                                </div>
                                                <span className="text-xs font-black text-gray-300 w-5 text-center">{index + 1}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-black text-sm text-gray-800 truncate">{item.name}</div>
                                                    <div className="text-[10px] text-gray-400">{item.category} | {item.price} ₪</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => onToggleItem({ id: item.menu_item_id })}
                                                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                                >
                                                    <FaTimes size={12} />
                                                </button>
                                            </div>
                                            {/* Badge toggles - Pro Only */}
                                            {tier === 'pro' && (
                                                <div className="flex gap-1.5 mt-2 mr-10">
                                                    {BADGE_OPTIONS.map(badge => {
                                                        const active = (item.badge || []).includes(badge.id);
                                                        return (
                                                            <button
                                                                key={badge.id}
                                                                type="button"
                                                                onClick={() => onToggleBadge(item.menu_item_id, badge.id)}
                                                                className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
                                                                    active
                                                                        ? 'bg-amber-100 border border-amber-300 text-amber-700'
                                                                        : 'bg-gray-100 border border-transparent text-gray-400 hover:bg-gray-200'
                                                                }`}
                                                                title={badge.label}
                                                            >
                                                                {badge.emoji}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Save Button */}
                <div className="p-6 border-t border-gray-100 flex gap-4 shrink-0">
                    <button
                        onClick={onSave}
                        className="flex-1 bg-brand-primary text-white py-4 rounded-2xl font-black text-lg hover:bg-brand-dark transition-all shadow-xl shadow-brand-primary/20 active:scale-95 flex items-center justify-center gap-3"
                    >
                        <FaCheckCircle size={18} /> שמור פריטים
                    </button>
                    <button
                        onClick={onClose}
                        className="px-8 py-4 bg-gray-100 text-gray-700 rounded-2xl font-black hover:bg-gray-200 transition-all active:scale-95"
                    >
                        ביטול
                    </button>
                </div>
            </div>
        </div>
    );
}
