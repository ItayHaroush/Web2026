import { FaUtensils, FaShoppingBag } from 'react-icons/fa';

export default function KioskOrderType({ onSelect }) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white p-4 sm:p-8">
            <h1 className="text-2xl sm:text-4xl font-black mb-8 sm:mb-16 text-center">איך תרצה את ההזמנה?</h1>

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 w-full max-w-2xl px-2 sm:px-4">
                <button
                    onClick={() => onSelect('dine_in')}
                    className="flex-1 bg-white/10 hover:bg-white/20 border-2 border-white/20 hover:border-amber-400 rounded-[2rem] sm:rounded-[2.5rem] p-8 sm:p-12 flex flex-col items-center gap-4 sm:gap-6 active:scale-95 transition-all group"
                >
                    <div className="w-16 h-16 sm:w-24 sm:h-24 bg-amber-500/20 rounded-full flex items-center justify-center group-hover:bg-amber-500/30 transition-colors">
                        <FaUtensils className="text-amber-400 text-2xl sm:text-4xl" />
                    </div>
                    <span className="text-xl sm:text-2xl font-black">לשבת במקום</span>
                </button>

                <button
                    onClick={() => onSelect('takeaway')}
                    className="flex-1 bg-white/10 hover:bg-white/20 border-2 border-white/20 hover:border-amber-400 rounded-[2rem] sm:rounded-[2.5rem] p-8 sm:p-12 flex flex-col items-center gap-4 sm:gap-6 active:scale-95 transition-all group"
                >
                    <div className="w-16 h-16 sm:w-24 sm:h-24 bg-amber-500/20 rounded-full flex items-center justify-center group-hover:bg-amber-500/30 transition-colors">
                        <FaShoppingBag className="text-amber-400 text-2xl sm:text-4xl" />
                    </div>
                    <span className="text-xl sm:text-2xl font-black">לקחת</span>
                </button>
            </div>
        </div>
    );
}
