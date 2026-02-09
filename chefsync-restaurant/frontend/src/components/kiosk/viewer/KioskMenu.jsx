import { useState } from 'react';

export default function KioskMenu({ categories, items, onSelectItem, orderType, enableDineInPricing }) {
    const [activeCategory, setActiveCategory] = useState(null);

    const getDisplayPrice = (item) => {
        const base = item.price;
        if (orderType === 'dine_in' && enableDineInPricing && item.dine_in_adjustment != null && item.dine_in_adjustment !== 0) {
            return Number((base + item.dine_in_adjustment).toFixed(2));
        }
        return base;
    };

    const filteredItems = activeCategory
        ? items.filter(item => item.category_id === activeCategory)
        : items;

    return (
        <div className="flex flex-col flex-1 min-h-0">
            {/* Category tabs */}
            {categories.length > 1 && (
                <div className="bg-gray-50 border-b border-gray-100 px-4 py-3 overflow-x-auto flex gap-2 shrink-0">
                    <button
                        onClick={() => setActiveCategory(null)}
                        className={`px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeCategory === null
                            ? 'bg-amber-500 text-white shadow-lg'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                            }`}
                    >
                        הכל
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeCategory === cat.id
                                ? 'bg-amber-500 text-white shadow-lg'
                                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                }`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Items grid */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => onSelectItem(item)}
                            className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-lg hover:border-amber-200 active:scale-[0.98] transition-all text-right"
                        >
                            {item.image_url ? (
                                <img
                                    src={item.image_url}
                                    alt={item.name}
                                    className="w-full h-36 object-cover"
                                />
                            ) : (
                                <div className="w-full h-36 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                                    <span className="text-4xl">🍽️</span>
                                </div>
                            )}
                            <div className="p-3">
                                <h3 className="font-black text-gray-900 text-sm truncate">{item.name}</h3>
                                {item.description && (
                                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{item.description}</p>
                                )}
                                <div className="mt-2 font-black text-amber-600 text-lg">
                                    {getDisplayPrice(item).toFixed(2)} ₪
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
                {filteredItems.length === 0 && (
                    <div className="flex items-center justify-center py-20 text-gray-400 font-bold">
                        אין פריטים להצגה
                    </div>
                )}
            </div>
        </div>
    );
}
