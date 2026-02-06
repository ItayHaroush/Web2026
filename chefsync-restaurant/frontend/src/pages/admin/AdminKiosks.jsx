import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import AdminLayout from '../../layouts/AdminLayout';
import { FaTabletAlt, FaPlus, FaCrown } from 'react-icons/fa';
import {
    getKiosks,
    createKiosk,
    updateKiosk,
    deleteKiosk,
    toggleKiosk,
    regenerateKioskToken,
} from '../../services/kioskService';
import KioskCard from '../../components/kiosk/admin/KioskCard';
import KioskFormModal from '../../components/kiosk/admin/KioskFormModal';
import KioskTableQrModal from '../../components/kiosk/admin/KioskTableQrModal';

const DEFAULT_FORM = {
    name: '',
    require_name: false,
};

export default function AdminKiosks() {
    const { isManager } = useAdminAuth();
    const [kiosks, setKiosks] = useState([]);
    const [limits, setLimits] = useState({});
    const [tier, setTier] = useState('basic');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editKiosk, setEditKiosk] = useState(null);
    const [form, setForm] = useState({ ...DEFAULT_FORM });
    const [copiedId, setCopiedId] = useState(null);
    const [qrKiosk, setQrKiosk] = useState(null);

    useEffect(() => { fetchKiosks(); }, []);

    const fetchKiosks = async () => {
        try {
            const res = await getKiosks();
            if (res.success) {
                setKiosks(res.data.kiosks || []);
                setTier(res.data.tier || 'basic');
                setLimits(res.data.limits || {});
            }
        } catch (error) {
            console.error('Failed to fetch kiosks:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editKiosk) {
                await updateKiosk(editKiosk.id, form);
            } else {
                await createKiosk(form);
            }
            closeModal();
            fetchKiosks();
        } catch (error) {
            console.error('Failed to save kiosk:', error);
            alert(error.response?.data?.message || 'שגיאה בשמירה');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('למחוק את הקיוסק?')) return;
        try { await deleteKiosk(id); fetchKiosks(); }
        catch (error) { console.error('Failed to delete kiosk:', error); alert(error.response?.data?.message || 'שגיאה במחיקה'); }
    };

    const handleToggle = async (id) => {
        try { await toggleKiosk(id); fetchKiosks(); }
        catch (error) { console.error('Failed to toggle kiosk:', error); }
    };

    const handleRegenerate = async (id) => {
        if (!confirm('לחדש את הקישור? הקישור הקודם יפסיק לעבוד.')) return;
        try { await regenerateKioskToken(id); fetchKiosks(); }
        catch (error) { console.error('Failed to regenerate token:', error); }
    };

    const copyLink = (kiosk) => {
        const url = `${window.location.origin}/kiosk/${kiosk.token}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopiedId(kiosk.id);
            setTimeout(() => setCopiedId(null), 2000);
        });
    };

    const openNew = () => {
        setEditKiosk(null);
        setForm({ ...DEFAULT_FORM });
        setShowModal(true);
    };

    const openEdit = (kiosk) => {
        setEditKiosk(kiosk);
        setForm({
            name: kiosk.name,
            require_name: kiosk.require_name || false,
        });
        setShowModal(true);
    };

    const closeModal = () => { setShowModal(false); setEditKiosk(null); };

    const canCreateMore = kiosks.length < (limits.max_kiosks || 1);

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex flex-col items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-brand-primary"></div>
                    <p className="mt-4 text-gray-500 font-black animate-pulse">טוען קיוסקים...</p>
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
                        <div className="w-20 h-20 bg-amber-50 rounded-[2.5rem] flex items-center justify-center text-amber-600 shadow-sm border border-amber-100/50">
                            <FaTabletAlt size={32} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight">קיוסקים</h1>
                            <p className="text-gray-500 font-medium mt-1">
                                {kiosks.length} / {limits.max_kiosks || 1} קיוסקים פעילים
                            </p>
                        </div>
                    </div>
                    {isManager() && (
                        <button
                            onClick={canCreateMore ? openNew : undefined}
                            disabled={!canCreateMore}
                            className={`w-full md:w-auto px-10 py-5 rounded-[2rem] font-black transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 group ${canCreateMore
                                    ? 'bg-brand-primary text-white hover:bg-brand-dark shadow-brand-primary/20'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                                }`}
                        >
                            <FaPlus className="group-hover:rotate-90 transition-transform" />
                            {canCreateMore ? 'קיוסק חדש' : 'הגעתם למגבלה'}
                        </button>
                    )}
                </div>

                {/* Tier Upgrade Banner */}
                {tier === 'basic' && (
                    <div className="mx-4 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-3xl p-6 shadow-lg">
                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                                <FaCrown size={24} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-black text-gray-900">שדרגו ל-Pro</h3>
                                <p className="text-gray-600 font-medium mt-1">
                                    עד 5 קיוסקים, עיצוב מותאם אישית, ועוד תכונות מתקדמות
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Kiosks Grid */}
                {kiosks.length === 0 ? (
                    <div className="bg-white rounded-[4rem] shadow-sm border-2 border-dashed border-gray-100 p-24 text-center flex flex-col items-center col-span-full max-w-xl mx-auto">
                        <div className="w-28 h-28 bg-gray-50 rounded-[3rem] flex items-center justify-center text-6xl mb-8 grayscale opacity-50">
                            <FaTabletAlt />
                        </div>
                        <h3 className="text-3xl font-black text-gray-900 mb-2">אין קיוסקים עדיין</h3>
                        <p className="text-gray-500 font-medium mb-12 text-lg leading-relaxed">
                            צרו קיוסק שיאפשר ללקוחות להזמין ישירות מטאבלט במסעדה
                        </p>
                        {isManager() && (
                            <button
                                onClick={openNew}
                                className="bg-brand-primary text-white px-12 py-5 rounded-[2rem] font-black hover:bg-brand-dark transition-all flex items-center gap-4 shadow-lg shadow-brand-primary/20"
                            >
                                <FaPlus /> יצירת קיוסק ראשון
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-4">
                        {kiosks.map((kiosk) => (
                            <KioskCard
                                key={kiosk.id}
                                kiosk={kiosk}
                                copiedId={copiedId}
                                isManager={isManager()}
                                onEdit={openEdit}
                                onDelete={handleDelete}
                                onToggle={handleToggle}
                                onRegenerate={handleRegenerate}
                                onCopyLink={copyLink}
                                onQrCode={setQrKiosk}
                            />
                        ))}
                    </div>
                )}

                {/* Create/Edit Modal */}
                {showModal && (
                    <KioskFormModal
                        form={form}
                        setForm={setForm}
                        editKiosk={editKiosk}
                        onSubmit={handleSubmit}
                        onClose={closeModal}
                    />
                )}

                {/* QR Code Modal */}
                {qrKiosk && (
                    <KioskTableQrModal
                        kiosk={qrKiosk}
                        onClose={() => setQrKiosk(null)}
                    />
                )}
            </div>
        </AdminLayout>
    );
}
