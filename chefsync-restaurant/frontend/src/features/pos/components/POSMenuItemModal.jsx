import { useState } from 'react';
import { FaTimes, FaMinus, FaPlus, FaShoppingCart } from 'react-icons/fa';
import { calculateUnitPrice, buildCartKey } from '../../../utils/cart';

/**
 * בחירת וריאציה ותוספות לפריט POS — התאמה לזרימת קיוסק/אתר.
 */
export default function POSMenuItemModal({ item, onAdd, onClose }) {
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [selectedAddons, setSelectedAddons] = useState([]);
    const [qty, setQty] = useState(1);

    const unitPrice = calculateUnitPrice(item.price, selectedVariant, selectedAddons, 0);
    const totalPrice = Number((unitPrice * qty).toFixed(2));

    const toggleAddon = (addon) => {
        setSelectedAddons(prev => {
            const exists = prev.find(a => a.id === addon.id);
            if (exists) {
                return prev.filter(a => a.id !== addon.id);
            }
            return [...prev, { ...addon, on_side: false }];
        });
    };

    const toggleAddonOnSide = (addonId) => {
        setSelectedAddons(prev =>
            prev.map(a => a.id === addonId ? { ...a, on_side: !a.on_side } : a)
        );
    };

    const handleAdd = () => {
        const addonsPayload = selectedAddons.map(a => ({
            id: a.id,
            name: a.name,
            price: a.price_delta ?? a.price ?? 0,
            on_side: a.on_side || false,
        }));
        const line = {
            menu_item_id: item.id,
            name: item.name,
            price: calculateUnitPrice(item.price, selectedVariant, [], 0),
            quantity: qty,
            variant_name: selectedVariant?.name ?? null,
            addons: addonsPayload,
            _cartKey: buildCartKey(item.id, selectedVariant, selectedAddons),
        };
        onAdd(line);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[400] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
            <div
                className="bg-slate-800 w-full sm:max-w-lg sm:rounded-3xl max-h-[90vh] flex flex-col border border-slate-700 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                <div className="relative shrink-0">
                    {item.image_url ? (
                        <img src={item.image_url} alt="" className="w-full h-44 sm:h-48 object-cover sm:rounded-t-3xl" />
                    ) : (
                        <div className="w-full h-44 sm:h-48 bg-slate-900 sm:rounded-t-3xl flex items-center justify-center text-5xl">🍽️</div>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-3 left-3 p-2.5 rounded-full bg-slate-900/90 text-slate-300 hover:text-white border border-slate-600"
                    >
                        <FaTimes size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
                    <div>
                        <h2 className="text-xl font-black text-white">{item.name}</h2>
                        {item.description && (
                            <p className="text-slate-400 text-sm mt-1">{item.description}</p>
                        )}
                        <p className="text-orange-400 font-black text-lg mt-2">₪{Number(item.price).toFixed(2)}</p>
                    </div>

                    {item.variants && item.variants.length > 0 && (
                        <div>
                            <h3 className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">בחירת וריאציה</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {item.variants.map(v => (
                                    <button
                                        key={v.id}
                                        type="button"
                                        onClick={() => setSelectedVariant(selectedVariant?.id === v.id ? null : v)}
                                        className={`p-3 rounded-xl border text-sm font-bold transition-all ${selectedVariant?.id === v.id
                                            ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                                            }`}
                                    >
                                        <span>{v.name}</span>
                                        {v.price_delta !== 0 && (
                                            <span className="text-xs mr-1">
                                                ({v.price_delta > 0 ? '+' : ''}{Number(v.price_delta).toFixed(2)} ₪)
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {item.addon_groups && item.addon_groups.map(group => (
                        <div key={group.id}>
                            <h3 className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">{group.name}</h3>
                            {group.is_required && (
                                <p className="text-xs text-amber-400 font-bold mb-2">חובה לבחור</p>
                            )}
                            <div className="space-y-2">
                                {group.addons && group.addons.map(addon => {
                                    const isSelected = selectedAddons.some(a => a.id === addon.id);
                                    return (
                                        <div key={addon.id} className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => toggleAddon(addon)}
                                                className={`flex-1 flex items-center justify-between p-3 rounded-xl border transition-all ${isSelected
                                                    ? 'bg-orange-500/15 border-orange-500/50 text-orange-200'
                                                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                                                    }`}
                                            >
                                                <span className="font-bold text-sm">{addon.name}</span>
                                                {(addon.price_delta ?? 0) > 0 && (
                                                    <span className="text-xs font-bold">+{Number(addon.price_delta).toFixed(2)} ₪</span>
                                                )}
                                            </button>
                                            {isSelected && (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleAddonOnSide(addon.id)}
                                                    className={`px-3 py-3 rounded-xl text-xs font-bold border whitespace-nowrap ${selectedAddons.find(a => a.id === addon.id)?.on_side
                                                        ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                                                        : 'bg-slate-900 border-slate-700 text-slate-500'
                                                        }`}
                                                >
                                                    בצד
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    <div className="flex items-center justify-center gap-6 py-2">
                        <button
                            type="button"
                            onClick={() => setQty(Math.max(1, qty - 1))}
                            className="w-11 h-11 rounded-xl bg-slate-700 text-white flex items-center justify-center hover:bg-slate-600 active:scale-95"
                        >
                            <FaMinus />
                        </button>
                        <span className="text-2xl font-black text-white w-10 text-center">{qty}</span>
                        <button
                            type="button"
                            onClick={() => setQty(qty + 1)}
                            className="w-11 h-11 rounded-xl bg-slate-700 text-white flex items-center justify-center hover:bg-slate-600 active:scale-95"
                        >
                            <FaPlus />
                        </button>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-700 shrink-0 sm:rounded-b-3xl">
                    <button
                        type="button"
                        onClick={handleAdd}
                        className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg shadow-orange-500/20"
                    >
                        <FaShoppingCart size={18} />
                        הוסף לסל — ₪{totalPrice.toFixed(2)}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function posItemNeedsConfiguration(item) {
    const v = item.variants && item.variants.length > 0;
    const a = item.addon_groups && item.addon_groups.length > 0;
    return v || a;
}
