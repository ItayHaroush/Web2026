import { useState } from 'react';
import { FaTimes, FaEnvelope, FaDownload, FaSpinner, FaPaperPlane } from 'react-icons/fa';

export default function InvoicePreviewModal({ pdfUrl, invoice, onClose, onSendEmail, onDownload, sendingEmail }) {
    const [emailInput, setEmailInput] = useState('');
    const [showEmailInput, setShowEmailInput] = useState(false);

    const handleSend = () => {
        onSendEmail(emailInput || null);
    };

    const handleDownload = () => {
        if (onDownload) {
            onDownload();
        } else {
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.download = `TakeEat-Invoice-${invoice.restaurant?.tenant_id || invoice.restaurant_id}-${invoice.month}.pdf`;
            link.click();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                dir="rtl"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <div>
                        <h2 className="text-lg font-black text-gray-900">תצוגה מקדימה — חשבונית</h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {invoice.restaurant?.name || '—'} | {invoice.month}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
                    >
                        <FaTimes size={16} />
                    </button>
                </div>

                {/* PDF Viewer */}
                <div className="flex-1 min-h-0 bg-gray-100">
                    <iframe
                        src={pdfUrl}
                        className="w-full h-full border-0"
                        style={{ minHeight: '500px' }}
                        title="Invoice Preview"
                    />
                </div>

                {/* Actions */}
                <div className="px-6 py-4 border-t border-gray-100 bg-white">
                    {showEmailInput && (
                        <div className="mb-3 flex items-center gap-3">
                            <input
                                type="email"
                                value={emailInput}
                                onChange={(e) => setEmailInput(e.target.value)}
                                placeholder="אימייל נמען (ריק = בעל המסעדה)"
                                className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none"
                                dir="ltr"
                            />
                            <button
                                onClick={handleSend}
                                disabled={sendingEmail}
                                className="px-5 py-2 bg-brand-primary text-white rounded-xl font-bold text-sm hover:bg-brand-primary/90 transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                            >
                                {sendingEmail ? (
                                    <><FaSpinner className="animate-spin" size={12} /> שולח...</>
                                ) : (
                                    <><FaPaperPlane size={12} /> שלח</>
                                )}
                            </button>
                        </div>
                    )}

                    <div className="flex justify-between items-center">
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowEmailInput(!showEmailInput)}
                                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-500 transition-all flex items-center gap-2"
                            >
                                <FaEnvelope size={12} />
                                שלח במייל
                            </button>
                            <button
                                onClick={handleDownload}
                                className="px-5 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all flex items-center gap-2"
                            >
                                <FaDownload size={12} />
                                הורד PDF
                            </button>
                        </div>
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all"
                        >
                            סגור
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
