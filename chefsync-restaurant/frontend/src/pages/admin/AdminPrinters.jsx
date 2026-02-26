import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import AdminLayout from '../../layouts/AdminLayout';
import { FaPrint, FaPlus, FaNetworkWired, FaEdit, FaTrash, FaPowerOff, FaCopy, FaCheck, FaTimes, FaExclamationTriangle } from 'react-icons/fa';
import api from '../../services/apiClient';
import {
    getPrinters,
    createPrinter,
    updatePrinter,
    deletePrinter,
    togglePrinter,
    testPrint,
} from '../../services/printerService';
import {
    getPrintDevices,
    registerPrintDevice,
    updatePrintDevice,
    deletePrintDevice,
    togglePrintDevice,
} from '../../services/printDeviceService';
import PrinterCard from '../../components/printer/admin/PrinterCard';
import PrinterFormModal from '../../components/printer/admin/PrinterFormModal';

const ROLE_LABELS = { kitchen: 'מטבח', receipt: 'קופה / קבלה', bar: 'בר', general: 'כללי' };
const ROLE_COLORS = {
    kitchen: 'bg-orange-100 text-orange-700 border-orange-200',
    receipt: 'bg-blue-100 text-blue-700 border-blue-200',
    bar: 'bg-purple-100 text-purple-700 border-purple-200',
    general: 'bg-gray-100 text-gray-700 border-gray-200',
};

const DEFAULT_FORM = {
    name: '',
    type: 'browser',
    role: 'kitchen',
    ip_address: '',
    port: 9100,
    paper_width: '80mm',
    category_ids: [],
};

const DEVICE_FORM = { name: '', role: 'kitchen', printer_ip: '', printer_port: 9100 };

export default function AdminPrinters() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'printers';

    const { isManager, getAuthHeaders } = useAdminAuth();
    const [printers, setPrinters] = useState([]);
    const [categories, setCategories] = useState([]);
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editPrinter, setEditPrinter] = useState(null);
    const [form, setForm] = useState({ ...DEFAULT_FORM });
    const [testingId, setTestingId] = useState(null);

    const [showDeviceModal, setShowDeviceModal] = useState(false);
    const [editDevice, setEditDevice] = useState(null);
    const [deviceForm, setDeviceForm] = useState({ ...DEVICE_FORM });
    const [newToken, setNewToken] = useState(null);
    const [copiedToken, setCopiedToken] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [printersRes, categoriesRes, devicesRes] = await Promise.all([
                getPrinters(),
                api.get('/admin/categories', { headers: getAuthHeaders() }),
                getPrintDevices(),
            ]);
            if (printersRes.success) setPrinters(printersRes.printers || []);
            if (categoriesRes.data?.success) setCategories(categoriesRes.data.categories || []);
            if (devicesRes.success) setDevices(devicesRes.devices || []);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        // #region agent log
        console.warn('[DEBUG-3267aa] Printer submit', { editPrinter: !!editPrinter, editId: editPrinter?.id, form });
        // #endregion
        try {
            if (editPrinter) {
                await updatePrinter(editPrinter.id, form);
            } else {
                await createPrinter(form);
            }
            closeModal();
            fetchData();
        } catch (error) {
            console.error('Failed to save printer:', error);
            alert(error.response?.data?.message || 'שגיאה בשמירה');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('למחוק את המדפסת?')) return;
        try {
            await deletePrinter(id);
            fetchData();
        } catch (error) {
            console.error('Failed to delete printer:', error);
            alert(error.response?.data?.message || 'שגיאה במחיקה');
        }
    };

    const handleToggle = async (id) => {
        try {
            await togglePrinter(id);
            fetchData();
        } catch (error) {
            console.error('Failed to toggle printer:', error);
        }
    };

    const handleTestPrint = async (id) => {
        setTestingId(id);
        try {
            const res = await testPrint(id);
            alert(res.message || 'הדפסת ניסיון נשלחה');
        } catch (error) {
            console.error('Failed to test print:', error);
            alert(error.response?.data?.message || 'שגיאה בהדפסת ניסיון');
        } finally {
            setTestingId(null);
        }
    };

    const openNew = () => {
        setEditPrinter(null);
        setForm({ ...DEFAULT_FORM });
        setShowModal(true);
    };

    const openEdit = (printer) => {
        setEditPrinter(printer);
        setForm({
            name: printer.name,
            type: printer.type || 'network',
            role: printer.role || 'kitchen',
            ip_address: printer.ip_address || '',
            port: printer.port || 9100,
            paper_width: printer.paper_width || '80mm',
            category_ids: (printer.categories || []).map(c => c.id),
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditPrinter(null);
    };

    const handleDeviceSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editDevice) {
                await updatePrintDevice(editDevice.id, deviceForm);
                closeDeviceModal();
            } else {
                const res = await registerPrintDevice(deviceForm);
                if (res.device_token) setNewToken(res.device_token);
                else closeDeviceModal();
            }
            fetchData();
        } catch (error) {
            console.error('Failed to save device:', error);
            alert(error.response?.data?.message || 'שגיאה בשמירה');
        }
    };

    const handleDeviceDelete = async (id) => {
        if (!confirm('למחוק את מכשיר ההדפסה?')) return;
        try {
            await deletePrintDevice(id);
            fetchData();
        } catch (error) {
            console.error('Failed to delete device:', error);
            alert(error.response?.data?.message || 'שגיאה במחיקה');
        }
    };

    const handleDeviceToggle = async (id) => {
        try {
            await togglePrintDevice(id);
            fetchData();
        } catch (error) {
            console.error('Failed to toggle device:', error);
        }
    };

    const openDeviceNew = () => {
        setEditDevice(null);
        setDeviceForm({ ...DEVICE_FORM });
        setNewToken(null);
        setCopiedToken(false);
        setShowDeviceModal(true);
    };

    const openDeviceEdit = (device) => {
        setEditDevice(device);
        setDeviceForm({
            name: device.name,
            role: device.role || 'kitchen',
            printer_ip: device.printer_ip || '',
            printer_port: device.printer_port || 9100,
        });
        setNewToken(null);
        setShowDeviceModal(true);
    };

    const closeDeviceModal = () => {
        setShowDeviceModal(false);
        setEditDevice(null);
        setNewToken(null);
        setCopiedToken(false);
    };

    const copyToken = () => {
        if (newToken) {
            navigator.clipboard.writeText(newToken);
            setCopiedToken(true);
            setTimeout(() => setCopiedToken(false), 2000);
        }
    };

    const timeAgo = (dateStr) => {
        if (!dateStr) return null;
        const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
        if (diff < 60) return 'לפני שניות';
        if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דק'`;
        if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שעות`;
        return `לפני ${Math.floor(diff / 86400)} ימים`;
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex flex-col items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
                    <p className="mt-4 text-gray-500 font-black animate-pulse">טוען מדפסות...</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="max-w-6xl mx-auto space-y-12 pb-32 animate-in fade-in duration-500">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 px-4">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 bg-blue-50 rounded-[2.5rem] flex items-center justify-center text-blue-600 shadow-sm border border-blue-100/50">
                            <FaPrint size={30} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight">מדפסות</h1>
                            <p className="text-gray-500 font-medium mt-1">
                                {activeTab === 'printers'
                                    ? `${printers.length} מדפסות מוגדרות — מטבח וקופה`
                                    : `${devices.length} גשרי הדפסה — הדפסה למדפסות רשת`}
                            </p>
                        </div>
                    </div>
                    {isManager() && (
                        <button
                            onClick={activeTab === 'printers' ? openNew : openDeviceNew}
                            className="w-full md:w-auto px-10 py-5 rounded-[2rem] font-black transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 group bg-blue-600 text-white hover:bg-blue-500 shadow-blue-600/20"
                        >
                            <FaPlus className="group-hover:rotate-90 transition-transform" />
                            {activeTab === 'printers' ? 'מדפסת חדשה' : 'גשר הדפסה חדש'}
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex gap-2 px-4">
                    <button
                        onClick={() => setSearchParams({})}
                        className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${activeTab === 'printers' || !searchParams.get('tab')
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        <FaPrint size={16} /> מדפסות
                    </button>
                    <button
                        onClick={() => setSearchParams({ tab: 'devices' })}
                        className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${activeTab === 'devices'
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        <FaNetworkWired size={16} /> גשרי הדפסה
                    </button>
                </div>

                {/* Content: Printers */}
                {(activeTab === 'printers' || !searchParams.get('tab')) && (
                <div>
                {printers.length === 0 ? (
                    <div className="bg-white rounded-[4rem] shadow-sm border-2 border-dashed border-gray-100 p-24 text-center flex flex-col items-center col-span-full max-w-xl mx-auto">
                        <div className="w-28 h-28 bg-gray-50 rounded-[3rem] flex items-center justify-center text-6xl mb-8 grayscale opacity-50">
                            <FaPrint />
                        </div>
                        <h3 className="text-3xl font-black text-gray-900 mb-2">אין מדפסות עדיין</h3>
                        <p className="text-gray-500 font-medium mb-12 text-lg leading-relaxed">
                            הוסיפו מדפסת מטבח או קופה כדי להדפיס הזמנות וקבלות אוטומטית
                        </p>
                        {isManager() && (
                            <button
                                onClick={openNew}
                                className="bg-blue-600 text-white px-12 py-5 rounded-[2rem] font-black hover:bg-blue-500 transition-all flex items-center gap-4 shadow-lg shadow-blue-600/20"
                            >
                                <FaPlus /> הוספת מדפסת ראשונה
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-4">
                        {printers.map((printer) => (
                            <PrinterCard
                                key={printer.id}
                                printer={printer}
                                isManager={isManager()}
                                onEdit={openEdit}
                                onDelete={handleDelete}
                                onToggle={handleToggle}
                                onTestPrint={handleTestPrint}
                                testingId={testingId}
                            />
                        ))}
                    </div>
                )}
                </div>
                )}

                {/* Content: גשרי הדפסה */}
                {activeTab === 'devices' && (
                <div className="px-4">
                {devices.length === 0 ? (
                    <div className="bg-white rounded-[4rem] shadow-sm border-2 border-dashed border-gray-100 p-24 text-center flex flex-col items-center col-span-full max-w-xl mx-auto">
                        <div className="w-28 h-28 bg-gray-50 rounded-[3rem] flex items-center justify-center text-6xl mb-8 grayscale opacity-50">
                            <FaNetworkWired />
                        </div>
                        <h3 className="text-3xl font-black text-gray-900 mb-2">אין גשרי הדפסה עדיין</h3>
                        <p className="text-gray-500 font-medium mb-12 text-lg leading-relaxed">
                            רשמו מכשיר אנדרואיד שמשמש כגשר הדפסה למדפסת רשת מקומית
                        </p>
                        {isManager() && (
                            <button
                                onClick={openDeviceNew}
                                className="bg-indigo-600 text-white px-12 py-5 rounded-[2rem] font-black hover:bg-indigo-500 transition-all flex items-center gap-4 shadow-lg shadow-indigo-600/20"
                            >
                                <FaPlus /> רישום מכשיר ראשון
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {devices.map((device) => {
                            const isConnected = device.is_connected;
                            return (
                                <div key={device.id} className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-8 hover:shadow-md transition-all">
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${device.is_active ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                                                <FaNetworkWired size={22} />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-gray-900">{device.name}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`px-3 py-0.5 rounded-full text-xs font-bold border ${ROLE_COLORS[device.role] || ROLE_COLORS.general}`}>
                                                        {ROLE_LABELS[device.role] || device.role}
                                                    </span>
                                                    <span className={`flex items-center gap-1 text-xs font-semibold ${isConnected ? 'text-green-600' : 'text-gray-400'}`}>
                                                        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></span>
                                                        {isConnected ? 'מחובר' : 'מנותק'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        {!device.is_active && (
                                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-100">כבוי</span>
                                        )}
                                    </div>
                                    <div className="space-y-2 text-sm text-gray-600 mb-6">
                                        {device.printer_ip && (
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium">מדפסת:</span>
                                                <span className="font-mono text-gray-800">{device.printer_ip}:{device.printer_port || 9100}</span>
                                            </div>
                                        )}
                                        {device.last_seen_at && (
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium">נראה לאחרונה:</span>
                                                <span>{timeAgo(device.last_seen_at)}</span>
                                            </div>
                                        )}
                                        {device.last_error_message && (
                                            <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-100 flex items-start gap-2">
                                                <FaExclamationTriangle className="text-red-500 mt-0.5 flex-shrink-0" size={14} />
                                                <div>
                                                    <p className="text-red-700 text-xs font-bold">{device.last_error_message}</p>
                                                    {device.last_error_at && <p className="text-red-400 text-xs mt-0.5">{timeAgo(device.last_error_at)}</p>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {isManager() && (
                                        <div className="flex items-center gap-3 border-t border-gray-50 pt-5">
                                            <button onClick={() => openDeviceEdit(device)} className="flex-1 py-3 rounded-xl font-bold text-sm bg-gray-50 text-gray-700 hover:bg-gray-100 transition-all flex items-center justify-center gap-2">
                                                <FaEdit size={12} /> עריכה
                                            </button>
                                            <button onClick={() => handleDeviceToggle(device.id)} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${device.is_active ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                                                <FaPowerOff size={12} /> {device.is_active ? 'כבה' : 'הפעל'}
                                            </button>
                                            <button onClick={() => handleDeviceDelete(device.id)} className="py-3 px-4 rounded-xl font-bold text-sm bg-red-50 text-red-600 hover:bg-red-100 transition-all">
                                                <FaTrash size={12} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
                </div>
                )}

                {/* Create/Edit Printer Modal */}
                {showModal && (
                    <PrinterFormModal
                        form={form}
                        setForm={setForm}
                        editPrinter={editPrinter}
                        categories={categories}
                        onSubmit={handleSubmit}
                        onClose={closeModal}
                    />
                )}

                {/* Create/Edit Device Modal */}
                {showDeviceModal && (
                    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={closeDeviceModal}>
                        <div className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full p-8" onClick={e => e.stopPropagation()}>
                            {newToken ? (
                                <div className="text-center space-y-6">
                                    <div className="w-20 h-20 bg-green-50 rounded-[2rem] flex items-center justify-center text-green-600 mx-auto">
                                        <FaCheck size={32} />
                                    </div>
                                    <h2 className="text-2xl font-black text-gray-900">המכשיר נרשם בהצלחה!</h2>
                                    <p className="text-gray-500">העתיקו את הטוקן והזינו אותו באפליקציית ה-Agent במכשיר:</p>
                                    <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3 border border-gray-200">
                                        <code className="flex-1 text-sm font-mono text-gray-800 break-all select-all" dir="ltr">{newToken}</code>
                                        <button onClick={copyToken} className={`p-3 rounded-xl transition-all ${copiedToken ? 'bg-green-100 text-green-600' : 'bg-white text-gray-500 hover:bg-gray-100'}`}>
                                            {copiedToken ? <FaCheck size={16} /> : <FaCopy size={16} />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-red-500 font-bold">שימו לב: הטוקן מוצג פעם אחת בלבד ולא ניתן לשחזרו</p>
                                    <button onClick={closeDeviceModal} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-500 transition-all">סגור</button>
                                </div>
                            ) : (
                                <form onSubmit={handleDeviceSubmit} className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-2xl font-black text-gray-900">{editDevice ? 'עריכת מכשיר' : 'רישום מכשיר חדש'}</h2>
                                        <button type="button" onClick={closeDeviceModal} className="p-2 hover:bg-gray-100 rounded-xl"><FaTimes /></button>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">שם המכשיר</label>
                                        <input type="text" value={deviceForm.name} onChange={e => setDeviceForm({ ...deviceForm, name: e.target.value })} placeholder="טאבלט מטבח" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">תפקיד</label>
                                        <select value={deviceForm.role} onChange={e => setDeviceForm({ ...deviceForm, role: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none">
                                            <option value="kitchen">מטבח</option>
                                            <option value="receipt">קופה / קבלה</option>
                                            <option value="bar">בר</option>
                                            <option value="general">כללי</option>
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="col-span-2">
                                            <label className="block text-sm font-bold text-gray-700 mb-2">כתובת IP מדפסת</label>
                                            <input type="text" value={deviceForm.printer_ip} onChange={e => setDeviceForm({ ...deviceForm, printer_ip: e.target.value })} placeholder="192.168.1.100" dir="ltr" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">פורט</label>
                                            <input type="number" value={deviceForm.printer_port} onChange={e => setDeviceForm({ ...deviceForm, printer_port: parseInt(e.target.value) || 9100 })} dir="ltr" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
                                        </div>
                                    </div>
                                    <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-500 transition-all">{editDevice ? 'עדכן מכשיר' : 'רשום מכשיר'}</button>
                                </form>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
