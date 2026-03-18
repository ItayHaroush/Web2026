import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import apiClient from '../services/apiClient';
import { FaCheckCircle, FaTimesCircle, FaSpinner, FaHome } from 'react-icons/fa';

export default function VerifyEmailPage() {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState('loading'); // loading | success | error
    const [message, setMessage] = useState('');
    const token = searchParams.get('token');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('קישור אימות לא תקין — חסר טוקן');
            return;
        }

        apiClient.get(`/customer/email/verify?token=${encodeURIComponent(token)}`)
            .then((res) => {
                if (res.data?.success) {
                    setStatus('success');
                    setMessage(res.data.message || 'האימייל אומת בהצלחה!');

                    // עדכון נתוני הלקוח ב-localStorage
                    try {
                        const saved = localStorage.getItem('customer_data');
                        if (saved) {
                            const data = JSON.parse(saved);
                            data.email_verified = true;
                            localStorage.setItem('customer_data', JSON.stringify(data));
                            window.dispatchEvent(new CustomEvent('customer_data_changed', { detail: data }));
                        }
                    } catch { /* ignore */ }
                } else {
                    setStatus('error');
                    setMessage(res.data?.message || 'שגיאה באימות');
                }
            })
            .catch((err) => {
                setStatus('error');
                setMessage(err?.response?.data?.message || 'קישור לא תקין או שפג תוקפו');
            });
    }, [token]);

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4" dir="rtl">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center space-y-5">
                {status === 'loading' && (
                    <>
                        <FaSpinner className="animate-spin text-brand-primary mx-auto" size={48} />
                        <p className="text-lg font-bold text-gray-700">מאמת את האימייל שלך...</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                            <FaCheckCircle className="text-green-500" size={40} />
                        </div>
                        <h1 className="text-2xl font-black text-gray-900">המייל אומת בהצלחה!</h1>
                        <p className="text-gray-600">{message}</p>
                        <p className="text-sm text-gray-500">מעכשיו תקבל/י קבלות הזמנה וסיכומים למייל</p>
                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 bg-brand-primary text-white rounded-xl px-6 py-3 font-bold hover:bg-brand-secondary transition"
                        >
                            <FaHome size={14} />
                            <span>חזרה לדף הבית</span>
                        </Link>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                            <FaTimesCircle className="text-red-500" size={40} />
                        </div>
                        <h1 className="text-2xl font-black text-gray-900">שגיאה באימות</h1>
                        <p className="text-gray-600">{message}</p>
                        <p className="text-sm text-gray-500">ניתן לבקש מייל אימות חדש דרך הפרופיל שלך</p>
                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 bg-gray-800 text-white rounded-xl px-6 py-3 font-bold hover:bg-gray-700 transition"
                        >
                            <FaHome size={14} />
                            <span>חזרה לדף הבית</span>
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
}
