import React, { useState, useEffect } from 'react';
import { FaCookie } from 'react-icons/fa';

/**
 * הודעת עוקבים (Cookies) - מידע בלבד ללא אפשרות דחייה
 * מופיעה בתחתית המסך בפעם הראשונה
 */
export default function CookieConsent() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // בדיקה אם המשתמש כבר ראה את ההודעה
        const hasAccepted = localStorage.getItem('cookieConsent');
        if (!hasAccepted) {
            setIsVisible(true);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('cookieConsent', 'true');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-gray-900 to-gray-800 text-white shadow-2xl border-t-2 border-orange-500 animate-slide-up">
            <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 text-center sm:text-right">
                        <FaCookie className="text-orange-500 text-2xl flex-shrink-0 mt-1 hidden sm:block" />
                        <div>
                            <p className="text-sm sm:text-base leading-relaxed">
                                <span className="font-semibold">אנחנו משתמשים בעוקבים (Cookies)</span> כדי לשפר את חווית המשתמש ולנתח את השימוש באתר.
                                המשך גלישה באתר מהווה הסכמה לשימוש בעוקבים אלו.
                                <a 
                                    href="/privacy-policy" 
                                    className="text-orange-400 hover:text-orange-300 underline mr-1"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    מדיניות פרטיות
                                </a>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleAccept}
                        className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-2.5 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl whitespace-nowrap flex-shrink-0"
                    >
                        הבנתי
                    </button>
                </div>
            </div>
        </div>
    );
}
