import { useState } from 'react';
import { FaTimes, FaMinus, FaPlus, FaShoppingCart } from 'react-icons/fa';
import { calculateUnitPrice } from '../../../utils/cart';

export default function KioskItemDetail({ item, onAddToCart, onClose, orderType, enableDineInPricing }) {
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [selectedAddons, setSelectedAddons] = useState([]);
    const [qty, setQty] = useState(1);

    const dineInAdjustment = (orderType === 'dine_in' && enableDineInPricing) ? (item.dine_in_adjustment || 0) : 0;

    const unitPrice = calculateUnitPrice(
        item.price,
        selectedVariant,
        selectedAddons,
        dineInAdjustment
    );
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
        onAddToCart(item, selectedVariant, selectedAddons, qty, dineInAdjustment);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center">
            <div className="bg-white w-full sm:max-w-2xl rounded-t-[1.5rem] sm:rounded-t-[2rem] max-h-[90vh] sm:max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300">
                {/* Header image */}
                <div className="relative shrink-0">
                    {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-48 object-cover rounded-t-[2rem]" />
                    ) : (
                        <div className="w-full h-48 bg-gradient-to-br from-amber-100 to-amber-200 rounded-t-[2rem] flex items-center justify-center">
                            <span className="text-6xl">🍽️</span>
                        </div>
                    )}
                    <button
                        onClick={onClose}
                        className="absolute top-4 left-4 bg-white/90 p-3 rounded-full shadow-lg hover:bg-white transition-all"
                    >
                        <FaTimes size={18} className="text-gray-600" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900">{item.name}</h2>
                        {item.description && (
                            <p className="text-gray-500 mt-2 font-medium">{item.description}</p>
                        )}
                        <p className="text-xl font-black text-amber-600 mt-2">{Number((item.price + dineInAdjustment).toFixed(2)).toFixed(2)} ₪</p>
                    </div>

                    {/* Variants */}
                    {item.variants && item.variants.length > 0 && (
                        <div>
                            <h3 className="font-black text-gray-700 text-sm uppercase tracking-widest mb-3">בחרו גודל</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {item.variants.map(v => (
                                    <button
                                        key={v.id}
                                        onClick={() => setSelectedVariant(selectedVariant?.id === v.id ? null : v)}
                                        className={`p-3 rounded-xl border-2 text-sm font-bold transition-all ${selectedVariant?.id === v.id
                                                ? 'bg-amber-50 border-amber-400 text-amber-700'
                                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                            }`}
                                    >
                                        <span>{v.name}</span>
                                        {v.price_delta !== 0 && (
                                            <span className="text-xs mr-1">
                                                ({v.price_delta > 0 ? '+' : ''}{v.price_delta.toFixed(2)} ₪)
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Addon Groups */}
                    {item.addon_groups && item.addon_groups.map(group => (
                        <div key={group.id}>
                            <h3 className="font-black text-gray-700 text-sm uppercase tracking-widest mb-1">{group.name}</h3>
                            {group.is_required && (
                                <p className="text-xs text-red-500 font-bold mb-2">
                                    חובה לבחור {group.min_selections > 0 ? `לפחות ${group.min_selections}` : ''}
                                </p>
                            )}
                            {group.max_selections && (
                                <p className="text-xs text-gray-400 font-medium mb-2">
                                    עד {group.max_selections} תוספות
                                </p>
                            )}
                            <div className="space-y-2">
                                {group.addons.map(addon => {
                                    const isSelected = selectedAddons.some(a => a.id === addon.id);
                                    return (
                                        <div key={addon.id} className="flex items-center gap-2">
                                            <button
                                                onClick={() => toggleAddon(addon)}
                                                className={`flex-1 flex items-center justify-between p-3 rounded-xl border-2 transition-all ${isSelected
                                                        ? 'bg-amber-50 border-amber-300 text-amber-700'
                                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                    }`}
                                            >
                                                <span className="font-bold text-sm">{addon.name}</span>
                                                {addon.price_delta > 0 && (
                                                    <span className="text-xs font-bold">+{addon.price_delta.toFixed(2)} ₪</span>
                                                )}
                                            </button>
                                            {isSelected && (
                                                <button
                                                    onClick={() => toggleAddonOnSide(addon.id)}
                                                    className={`px-3 py-3 rounded-xl text-xs font-bold border-2 transition-all whitespace-nowrap ${selectedAddons.find(a => a.id === addon.id)?.on_side
                                                            ? 'bg-blue-50 border-blue-300 text-blue-600'
                                                            : 'bg-gray-50 border-gray-200 text-gray-400'
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

                    {/* Quantity */}
                    <div className="flex items-center justify-center gap-6">
                        <button
                            onClick={() => setQty(Math.max(1, qty - 1))}
                            className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 active:scale-95 transition-all"
                        >
                            <FaMinus />
                        </button>
                        <span className="text-3xl font-black text-gray-900 w-12 text-center">{qty}</span>
                        <button
                            onClick={() => setQty(qty + 1)}
                            className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 active:scale-95 transition-all"
                        >
                            <FaPlus />
                        </button>
                    </div>
                </div>

                {/* Add to cart button */}
                <div className="p-4 sm:p-6 border-t border-gray-100 shrink-0">
                    <button
                        onClick={handleAdd}
                        className="w-full bg-amber-500 hover:bg-amber-400 text-white font-black text-lg sm:text-xl py-4 sm:py-5 rounded-2xl shadow-xl shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                        <FaShoppingCart size={20} />
                        הוסף לסל - {totalPrice.toFixed(2)} ₪
                    </button>
                </div>
            </div>
        </div>
    );
}
