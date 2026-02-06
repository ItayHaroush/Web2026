import { FaTimes, FaWifi, FaUsb } from 'react-icons/fa';

export default function PrinterFormModal({ form, setForm, editPrinter, categories, onSubmit, onClose }) {
    const toggleCategory = (catId) => {
        const current = form.category_ids || [];
        const updated = current.includes(catId)
            ? current.filter(id => id !== catId)
            : [...current, catId];
        setForm({ ...form, category_ids: updated });
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3rem] shadow-2xl max-w-lg w-full animate-in fade-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-8 border-b border-gray-100">
                    <h2 className="text-2xl font-black text-gray-900">
                        {editPrinter ? 'עריכת מדפסת' : 'מדפסת חדשה'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                    >
                        <FaTimes size={18} />
                    </button>
                </div>

                <form onSubmit={onSubmit} className="p-8 space-y-6">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-black text-gray-700 mb-2">שם המדפסת</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder='למשל: גריל, סלטים, בר'
                            className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                            required
                            maxLength={100}
                        />
                    </div>

                    {/* Type */}
                    <div>
                        <label className="block text-sm font-black text-gray-700 mb-2">סוג חיבור</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setForm({ ...form, type: 'network' })}
                                className={`flex items-center justify-center gap-3 px-5 py-4 rounded-2xl font-black transition-all border-2 ${form.type === 'network'
                                    ? 'bg-blue-50 border-blue-400 text-blue-700'
                                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                                    }`}
                            >
                                <FaWifi size={16} /> רשת (WiFi)
                            </button>
                            <button
                                type="button"
                                onClick={() => setForm({ ...form, type: 'usb' })}
                                className={`flex items-center justify-center gap-3 px-5 py-4 rounded-2xl font-black transition-all border-2 ${form.type === 'usb'
                                    ? 'bg-purple-50 border-purple-400 text-purple-700'
                                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                                    }`}
                            >
                                <FaUsb size={16} /> USB
                            </button>
                        </div>
                    </div>

                    {/* Network fields */}
                    {form.type === 'network' && (
                        <div className="space-y-4 bg-blue-50/50 rounded-2xl p-5 border border-blue-100">
                            <div>
                                <label className="block text-sm font-black text-gray-700 mb-2">כתובת IP</label>
                                <input
                                    type="text"
                                    value={form.ip_address}
                                    onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
                                    placeholder="192.168.1.100"
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl font-mono font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                                    dir="ltr"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-black text-gray-700 mb-2">פורט</label>
                                <input
                                    type="number"
                                    value={form.port}
                                    onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 9100 })}
                                    placeholder="9100"
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl font-mono font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                                    dir="ltr"
                                    min={1}
                                    max={65535}
                                />
                            </div>
                        </div>
                    )}

                    {/* Paper Width */}
                    <div>
                        <label className="block text-sm font-black text-gray-700 mb-2">רוחב נייר</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setForm({ ...form, paper_width: '80mm' })}
                                className={`px-5 py-4 rounded-2xl font-black transition-all border-2 ${form.paper_width === '80mm'
                                    ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                                    }`}
                            >
                                80mm (סטנדרט)
                            </button>
                            <button
                                type="button"
                                onClick={() => setForm({ ...form, paper_width: '58mm' })}
                                className={`px-5 py-4 rounded-2xl font-black transition-all border-2 ${form.paper_width === '58mm'
                                    ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                                    }`}
                            >
                                58mm (קומפקט)
                            </button>
                        </div>
                    </div>

                    {/* Categories */}
                    <div>
                        <label className="block text-sm font-black text-gray-700 mb-2">קטגוריות משויכות</label>
                        <p className="text-xs text-gray-400 font-medium mb-3">
                            בחרו אילו קטגוריות ידפיסו במדפסת זו. ללא בחירה - הכל יודפס.
                        </p>
                        {categories.length === 0 ? (
                            <div className="bg-gray-50 rounded-2xl p-4 text-center">
                                <p className="text-sm text-gray-400 font-bold">אין קטגוריות זמינות</p>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {categories.map(cat => {
                                    const isSelected = (form.category_ids || []).includes(cat.id);
                                    return (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => toggleCategory(cat.id)}
                                            className={`px-4 py-2.5 rounded-xl text-sm font-black transition-all border-2 ${isSelected
                                                ? 'bg-amber-50 border-amber-400 text-amber-700'
                                                : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                                                }`}
                                        >
                                            {cat.icon || ''} {cat.name}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
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
                            className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
                        >
                            {editPrinter ? 'שמור' : 'צור מדפסת'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
