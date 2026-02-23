import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import AdminLayout from '../../layouts/AdminLayout';
import { FaPrint, FaPlus } from 'react-icons/fa';
import api from '../../services/apiClient';
import {
    getPrinters,
    createPrinter,
    updatePrinter,
    deletePrinter,
    togglePrinter,
    testPrint,
} from '../../services/printerService';
import PrinterCard from '../../components/printer/admin/PrinterCard';
import PrinterFormModal from '../../components/printer/admin/PrinterFormModal';

const DEFAULT_FORM = {
    name: '',
    type: 'browser',
    role: 'kitchen',
    ip_address: '',
    port: 9100,
    paper_width: '80mm',
    category_ids: [],
};

export default function AdminPrinters() {
    const { isManager, getAuthHeaders } = useAdminAuth();
    const [printers, setPrinters] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editPrinter, setEditPrinter] = useState(null);
    const [form, setForm] = useState({ ...DEFAULT_FORM });
    const [testingId, setTestingId] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [printersRes, categoriesRes] = await Promise.all([
                getPrinters(),
                api.get('/admin/categories', { headers: getAuthHeaders() }),
            ]);
            if (printersRes.success) {
                setPrinters(printersRes.printers || []);
            }
            if (categoriesRes.data?.success) {
                setCategories(categoriesRes.data.categories || []);
            }
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
                                {printers.length} מדפסות מוגדרות — מטבח וקופה
                            </p>
                        </div>
                    </div>
                    {isManager() && (
                        <button
                            onClick={openNew}
                            className="w-full md:w-auto px-10 py-5 rounded-[2rem] font-black transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 group bg-blue-600 text-white hover:bg-blue-500 shadow-blue-600/20"
                        >
                            <FaPlus className="group-hover:rotate-90 transition-transform" />
                            מדפסת חדשה
                        </button>
                    )}
                </div>

                {/* Printers Grid */}
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

                {/* Create/Edit Modal */}
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
            </div>
        </AdminLayout>
    );
}
