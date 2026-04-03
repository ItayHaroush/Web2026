import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import AdminLayout from '../../layouts/AdminLayout';
import { FaTabletAlt, FaPlus } from 'react-icons/fa';
import api from '../../services/apiClient';
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
import MobileAddFab from '../../components/admin/MobileAddFab';
import UpgradeBanner from '../../components/UpgradeBanner';

const DEFAULT_FORM = {
    name: '',
    require_name: false,
    payment_terminal_id: '',
};

export default function AdminKiosks({ embedded = false }) {
    const { isManager, getAuthHeaders } = useAdminAuth();
    const navigate = useNavigate();
    const [kiosks, setKiosks] = useState([]);
    const [limits, setLimits] = useState({});
    const [tier, setTier] = useState('basic');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editKiosk, setEditKiosk] = useState(null);
    const [form, setForm] = useState({ ...DEFAULT_FORM });
    const [copiedId, setCopiedId] = useState(null);
    const [qrKiosk, setQrKiosk] = useState(null);
    const [paymentTerminals, setPaymentTerminals] = useState([]);

    useEffect(() => { fetchKiosks(); }, []);

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get('/admin/payment-terminals', { headers: getAuthHeaders() });
                if (res.data?.success && Array.isArray(res.data.terminals)) {
                    setPaymentTerminals(res.data.terminals);
                }
            } catch {
                setPaymentTerminals([]);
            }
        })();
    }, [getAuthHeaders]);

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
            const payload = {
                ...form,
                payment_terminal_id:
                    form.payment_terminal_id === '' || form.payment_terminal_id == null
                        ? null
                        : Number(form.payment_terminal_id),
            };
            if (editKiosk) {
                await updateKiosk(editKiosk.id, payload);
            } else {
                await createKiosk(payload);
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
        const kiosk = kiosks.find(k => k.id === id);
        const hasTables = kiosk?.tables?.length > 0;
        const msg = hasTables
            ? 'לחדש את הקישור?\n\n⚠️ שימו לב: כל קודי ה-QR של השולחנות שהודפסו יפסיקו לעבוד ויש להדפיס חדשים!'
            : 'לחדש את הקישור? הקישור הקודם יפסיק לעבוד.';
        if (!confirm(msg)) return;
        try {
            const res = await regenerateKioskToken(id);
            if (res.message) alert(res.message);
            fetchKiosks();
        } catch (error) {
            console.error('Failed to regenerate token:', error);
        }
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
            payment_terminal_id: kiosk.payment_terminal_id ?? '',
        });
        setShowModal(true);
    };

    const closeModal = () => { setShowModal(false); setEditKiosk(null); };

    const isUnlimitedKiosks = limits.max_kiosks === null || limits.max_kiosks === undefined;
    const canCreateMore = isUnlimitedKiosks || kiosks.length < (limits.max_kiosks || 1);
    const isEnterprise = tier === 'enterprise';
    const atLimitAction = isEnterprise
        ? () => window.open('https://wa.me/972547466508?text=שלום, אני בחבילת מסעדה מלאה ומעוניין להוסיף קיוסקים נוספים', '_blank')
        : () => window.open('https://wa.me/972547466508?text=שלום, אני מעוניין בחבילת מסעדה מלאה – קיוסקים נוספים', '_blank');
    const atLimitLabel = isEnterprise ? 'צור קשר להוספת קיוסקים' : 'שדרג למסעדה מלאה';

    if (loading) {
        const loader = (
            <div className="flex flex-col items-center justify-center h-96">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-brand-primary"></div>
                <p className="mt-4 text-gray-500 font-black animate-pulse">טוען קיוסקים...</p>
            </div>
        );
        if (embedded) return loader;
        return <AdminLayout>{loader}</AdminLayout>;
    }

    const content = (
        <div className="max-w-6xl mx-auto space-y-12 pb-32 animate-in fade-in duration-500">
            {!embedded && (
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 px-4">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 bg-amber-50 rounded-[2.5rem] flex items-center justify-center text-amber-600 shadow-sm border border-amber-100/50">
                            <FaTabletAlt size={32} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight">קיוסקים</h1>
                            <p className="text-gray-500 font-medium mt-1">
                                {isUnlimitedKiosks
                                    ? `${kiosks.length} קיוסקים פעילים (ללא הגבלה)`
                                    : `${kiosks.length} / ${limits.max_kiosks || 1} קיוסקים פעילים`}
                            </p>
                        </div>
                    </div>
                    {isManager() && (
                        <div className="hidden md:flex items-center gap-4">
                            <UpgradeBanner requiredTier="enterprise" context="kiosks" feature="kiosks" variant="inline" />
                            <button
                                onClick={canCreateMore ? openNew : atLimitAction}
                                className={`px-10 py-5 rounded-[2rem] font-black transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 group shrink-0 ${canCreateMore
                                    ? 'bg-brand-primary text-white hover:bg-brand-dark shadow-brand-primary/20'
                                    : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-purple-200'
                                    }`}
                            >
                                <FaPlus className="group-hover:rotate-90 transition-transform" />
                                {canCreateMore ? 'קיוסק חדש' : atLimitLabel}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {embedded && isManager() && (
                <div className="hidden md:flex items-center justify-end gap-4 mb-6 px-4">
                    <UpgradeBanner requiredTier="enterprise" context="kiosks" feature="kiosks" variant="inline" />
                    <button
                        type="button"
                        onClick={canCreateMore ? openNew : atLimitAction}
                        className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm shadow-lg shrink-0 ${canCreateMore
                            ? 'bg-brand-primary text-white hover:bg-brand-dark shadow-brand-primary/20'
                            : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-purple-200'
                            }`}
                    >
                        <FaPlus />
                        {canCreateMore ? 'קיוסק חדש' : atLimitLabel}
                    </button>
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
                            tier={tier}
                            paymentTerminals={paymentTerminals}
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
                    paymentTerminals={paymentTerminals}
                    onSubmit={handleSubmit}
                    onClose={closeModal}
                />
            )}

            {/* QR Code Modal */}
            {qrKiosk && (
                <KioskTableQrModal
                    kiosk={qrKiosk}
                    maxTables={limits.max_tables || 10}
                    onClose={() => setQrKiosk(null)}
                    onTablesUpdated={fetchKiosks}
                />
            )}
            {isManager() && !showModal && !qrKiosk && (
                <MobileAddFab
                    label={canCreateMore ? 'קיוסק חדש' : atLimitLabel}
                    onClick={canCreateMore ? openNew : atLimitAction}
                />
            )}
        </div>
    );

    if (embedded) return content;
    return <AdminLayout>{content}</AdminLayout>;
}
