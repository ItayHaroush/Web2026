import { useEffect, useState } from 'react';
import { FaCheckCircle } from 'react-icons/fa';
import { KIOSK_DEFAULTS } from '../shared/kioskDefaults';

export default function KioskOrderConfirm({ orderId, totalAmount, onReset }) {
    const [countdown, setCountdown] = useState(KIOSK_DEFAULTS.auto_reset_delay);

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    onReset();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [onReset]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-50 to-white p-4 sm:p-8">
            <div className="bg-white rounded-[2rem] sm:rounded-[3rem] shadow-2xl p-6 sm:p-12 max-w-md w-full text-center">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8">
                    <FaCheckCircle className="text-green-500 text-4xl sm:text-5xl" />
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">ההזמנה נקלטה!</h1>

                <div className="bg-gray-50 rounded-2xl p-4 sm:p-6 my-4 sm:my-6">
                    <p className="text-gray-500 font-bold text-sm">מספר הזמנה</p>
                    <p className="text-4xl sm:text-5xl font-black text-amber-600 mt-1">#{orderId}</p>
                </div>

                <p className="text-lg sm:text-xl font-black text-gray-700 mb-2">
                    סה"כ: {totalAmount.toFixed(2)} ₪
                </p>

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mt-6">
                    <p className="text-amber-800 font-black text-lg">
                        נא לשלם בקופה
                    </p>
                </div>

                <button
                    onClick={onReset}
                    className="mt-6 sm:mt-8 bg-gray-900 text-white font-black text-base sm:text-lg px-8 py-3.5 sm:px-10 sm:py-4 rounded-2xl hover:bg-gray-800 active:scale-95 transition-all shadow-xl"
                >
                    הזמנה חדשה
                </button>

                <p className="text-gray-400 text-sm font-medium mt-4">
                    חוזר למסך הראשי בעוד {countdown} שניות
                </p>
            </div>
        </div>
    );
}
