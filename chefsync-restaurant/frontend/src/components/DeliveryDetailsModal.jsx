import React, { useState, useEffect } from 'react';

export default function DeliveryDetailsModal({ open, onClose, customerInfo, setCustomerInfo, onSaved }) {
    const [address, setAddress] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (open) {
            setAddress(customerInfo.delivery_address || '');
            setNotes(customerInfo.delivery_notes || '');
        }
    }, [open, customerInfo.delivery_address, customerInfo.delivery_notes]);

    if (!open) return null;

    const handleSave = (e) => {
        e.preventDefault();
        if (!address.trim()) return;
        setCustomerInfo({
            ...customerInfo,
            delivery_address: address.trim(),
            delivery_notes: notes.trim(),
        });
        if (onSaved) {
            onSaved({
                delivery_address: address.trim(),
                delivery_notes: notes.trim(),
            });
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-900">פרטי משלוח</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">×</button>
                </div>
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">כתובת מלאה</label>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="רחוב, מספר בית, עיר"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">הערות לשליח (אופציונלי)</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            placeholder="לדוגמה: דירה 4, קוד שער 1234"
                        />
                    </div>
                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100">
                            ביטול
                        </button>
                        <button type="submit" className="px-4 py-2 rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90">
                            שמירה
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
