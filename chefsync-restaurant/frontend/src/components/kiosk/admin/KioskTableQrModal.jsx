import { useState, useRef, useEffect } from 'react';
import { FaTimes, FaDownload, FaPlus, FaQrcode, FaSave, FaTrash } from 'react-icons/fa';
import { QRCodeCanvas } from 'qrcode.react';
import { saveKioskTables } from '../../../services/kioskService';

const getKioskTableUrl = (token, tableNumber) =>
    `${window.location.origin}/kiosk/${token}?table=${tableNumber}`;

export default function KioskTableQrModal({ kiosk, maxTables = 10, onClose, onTablesUpdated }) {
    const [tableNumber, setTableNumber] = useState('');
    const [tables, setTables] = useState([]);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const qrRefs = useRef({});

    useEffect(() => {
        if (kiosk?.tables && Array.isArray(kiosk.tables)) {
            setTables(kiosk.tables);
        }
    }, [kiosk]);

    const addTable = () => {
        const num = tableNumber.trim();
        if (!num) return;
        if (tables.includes(num)) return;
        if (tables.length >= maxTables) {
            alert(`ניתן להגדיר עד ${maxTables} שולחנות לקיוסק.`);
            return;
        }
        setTables(prev => [...prev, num]);
        setTableNumber('');
        setDirty(true);
    };

    const addRange = () => {
        const to = parseInt(tableNumber) || 10;
        const newTables = [];
        for (let i = 1; i <= to; i++) {
            const num = String(i);
            if (!tables.includes(num) && !newTables.includes(num)) {
                newTables.push(num);
            }
        }
        const combined = [...tables, ...newTables];
        if (combined.length > maxTables) {
            alert(`ניתן להגדיר עד ${maxTables} שולחנות לקיוסק.`);
            const allowed = combined.slice(0, maxTables);
            setTables(allowed);
        } else {
            setTables(combined);
        }
        setTableNumber('');
        setDirty(true);
    };

    const removeTable = (num) => {
        setTables(prev => prev.filter(t => t !== num));
        setDirty(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveKioskTables(kiosk.id, tables);
            setDirty(false);
            onTablesUpdated?.();
        } catch (error) {
            const msg = error.response?.data?.message || 'שגיאה בשמירה';
            alert(msg);
        } finally {
            setSaving(false);
        }
    };

    const downloadQr = (tableNum) => {
        const container = qrRefs.current[tableNum];
        if (!container) return;
        const canvas = container.querySelector('canvas');
        if (!canvas) return;

        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `kiosk-${kiosk.name}-table-${tableNum}.png`;
        link.href = url;
        link.click();
    };

    const downloadAll = () => {
        tables.forEach((num, i) => {
            setTimeout(() => downloadQr(num), i * 200);
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-gray-900 flex items-center gap-3">
                            <FaQrcode className="text-purple-500" />
                            QR שולחנות - {kiosk.name}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            {tables.length} / {maxTables} שולחנות
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {dirty && (
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl font-black text-sm hover:bg-green-600 transition-all disabled:opacity-50"
                            >
                                <FaSave size={14} />
                                {saving ? 'שומר...' : 'שמור'}
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                        >
                            <FaTimes size={20} />
                        </button>
                    </div>
                </div>

                {/* Add Table */}
                <div className="p-6 border-b border-gray-100 shrink-0">
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={tableNumber}
                            onChange={(e) => setTableNumber(e.target.value)}
                            placeholder="מספר שולחן..."
                            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all"
                            maxLength={20}
                            onKeyDown={(e) => e.key === 'Enter' && addTable()}
                        />
                        <button
                            onClick={addTable}
                            disabled={tables.length >= maxTables}
                            className="px-5 py-3 bg-purple-500 text-white rounded-xl font-black hover:bg-purple-600 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <FaPlus size={12} /> הוסף
                        </button>
                        <button
                            onClick={addRange}
                            className="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl font-black hover:bg-gray-200 transition-all whitespace-nowrap"
                            title="הוסף שולחנות 1 עד המספר שהוזן"
                        >
                            1-{tableNumber || '10'}
                        </button>
                    </div>
                    {tables.length >= maxTables && (
                        <p className="text-xs text-amber-600 font-bold mt-2">
                            הגעתם למגבלת {maxTables} שולחנות לקיוסק.
                        </p>
                    )}
                </div>

                {/* QR Codes Grid */}
                <div className="flex-1 overflow-y-auto p-6">
                    {tables.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <FaQrcode size={48} className="mx-auto mb-4 opacity-30" />
                            <p className="font-bold text-lg">הוסיפו מספרי שולחנות</p>
                            <p className="text-sm mt-1">כל שולחן יקבל QR code ייחודי</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {tables.map(num => (
                                <div key={num} className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-center group">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-sm font-black text-gray-700">שולחן {num}</span>
                                        <button
                                            onClick={() => removeTable(num)}
                                            className="text-gray-300 hover:text-red-500 transition-colors"
                                        >
                                            <FaTrash size={12} />
                                        </button>
                                    </div>
                                    <div
                                        ref={el => qrRefs.current[num] = el}
                                        className="bg-white p-3 rounded-xl inline-block shadow-sm"
                                    >
                                        <QRCodeCanvas
                                            value={getKioskTableUrl(kiosk.token, num)}
                                            size={140}
                                            includeMargin
                                            level="H"
                                        />
                                    </div>
                                    <p className="text-[10px] text-gray-400 font-mono mt-2 truncate" dir="ltr">
                                        {getKioskTableUrl(kiosk.token, num)}
                                    </p>
                                    <button
                                        onClick={() => downloadQr(num)}
                                        className="mt-2 px-3 py-1.5 bg-white text-purple-600 rounded-lg text-xs font-black border border-purple-100 hover:bg-purple-50 transition-all flex items-center gap-1.5 mx-auto"
                                    >
                                        <FaDownload size={10} /> הורד
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {tables.length > 0 && (
                    <div className="p-6 border-t border-gray-100 shrink-0 flex items-center justify-between">
                        <p className="text-sm text-gray-500 font-bold">
                            {tables.length} / {maxTables} שולחנות
                        </p>
                        <div className="flex items-center gap-3">
                            {dirty && (
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-6 py-3 bg-green-500 text-white rounded-xl font-black hover:bg-green-600 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    <FaSave size={14} /> {saving ? 'שומר...' : 'שמור שולחנות'}
                                </button>
                            )}
                            <button
                                onClick={downloadAll}
                                className="px-6 py-3 bg-purple-500 text-white rounded-xl font-black hover:bg-purple-600 transition-all flex items-center gap-2"
                            >
                                <FaDownload size={14} /> הורד הכל
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
