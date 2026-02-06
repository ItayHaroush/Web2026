import { FaUtensils, FaTimesCircle } from 'react-icons/fa';

export default function KioskWelcome({ restaurant, tableNumber, onStart }) {
    const isOpen = restaurant?.is_open_now !== false;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white p-4 sm:p-8">
            {restaurant?.logo_url && (
                <img
                    src={restaurant.logo_url}
                    alt={restaurant.name}
                    className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl sm:rounded-3xl object-cover mb-6 sm:mb-8 shadow-2xl"
                />
            )}
            <h1 className="text-3xl sm:text-5xl font-black mb-3 sm:mb-4 text-center">{restaurant?.name || ''}</h1>
            {tableNumber && (
                <div className="bg-amber-500/20 border border-amber-500/30 rounded-2xl px-6 py-3 mb-4">
                    <p className="text-amber-400 font-black text-lg sm:text-xl">שולחן {tableNumber}</p>
                </div>
            )}

            {isOpen ? (
                <>
                    <p className="text-base sm:text-xl text-gray-400 mb-10 sm:mb-16 font-medium">הזמינו ישירות מהמסך</p>
                    <button
                        onClick={onStart}
                        className="bg-amber-500 hover:bg-amber-400 text-gray-900 font-black text-xl sm:text-3xl px-10 py-5 sm:px-16 sm:py-8 rounded-2xl sm:rounded-[2rem] shadow-2xl shadow-amber-500/30 active:scale-95 transition-all flex items-center gap-3 sm:gap-4"
                    >
                        <FaUtensils className="text-xl sm:text-3xl" />
                        התחל הזמנה
                    </button>
                </>
            ) : (
                <div className="flex flex-col items-center gap-4 mt-4">
                    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-8 py-6 text-center">
                        <FaTimesCircle className="text-red-400 text-3xl sm:text-4xl mx-auto mb-3" />
                        <p className="text-red-400 font-black text-xl sm:text-2xl">המסעדה סגורה כרגע</p>
                        <p className="text-gray-500 font-medium text-sm sm:text-base mt-2">לא ניתן לבצע הזמנות בזמן זה</p>
                    </div>
                </div>
            )}
        </div>
    );
}
