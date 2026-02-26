import { useRef, useState } from 'react';
import { FaTimes, FaQrcode, FaCopy, FaCheck, FaExternalLinkAlt, FaDownload } from 'react-icons/fa';
import { QRCodeCanvas } from 'qrcode.react';

export default function KioskFormModal({ form, setForm, editKiosk, onSubmit, onClose }) {
    const [copied, setCopied] = useState(false);
    const qrRef = useRef(null);

    const kioskUrl = editKiosk?.token
        ? `${window.location.origin}/kiosk/${editKiosk.token}`
        : '';

    const copyLink = () => {
        navigator.clipboard.writeText(kioskUrl).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const downloadQr = () => {
        if (!qrRef.current) return;
        const canvas = qrRef.current.querySelector('canvas');
        if (!canvas) return;
        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `kiosk-${editKiosk?.name || 'qr'}.png`;
        link.href = url;
        link.click();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3rem] shadow-2xl max-w-lg w-full animate-in fade-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between p-8 border-b border-gray-100">
                    <h2 className="text-2xl font-black text-gray-900">
                        {editKiosk ? 'עריכת קיוסק' : 'קיוסק חדש'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                    >
                        <FaTimes size={18} />
                    </button>
                </div>

                <form onSubmit={onSubmit} className="p-8 space-y-6">
                    {/* QR Code & Link (edit mode only) */}
                    {editKiosk?.token && (
                        <div className="space-y-4">
                            <div className="flex justify-center p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-100">
                                <div className="p-3 bg-white rounded-2xl shadow-md" ref={qrRef}>
                                    <QRCodeCanvas value={kioskUrl} size={140} includeMargin level="H" />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={kioskUrl}
                                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 font-mono text-xs truncate"
                                    dir="ltr"
                                />
                                <button
                                    type="button"
                                    onClick={copyLink}
                                    className="p-3 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-all"
                                    title="העתק קישור"
                                >
                                    {copied ? <FaCheck size={14} /> : <FaCopy size={14} />}
                                </button>
                                <a
                                    href={kioskUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all"
                                    title="פתח בחלון חדש"
                                >
                                    <FaExternalLinkAlt size={14} />
                                </a>
                                <button
                                    type="button"
                                    onClick={downloadQr}
                                    className="p-3 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100 transition-all"
                                    title="הורד QR"
                                >
                                    <FaDownload size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Name */}
                    <div>
                        <label className="block text-sm font-black text-gray-700 mb-2">שם הקיוסק</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="למשל: קיוסק כניסה"
                            className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all"
                            required
                            maxLength={100}
                        />
                    </div>

                    {/* Require Name */}
                    <div className="flex items-center justify-between bg-gray-50 rounded-2xl p-5">
                        <div>
                            <p className="font-black text-gray-900 text-sm">דרוש שם לקוח</p>
                            <p className="text-gray-500 text-xs font-medium mt-1">
                                הלקוח יתבקש להזין שם לפני שליחת ההזמנה
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setForm({ ...form, require_name: !form.require_name })}
                            className={`relative w-14 h-8 rounded-full transition-all ${form.require_name ? 'bg-amber-500' : 'bg-gray-300'
                                }`}
                        >
                            <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all ${form.require_name ? 'right-1' : 'right-7'
                                }`}></span>
                        </button>
                    </div>

                    {/* Submit */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 rounded-2xl font-black hover:bg-gray-200 transition-all"
                        >
                            ביטול
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-6 py-4 bg-amber-500 text-white rounded-2xl font-black hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20"
                        >
                            {editKiosk ? 'שמור' : 'צור קיוסק'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
