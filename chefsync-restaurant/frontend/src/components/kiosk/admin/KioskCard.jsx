import { useNavigate } from 'react-router-dom';
import {
    FaTabletAlt, FaEdit, FaTrash, FaCopy, FaSync,
    FaToggleOn, FaToggleOff, FaExternalLinkAlt, FaCheck, FaQrcode, FaCrown
} from 'react-icons/fa';
import { isFeatureUnlocked } from '../../../utils/tierUtils';
import { useRestaurantStatus } from '../../../context/RestaurantStatusContext';

const getKioskViewUrl = (token) => `${window.location.origin}/kiosk/${token}`;

export default function KioskCard({
    kiosk,
    copiedId,
    isManager,
    tier = 'basic',
    paymentTerminals = [],
    onEdit,
    onDelete,
    onToggle,
    onRegenerate,
    onCopyLink,
    onQrCode,
}) {
    const navigate = useNavigate();
    const { subscriptionInfo } = useRestaurantStatus();
    const isLocked = !isFeatureUnlocked(subscriptionInfo?.features, 'kiosks');
    const pinpadTerminalName =
        kiosk.payment_terminal_id != null
            ? paymentTerminals.find((t) => Number(t.id) === Number(kiosk.payment_terminal_id))?.name
            : null;
    return (
        <div
            className={`group bg-white rounded-[3rem] shadow-sm border p-8 flex flex-col gap-6 hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 relative overflow-hidden ${!kiosk.is_active ? 'border-gray-200 opacity-60' : 'border-gray-100'}`}
        >
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-amber-50 rounded-[1.5rem] flex items-center justify-center text-amber-600 shadow-inner group-hover:scale-110 transition-transform duration-500">
                        <FaTabletAlt size={24} />
                    </div>
                    <div>
                        <h3 className="font-black text-gray-900 text-xl leading-tight group-hover:text-amber-600 transition-colors">
                            {kiosk.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${kiosk.require_name
                                    ? 'bg-blue-50 text-blue-600 border-blue-100'
                                    : 'bg-gray-100 text-gray-500 border-gray-100'
                                }`}>
                                {kiosk.require_name ? 'דורש שם' : 'ללא שם'}
                            </span>
                            {kiosk.tables?.length > 0 && (
                                <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border bg-purple-50 text-purple-600 border-purple-100">
                                    {kiosk.tables.length} שולחנות
                                </span>
                            )}
                            {kiosk.payment_terminal_id != null && (
                                <span
                                    className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border bg-emerald-50 text-emerald-700 border-emerald-100"
                                    title="חיוב אשראי במסופון אחרי ההזמנה"
                                >
                                    מסופון: {pinpadTerminalName || `#${kiosk.payment_terminal_id}`}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 text-right">
                    <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${kiosk.is_connected ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`} />
                        <span className={`text-xs font-black ${kiosk.is_connected ? 'text-green-600' : 'text-red-400'}`}>
                            {kiosk.is_connected ? 'מסך קיוסק פעיל' : 'אין פעילות מסך'}
                        </span>
                    </div>
                    <span className="text-[10px] text-gray-400 max-w-[12rem] leading-tight" title="הקישור למטה תמיד תקף; הנורה משקפת אם נפתח דף הקיוסק ב־2 הדקות האחרונות">
                        פעיל = נראה שימוש בדף הקיוסק לאחרונה
                    </span>
                </div>
            </div>

            {/* Link — תמיד מוצג; לא תלוי ב&quot;מחובר&quot; */}
            <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1.5">קישור לפתיחה בטאבלט / דפדפן</p>
                <div className="flex items-center gap-2 bg-gray-50 rounded-2xl p-3">
                <input
                    type="text"
                    value={getKioskViewUrl(kiosk.token)}
                    readOnly
                    className="flex-1 bg-transparent border-none text-sm text-gray-600 font-mono truncate focus:outline-none"
                    dir="ltr"
                />
                <button
                    onClick={() => onCopyLink(kiosk)}
                    className="p-2 text-amber-600 hover:bg-amber-100 rounded-xl transition-all"
                    title="העתק קישור"
                >
                    {copiedId === kiosk.id ? <FaCheck size={14} /> : <FaCopy size={14} />}
                </button>
                <a
                    href={getKioskViewUrl(kiosk.token)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-amber-600 hover:bg-amber-100 rounded-xl transition-all shrink-0"
                    title="פתח בחלון חדש"
                >
                    <FaExternalLinkAlt size={14} />
                </a>
                </div>
            </div>

            {/* Actions */}
            {isManager && (
                <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-50">
                    <button
                        onClick={() => onEdit(kiosk)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all text-sm font-black"
                    >
                        <FaEdit size={14} /> ערוך
                    </button>
                    <button
                        onClick={() => onToggle(kiosk.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all text-sm font-black ${kiosk.is_active
                            ? 'bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white'
                            : 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white'
                            }`}
                    >
                        {kiosk.is_active ? <FaToggleOff size={14} /> : <FaToggleOn size={14} />}
                        {kiosk.is_active ? 'השבת' : 'הפעל'}
                    </button>
                    <button
                        onClick={() => onRegenerate(kiosk.id)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-600 hover:text-white transition-all text-sm font-black"
                    >
                        <FaSync size={14} /> חדש קישור
                    </button>
                    {isLocked ? (
                        <button
                            onClick={() => window.open('https://wa.me/972547466508?text=שלום, אני מעוניין בחבילת מסעדה מלאה – QR שולחנות', '_blank')}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-400 rounded-xl hover:bg-purple-50 hover:text-purple-600 transition-all text-sm font-black"
                        >
                            <FaQrcode size={14} /> QR שולחנות
                            <span className="text-[9px] font-black bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-1.5 py-0.5 rounded-md leading-none">
                                מסעדה מלאה
                            </span>
                        </button>
                    ) : (
                        <button
                            onClick={() => onQrCode(kiosk)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-600 hover:text-white transition-all text-sm font-black"
                        >
                            <FaQrcode size={14} /> QR שולחנות
                        </button>
                    )}
                    <button
                        onClick={() => onDelete(kiosk.id)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all text-sm font-black"
                    >
                        <FaTrash size={14} /> מחק
                    </button>
                </div>
            )}
        </div>
    );
}
