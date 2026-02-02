import { useEffect, useState } from 'react';
import { FaExternalLinkAlt, FaTimes } from 'react-icons/fa';

/**
 * קומפוננטה שמציגה הודעה למשתמשים שפתחו את האתר בתוך אפליקציות סושיאל (פייסבוק/אינסטגרם)
 * מנחה אותם לפתוח בדפדפן חיצוני לחוויה מלאה
 */
export default function FacebookInAppWarning() {
    const [showWarning, setShowWarning] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // בדיקה אם המשתמש בתוך אפליקציית פייסבוק או אינסטגרם
        const isFacebookInApp = /FBAN|FBAV|Instagram/i.test(navigator.userAgent);

        let wasDissmissed = false;
        try {
            // בדיקה אם המשתמש כבר סגר את ההודעה בעבר (שמור ב-sessionStorage)
            wasDissmissed = sessionStorage.getItem('fb-warning-dismissed');
        } catch (e) {
            // SessionStorage לא זמין - המשך רגיל
        }

        if (isFacebookInApp && !wasDissmissed) {
            setShowWarning(true);
        }
    }, []);

    const handleDismiss = () => {
        setDismissed(true);
        setShowWarning(false);
        try {
            sessionStorage.setItem('fb-warning-dismissed', 'true');
        } catch (e) {
            // שמירה נכשלה - המשך רגיל
        }
    };

    const handleOpenInBrowser = () => {
        // הנחיה לפתוח בדפדפן חיצוני
        // בפייסבוק אין דרך ישירה לפתוח בדפדפן, אז נציג הוראות
        alert('לחץ על שלוש הנקודות בפינה (⋮) ובחר "פתח בדפדפן" או "Open in Browser"');
    };

    if (!showWarning || dismissed) {
        return null;
    }

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-2xl animate-in slide-in-from-top-5 duration-500">
            <div className="max-w-4xl mx-auto px-4 py-4">
                <div className="flex items-start gap-4">
                    {/* אייקון */}
                    <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mt-0.5">
                        <FaExternalLinkAlt size={18} />
                    </div>

                    {/* תוכן */}
                    <div className="flex-1 min-w-0">
                        <h3 className="font-black text-base mb-1 tracking-tight">
                            לחוויה מיטבית - פתח בדפדפן
                        </h3>
                        <p className="text-sm text-red-50 leading-relaxed font-medium">
                            נראה שפתחת את האתר בתוך אפליקציית פייסבוק/אינסטגרם. לחוויית הזמנה מלאה וחלקה, מומלץ לפתוח את האתר בדפדפן Chrome, Safari או Firefox.
                        </p>

                        {/* כפתורי פעולה */}
                        <div className="flex flex-wrap gap-2 mt-3">
                            <button
                                onClick={handleOpenInBrowser}
                                className="px-4 py-2 bg-white text-red-600 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-red-50 transition-all active:scale-95 flex items-center gap-2 shadow-md"
                            >
                                <FaExternalLinkAlt size={12} />
                                איך לפתוח בדפדפן?
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="px-4 py-2 bg-white/10 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-white/20 transition-all active:scale-95 border border-white/30"
                            >
                                המשך בכל זאת
                            </button>
                        </div>
                    </div>

                    {/* כפתור סגירה */}
                    <button
                        onClick={handleDismiss}
                        className="flex-shrink-0 w-8 h-8 rounded-full hover:bg-white/20 transition-all flex items-center justify-center text-white/80 hover:text-white"
                        aria-label="סגור"
                    >
                        <FaTimes size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
