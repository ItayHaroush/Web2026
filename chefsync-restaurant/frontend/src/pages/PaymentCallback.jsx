import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { FaSpinner } from 'react-icons/fa';

const API = import.meta.env.VITE_API_URL || '';

/**
 * דף callback אחרי תשלום HYP (B2C).
 * HYP מפנה לכאן (takeeat.co.il/payment/success או /payment/failed).
 * הדף מעביר את כל הפרמטרים לבאקנד שמעבד ומפנה לעמוד סטטוס הזמנה.
 */
export default function PaymentCallback() {
    const location = useLocation();

    useEffect(() => {
        const isError = location.pathname.includes('/error') || location.pathname.includes('/failed');
        const endpoint = isError
            ? `${API}/api/payments/hyp/order/error`
            : `${API}/api/payments/hyp/order/success`;

        // העברת כל הפרמטרים מ-HYP ישירות לבאקנד (GET redirect)
        const queryString = location.search;
        window.location.href = `${endpoint}${queryString}`;
    }, []);

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
