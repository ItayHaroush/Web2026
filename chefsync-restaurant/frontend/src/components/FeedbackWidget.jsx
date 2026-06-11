import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useCustomer } from '../context/CustomerContext';
import { useCart } from '../context/CartContext';
import apiClient from '../services/apiClient';
import RatingWidget from './RatingWidget';
import { FaCommentDots, FaTimes, FaPaperPlane, FaCheckCircle } from 'react-icons/fa';
import { ACTIVE_ORDERS_STORAGE_CHANGED } from '../utils/activeOrdersStorage';

/**
 * ווידג'ט משוב צף (פינה שמאלית-תחתונה) — זמין רק ללקוחות רשומים
 * שביצעו לפחות הזמנה אחת שנמסרה. המשובים מגיעים לסופר אדמין.
 */

const CATEGORIES = [
    { value: 'general', label: 'כללי' },
    { value: 'idea', label: 'רעיון לשיפור' },
    { value: 'bug', label: 'דיווח על תקלה' },
    { value: 'complaint', label: 'תלונה' },
    { value: 'praise', label: 'מחמאה' },
];

export default function FeedbackWidget() {
    const { customer, customerToken, isRegistered } = useCustomer();
    const { getItemCount } = useCart();
    const location = useLocation();
    /** בעמוד התפריט עם פריטים בסל — בר הסל התחתון (z-60) מכסה את הפינה; מרימים את הכפתור מעליו */
    const cartBarVisible = getItemCount() > 0 && /\/menu\/?$/.test(location.pathname);
    const [eligible, setEligible] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [category, setCategory] = useState('general');
    const [rating, setRating] = useState(null);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState(null);
    /** מתעדכן כשהזמנה נמסרת (אחסון הזמנות פעילות משתנה) — מפעיל בדיקת זכאות מחדש */
    const [recheckRev, setRecheckRev] = useState(0);

    useEffect(() => {
        const bump = () => setRecheckRev((n) => n + 1);
        window.addEventListener(ACTIVE_ORDERS_STORAGE_CHANGED, bump);
        return () => window.removeEventListener(ACTIVE_ORDERS_STORAGE_CHANGED, bump);
    }, []);

    // בדיקת זכאות — רק תשובה חיובית נשמרת ב-cache, כדי שהכפתור יופיע מיד אחרי שהזמנה ראשונה נמסרת
    useEffect(() => {
        if (!isRegistered || !customerToken || !customer?.id) {
            setEligible(false);
            return;
        }

        const cacheKey = `feedback_eligible_${customer.id}`;
        if (sessionStorage.getItem(cacheKey) === 'true') {
            setEligible(true);
            return;
        }

        apiClient.get('/customer/feedback/eligibility', {
            headers: { Authorization: `Bearer ${customerToken}` },
        }).then((res) => {
            const ok = !!res.data?.data?.eligible;
            setEligible(ok);
            if (ok) sessionStorage.setItem(cacheKey, 'true');
        }).catch(() => setEligible(false));
    }, [isRegistered, customerToken, customer?.id, recheckRev]);

    if (!eligible) return null;

    const handleClose = () => {
        setIsOpen(false);
        setError(null);
        if (sent) {
            // איפוס טופס אחרי שליחה מוצלחת
            setSent(false);
            setCategory('general');
            setRating(null);
            setMessage('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (message.trim().length < 3 || sending) return;
        setSending(true);
        setError(null);
        try {
            const res = await apiClient.post('/customer/feedback', {
                category,
                rating,
                message: message.trim(),
                page_url: window.location.pathname,
            }, {
                headers: { Authorization: `Bearer ${customerToken}` },
            });
            if (res.data?.success) {
                setSent(true);
            } else {
                setError(res.data?.message || 'שגיאה בשליחת המשוב');
            }
        } catch (err) {
            setError(err?.response?.data?.message || 'שגיאה בשליחת המשוב, נסה שוב');
        } finally {
            setSending(false);
        }
    };

    return (
        <>
            {/* כפתור צף — פינה שמאלית תחתונה (RTL) */}
            {!isOpen && (
                <button
                    type="button"
                    onClick={() => setIsOpen(true)}
                    className={`fixed left-4 z-[65] flex items-center gap-2 bg-brand-primary text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all px-4 py-3 ${cartBarVisible
                        ? 'bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)]'
                        : 'bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)]'}`}
                    aria-label="שליחת משוב"
                >
                    <FaCommentDots size={18} />
                    <span className="hidden sm:inline text-sm font-bold">משוב</span>
                </button>
            )}

            {/* מודל משוב */}
            {isOpen && (
                <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center" dir="rtl">
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
                        aria-label="סגור"
                        onClick={handleClose}
                    />
                    <div
                        className="relative w-full sm:max-w-md bg-white dark:bg-brand-dark-surface rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="feedback-modal-title"
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-brand-dark-border">
                            <h2 id="feedback-modal-title" className="text-lg font-black text-gray-800 dark:text-brand-dark-text flex items-center gap-2">
                                <FaCommentDots className="text-brand-primary" />
                                המשוב שלך חשוב לנו
                            </h2>
                            <button
                                type="button"
                                onClick={handleClose}
                                className="p-2 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition"
                                aria-label="סגור"
                            >
                                <FaTimes size={16} />
                            </button>
                        </div>

                        {sent ? (
                            <div className="p-8 flex flex-col items-center gap-4 text-center">
                                <FaCheckCircle className="text-green-500 text-5xl" />
                                <p className="text-lg font-bold text-gray-800 dark:text-brand-dark-text">
                                    תודה! המשוב נשלח בהצלחה
                                </p>
                                <p className="text-sm text-gray-500 dark:text-brand-dark-muted">
                                    הצוות שלנו קורא כל משוב ומשתמש בו לשיפור המערכת
                                </p>
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="mt-2 bg-brand-primary text-white font-bold rounded-xl px-6 py-2.5 hover:opacity-90 transition"
                                >
                                    סגור
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="p-5 space-y-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-brand-dark-text mb-2">
                                        על מה תרצה לספר לנו?
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {CATEGORIES.map((cat) => (
                                            <button
                                                key={cat.value}
                                                type="button"
                                                onClick={() => setCategory(cat.value)}
                                                className={`px-3 py-1.5 rounded-full text-sm font-bold border transition ${
                                                    category === cat.value
                                                        ? 'bg-brand-primary text-white border-brand-primary'
                                                        : 'bg-white dark:bg-transparent text-gray-600 dark:text-brand-dark-muted border-gray-200 dark:border-brand-dark-border hover:border-brand-primary'
                                                }`}
                                            >
                                                {cat.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-brand-dark-text mb-2">
                                        איך החוויה הכללית שלך? <span className="font-normal text-gray-400">(לא חובה)</span>
                                    </label>
                                    <RatingWidget value={rating} onChange={setRating} size="sm" />
                                </div>

                                <div>
                                    <label htmlFor="feedback-message" className="block text-sm font-bold text-gray-700 dark:text-brand-dark-text mb-2">
                                        המשוב שלך
                                    </label>
                                    <textarea
                                        id="feedback-message"
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        rows={4}
                                        maxLength={2000}
                                        placeholder="ספר לנו מה עובד טוב, מה פחות, ומה היית רוצה לראות..."
                                        className="w-full rounded-xl border border-gray-200 dark:border-brand-dark-border bg-white dark:bg-transparent dark:text-brand-dark-text px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/50 resize-none"
                                        required
                                    />
                                    <p className="text-xs text-gray-400 mt-1 text-left">{message.length}/2000</p>
                                </div>

                                {error && (
                                    <p className="text-sm text-red-500 font-bold">{error}</p>
                                )}

                                <button
                                    type="submit"
                                    disabled={sending || message.trim().length < 3}
                                    className="w-full flex items-center justify-center gap-2 bg-brand-primary text-white font-black rounded-xl px-4 py-3 hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <FaPaperPlane size={14} />
                                    {sending ? 'שולח...' : 'שליחת משוב'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
