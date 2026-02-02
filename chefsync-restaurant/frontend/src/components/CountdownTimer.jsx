import { useState, useEffect } from 'react';
import { FaClock } from 'react-icons/fa';

/**
 * קומפוננט שעון ספירה לאחור עם עיצוב אטרקטיבי
 * @param {Date|string} startTime - זמן קבלת ההזמנה (created_at)
 * @param {number} etaMinutes - זמן הכנה משוער בדקות
 * @param {string} etaNote - הערה נוספת על הזמן
 * @param {string} deliveryMethod - סוג ההזמנה: 'delivery' או 'pickup'
 * @param {string} orderStatus - סטטוס ההזמנה
 * @param {React.ReactNode} children - תוכן נוסף להצגה (כמו ביקורת)
 */
export default function CountdownTimer({ startTime, etaMinutes, etaNote, deliveryMethod = 'delivery', orderStatus, children }) {
    const [timeLeft, setTimeLeft] = useState(null);
    const [hasChanged, setHasChanged] = useState(false);

    useEffect(() => {
        // אם ההזמנה נמסרה - אל תעדכן
        if (orderStatus === 'delivered') {
            return;
        }

        // אם אין eta_minutes - הצג מצב המתנה
        if (!etaMinutes) {
            setTimeLeft(null);
            return;
        }

        // חישוב זמן יעד
        const start = new Date(startTime);
        const targetTime = new Date(start.getTime() + etaMinutes * 60 * 1000);

        const calculateTimeLeft = () => {
            const now = new Date();
            const diff = targetTime - now;

            if (diff <= 0) {
                return { minutes: 0, seconds: 0, isZero: true };
            }

            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            return { minutes, seconds, isZero: false };
        };

        // עדכון ראשוני
        setTimeLeft(calculateTimeLeft());

        // עדכון כל שנייה
        const interval = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => clearInterval(interval);
    }, [startTime, etaMinutes, orderStatus]);

    // אנימציית מעבר כשהזמן משתנה
    useEffect(() => {
        setHasChanged(true);
        const timer = setTimeout(() => setHasChanged(false), 500);
        return () => clearTimeout(timer);
    }, [etaMinutes]);

    // אם ההזמנה נמסרה - הצג הודעת סיום
    if (orderStatus === 'delivered') {
        return (
            <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl sm:rounded-2xl p-6 sm:p-8 shadow-lg border-2 border-green-300">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-xl">
                        <span className="text-4xl sm:text-5xl">🎉</span>
                    </div>
                    <div className="text-center space-y-2">
                        <p className="text-xl sm:text-2xl font-black text-gray-800">
                            {deliveryMethod === 'pickup' ? 'ההזמנה נאספה' : 'השליח כבר בדלת!'}
                        </p>
                        <p className="text-base sm:text-lg font-bold text-green-700">
                            בתאבון! 🍽️
                        </p>
                    </div>
                    
                    {/* תוכן נוסף - ביקורת */}
                    {children && (
                        <div className="w-full mt-4">
                            {children}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // אם אין זמן משוער - הצג מצב המתנה
    if (!etaMinutes) {
        return (
            <div className="bg-gradient-to-br from-brand-light to-blue-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg border-2 border-brand-primary/30">
                <div className="flex flex-col items-center gap-3 sm:gap-4">
                    {/* אנימציית טעינה מעגלית */}
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24">
                        <svg className="animate-spin" viewBox="0 0 100 100">
                            <circle
                                cx="50"
                                cy="50"
                                r="40"
                                fill="none"
                                stroke="#009DE0"
                                strokeWidth="8"
                                strokeDasharray="63 189"
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <FaClock className="text-2xl sm:text-3xl text-brand-primary" />
                        </div>
                    </div>
                    <div className="text-center">
                        <p className="text-base sm:text-lg font-bold text-gray-800">
                            ממתינים שהמסעדה תקבל את ההזמנה שלכם
                        </p>
                        <p className="text-xs sm:text-sm text-gray-600 mt-1">
                            הזמן המשוער יעודכן בקרוב
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // אם הזמן אזל
    if (timeLeft?.isZero) {
        return (
            <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg border-2 border-brand-success/50">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-brand-success flex items-center justify-center">
                        <span className="text-3xl sm:text-4xl text-white">✓</span>
                    </div>
                    <div className="text-center">
                        <p className="text-lg sm:text-xl font-bold text-gray-800">
                            ההזמנה אמורה להגיע בקרוב!
                        </p>
                        <p className="text-xs sm:text-sm text-gray-600 mt-1">
                            הזמן המשוער עבר
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // הצגת השעון
    const { minutes, seconds } = timeLeft || { minutes: 0, seconds: 0 };
    const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    return (
        <div
            className={`bg-gradient-to-br from-brand-light via-blue-50 to-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg border-2 border-brand-primary/30 transition-all duration-500 ${hasChanged ? 'scale-105' : 'scale-100'
                }`}
        >
            <div className="flex flex-col items-center gap-3 sm:gap-4">
                {/* אייקון שעון */}
                <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-full blur-xl opacity-20 animate-pulse"></div>
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center shadow-xl">
                        <FaClock className="text-2xl sm:text-3xl text-white" />
                    </div>
                </div>

                {/* זמן נותר */}
                <div className="text-center">
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">
                        {deliveryMethod === 'pickup' ? 'זמן נותר עד הכנת הזמנה' : 'זמן נותר עד הגעת ההזמנה'}
                    </p>
                    <div
                        className={`text-4xl sm:text-5xl font-bold bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-primary bg-clip-text text-transparent transition-all duration-300 ${hasChanged ? 'animate-pulse' : ''
                            }`}
                    >
                        {formattedTime}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">דקות:שניות</p>
                </div>

                {/* הערה נוספת אם קיימת */}
                {etaNote && (
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg px-3 sm:px-4 py-2 border border-brand-primary/20">
                        <p className="text-xs sm:text-sm text-gray-700 text-center">{etaNote}</p>
                    </div>
                )}

                {/* תצוגה נוספת של הזמן המשוער המקורי */}
                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                    <span>זמן הכנה משוער:</span>
                    <span className="font-semibold text-brand-primary">{etaMinutes} דקות</span>
                </div>
            </div>
        </div>
    );
}
