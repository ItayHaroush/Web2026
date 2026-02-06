import { FaShoppingCart } from 'react-icons/fa';

export default function KioskHeader({ restaurant, totalItems, totalPrice, onCartClick }) {
    return (
        <div className="bg-white border-b border-gray-100 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {restaurant?.logo_url && (
                    <img src={restaurant.logo_url} alt="" className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl object-cover shrink-0" />
                )}
                <span className="font-black text-gray-900 text-sm sm:text-lg truncate">{restaurant?.name || ''}</span>
            </div>
            <button
                onClick={onCartClick}
                className="relative bg-amber-500 text-white px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl font-black flex items-center gap-2 sm:gap-3 hover:bg-amber-400 active:scale-95 transition-all shadow-lg shadow-amber-500/20 shrink-0 text-sm sm:text-base"
            >
                <FaShoppingCart size={18} />
                <span>{totalPrice.toFixed(2)} ₪</span>
                {totalItems > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center">
                        {totalItems}
                    </span>
                )}
            </button>
        </div>
    );
}
