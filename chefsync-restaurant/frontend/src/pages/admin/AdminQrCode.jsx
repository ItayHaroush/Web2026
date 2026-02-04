import { useState, useEffect, useRef } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { FaQrcode, FaLink, FaClipboard, FaDownload, FaEye, FaShareAlt } from 'react-icons/fa';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { QRCodeCanvas } from 'qrcode.react';
import api from '../../services/apiClient';

export default function AdminQrCode() {
    const { getAuthHeaders } = useAdminAuth();
    const [restaurant, setRestaurant] = useState(null);
    const [loading, setLoading] = useState(true);
    const menuQrRef = useRef(null);
    const shareQrRef = useRef(null);

    useEffect(() => {
        fetchRestaurant();
    }, []);

    const fetchRestaurant = async () => {
        try {
            const response = await api.get('/admin/restaurant', { headers: getAuthHeaders() });
            if (response.data.success) {
                setRestaurant(response.data.restaurant);
            }
        } catch (error) {
            console.error('Failed to fetch restaurant:', error);
        } finally {
            setLoading(false);
        }
    };

    const getMenuLink = () => {
        if (!restaurant?.tenant_id) return '';
        return `${window.location.origin}/${restaurant.tenant_id}/menu`;
    };

    const getShareLink = () => {
        if (!restaurant?.tenant_id) return '';
        return `${window.location.origin}/r/${restaurant.tenant_id}`;
    };

    const downloadQr = (ref, filename) => {
        if (!ref.current) return;
        const canvas = ref.current.querySelector('canvas');
        if (!canvas) return;

        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        link.click();
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex justify-center items-center h-64">
                    <p className="text-lg text-gray-600">טוען...</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="max-w-6xl mx-auto space-y-8 pb-32">
                {/* Header */}
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-purple-50 rounded-3xl flex items-center justify-center text-purple-600 shadow-sm border border-purple-100">
                        <FaQrcode size={32} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-gray-900">קודי QR ושיתוף</h1>
                        <p className="text-gray-600 font-medium mt-1">קישורים ישירים וקודי QR להדבקה במסעדה</p>
                    </div>
                </div>

                {/* QR Code Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Menu QR */}
                    <div className="bg-white rounded-3xl shadow-lg border-2 border-gray-100 p-8 space-y-6">
                        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                                <FaLink size={24} />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl font-black text-gray-900">קישור ישיר לתפריט</h2>
                                <p className="text-sm text-gray-500 font-medium mt-1">גישה ישירה להזמנות ללא עמוד נחיתה</p>
                            </div>
                        </div>

                        {/* QR Display */}
                        <div className="flex justify-center p-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl border-2 border-blue-100">
                            <div className="p-6 bg-white rounded-3xl shadow-xl" ref={menuQrRef}>
                                <QRCodeCanvas value={getMenuLink()} size={200} includeMargin level="H" />
                            </div>
                        </div>

                        {/* Link Display */}
                        <div className="space-y-3">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-wider">הקישור:</label>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    readOnly
                                    value={getMenuLink()}
                                    className="flex-1 px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-gray-700 font-mono text-sm"
                                    dir="ltr"
                                />
                                <button
                                    onClick={() => copyToClipboard(getMenuLink())}
                                    className="px-6 py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all flex items-center gap-2 active:scale-95 whitespace-nowrap"
                                >
                                    <FaClipboard /> העתק
                                </button>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-3 pt-4">
                            <button
                                onClick={() => window.open(getMenuLink(), '_blank')}
                                className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-black hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2"
                            >
                                <FaEye /> תצוגה מקדימה
                            </button>
                            <button
                                onClick={() => downloadQr(menuQrRef, 'menu-qr-code.png')}
                                className="px-6 py-4 bg-white border-2 border-gray-200 text-gray-700 rounded-2xl font-black hover:bg-gray-50 transition-all flex items-center gap-2"
                            >
                                <FaDownload /> הורד QR
                            </button>
                        </div>
                    </div>

                    {/* Share Page QR */}
                    <div className="bg-white rounded-3xl shadow-lg border-2 border-gray-100 p-8 space-y-6">
                        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                            <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                                <FaShareAlt size={24} />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl font-black text-gray-900">עמוד שיתוף</h2>
                                <p className="text-sm text-gray-500 font-medium mt-1">עמוד ייעודי עם פרטי המסעדה ו-QR להזמנה</p>
                            </div>
                        </div>

                        {/* QR Display */}
                        <div className="flex justify-center p-8 bg-gradient-to-br from-purple-50 to-pink-50 rounded-3xl border-2 border-purple-100">
                            <div className="p-6 bg-white rounded-3xl shadow-xl" ref={shareQrRef}>
                                <QRCodeCanvas value={getShareLink()} size={200} includeMargin level="H" />
                            </div>
                        </div>

                        {/* Link Display */}
                        <div className="space-y-3">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-wider">הקישור:</label>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    readOnly
                                    value={getShareLink()}
                                    className="flex-1 px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-gray-700 font-mono text-sm"
                                    dir="ltr"
                                />
                                <button
                                    onClick={() => copyToClipboard(getShareLink())}
                                    className="px-6 py-4 bg-purple-600 text-white rounded-2xl font-black hover:bg-purple-700 transition-all flex items-center gap-2 active:scale-95 whitespace-nowrap"
                                >
                                    <FaClipboard /> העתק
                                </button>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-3 pt-4">
                            <button
                                onClick={() => window.open(getShareLink(), '_blank')}
                                className="flex-1 px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl font-black hover:from-purple-700 hover:to-pink-700 transition-all flex items-center justify-center gap-2"
                            >
                                <FaEye /> תצוגה מקדימה
                            </button>
                            <button
                                onClick={() => downloadQr(shareQrRef, 'share-qr-code.png')}
                                className="px-6 py-4 bg-white border-2 border-gray-200 text-gray-700 rounded-2xl font-black hover:bg-gray-50 transition-all flex items-center gap-2"
                            >
                                <FaDownload /> הורד QR
                            </button>
                        </div>
                    </div>
                </div>

                {/* Info Box */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-3xl p-6">
                    <div className="flex items-start gap-4">
                        <span className="text-3xl">💡</span>
                        <div className="flex-1">
                            <h3 className="text-lg font-black text-gray-900 mb-2">טיפים לשימוש בקודי QR:</h3>
                            <ul className="text-sm text-gray-700 space-y-2">
                                <li className="flex items-start gap-2">
                                    <span className="text-amber-600 font-black">•</span>
                                    <span><strong>קישור ישיר לתפריט:</strong> הדבק על שולחנות, תפריטים מודפסים, או חלונות ראווה לגישה מהירה להזמנות</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-amber-600 font-black">•</span>
                                    <span><strong>עמוד שיתוף:</strong> שלח ללקוחות, הדבק על כרטיסי ביקור, או שתף ברשתות חברתיות</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-amber-600 font-black">•</span>
                                    <span><strong>גודל מומלץ להדפסה:</strong> לפחות 3x3 ס"מ לסריקה נוחה</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
