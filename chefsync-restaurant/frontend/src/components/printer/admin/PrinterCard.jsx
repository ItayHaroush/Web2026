import {
    FaPrint, FaEdit, FaTrash, FaWifi, FaUsb,
    FaToggleOn, FaToggleOff, FaPlay
} from 'react-icons/fa';

export default function PrinterCard({
    printer,
    isManager,
    onEdit,
    onDelete,
    onToggle,
    onTestPrint,
    testingId,
}) {
    return (
        <div
            className={`group bg-white rounded-[3rem] shadow-sm border p-8 flex flex-col gap-6 hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 relative overflow-hidden ${!printer.is_active ? 'border-gray-200 opacity-60' : 'border-gray-100'}`}
        >
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500 ${printer.type === 'network'
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-purple-50 text-purple-600'
                        }`}>
                        {printer.type === 'network' ? <FaWifi size={24} /> : <FaUsb size={24} />}
                    </div>
                    <div>
                        <h3 className="font-black text-gray-900 text-xl leading-tight group-hover:text-blue-600 transition-colors">
                            {printer.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${printer.is_active
                                ? 'bg-green-50 text-green-600 border-green-100'
                                : 'bg-gray-100 text-gray-500 border-gray-100'
                                }`}>
                                {printer.is_active ? 'פעילה' : 'כבויה'}
                            </span>
                            <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border bg-gray-50 text-gray-500 border-gray-100">
                                {printer.paper_width}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Connection Info */}
            {printer.type === 'network' && printer.ip_address && (
                <div className="flex items-center gap-2 bg-gray-50 rounded-2xl p-3">
                    <span className="text-sm font-mono text-gray-600 flex-1" dir="ltr">
                        {printer.ip_address}:{printer.port || 9100}
                    </span>
                </div>
            )}

            {/* Categories */}
            {printer.categories && printer.categories.length > 0 && (
                <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">קטגוריות משויכות</p>
                    <div className="flex flex-wrap gap-2">
                        {printer.categories.map(cat => (
                            <span
                                key={cat.id}
                                className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-black"
                            >
                                {cat.icon || ''} {cat.name}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {printer.categories && printer.categories.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
                    <p className="text-xs font-bold text-amber-700">
                        לא שויכו קטגוריות - המדפסת תקבל את כל הפריטים
                    </p>
                </div>
            )}

            {/* Actions */}
            {isManager && (
                <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-50">
                    <button
                        onClick={() => onEdit(printer)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all text-sm font-black"
                    >
                        <FaEdit size={14} /> ערוך
                    </button>
                    <button
                        onClick={() => onToggle(printer.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all text-sm font-black ${printer.is_active
                            ? 'bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white'
                            : 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white'
                            }`}
                    >
                        {printer.is_active ? <FaToggleOff size={14} /> : <FaToggleOn size={14} />}
                        {printer.is_active ? 'השבת' : 'הפעל'}
                    </button>
                    <button
                        onClick={() => onTestPrint(printer.id)}
                        disabled={testingId === printer.id}
                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all text-sm font-black disabled:opacity-50"
                    >
                        <FaPlay size={12} />
                        {testingId === printer.id ? 'שולח...' : 'ניסיון'}
                    </button>
                    <button
                        onClick={() => onDelete(printer.id)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all text-sm font-black"
                    >
                        <FaTrash size={14} /> מחק
                    </button>
                </div>
            )}
        </div>
    );
}
