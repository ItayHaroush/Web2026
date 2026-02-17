import { useEffect, useState } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { FaSpinner, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

const API = import.meta.env.VITE_API_URL || '';

/**
 * דף callback אחרי תשלום HYP (B2C).
 * HYP מפנה לכאן (takeeat.co.il/payment/success או /payment/error).
 * הדף שולח את הפרמטרים לבאקנד לאימות ועדכון ההזמנה, ומפנה לעמוד סטטוס.
 */
export default function PaymentCallback() {
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const [status, setStatus] = useState('processing');
    const [errorMsg, setErrorMsg] = useState('');

    const isError = location.pathname.includes('/error') || location.pathname.includes('/failed');

    useEffect(() => {
        processPayment();
    }, []);

    const processPayment = async () => {
        const endpoint = isError
            ? `${API}/api/payments/hyp/order/error-json`
            : `${API}/api/payments/hyp/order/success-json`;

        try {
            const params = {};
            searchParams.forEach((value, key) => {
                params[key] = value;
            });

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params),
            });

            const data = await res.json();

            if (data.redirect_url) {
                window.location.href = data.redirect_url;
                return;
            }

            if (data.success) {
                setStatus('success');
            } else {
                setStatus('error');
                setErrorMsg(data.message || 'שגיאה בעיבוד התשלום');
            }
        } catch (err) {
            console.error('Payment callback error:', err);
            setStatus('error');
            setErrorMsg('שגיאה בתקשורת עם השרת');
        }
    };

    if (status === 'processing') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
                <div className="max-w-md w-full text-center bg-white rounded-3xl shadow-xl p-8">
                    <FaSpinner className="animate-spin text-5xl text-indigo-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-black text-gray-900 mb-2">מעבד את התשלום...</h1>
                    <p className="text-gray-500">נא להמתין, אל תסגרו את העמוד</p>
                </div>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-gray-50 flex items-center justify-center px-4">
                <div className="max-w-md w-full text-center bg-white rounded-3xl shadow-xl p-8">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FaCheckCircle className="text-emerald-500 text-4xl" />
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 mb-3">התשלום בוצע בהצלחה!</h1>
                    <p className="text-gray-600">ההזמנה נקלטה ותטופל בהקדם</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-gray-50 flex items-center justify-center px-4">
            <div className="max-w-md w-full text-center bg-white rounded-3xl shadow-xl p-8">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FaTimesCircle className="text-red-500 text-4xl" />
                </div>
                <h1 className="text-3xl font-black text-gray-900 mb-3">התשלום נכשל</h1>
                <p className="text-gray-600 mb-6">{errorMsg || 'לא הצלחנו לעבד את התשלום'}</p>
                <p className="text-sm text-gray-400">אם הבעיה נמשכת, נסה לרענן את העמוד או לחזור לסל הקניות</p>
            </div>
        </div>
    );
}
