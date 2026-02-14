import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SuperAdminLayout from '../../../layouts/SuperAdminLayout';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import api from '../../../services/apiClient';
import { toast } from 'react-hot-toast';
import {
    FaShieldAlt,
    FaArrowRight,
    FaSave,
    FaSpinner,
    FaCheckCircle,
    FaClock,
    FaUpload,
    FaFileAlt,
    FaGavel,
    FaUserShield,
    FaCookieBite
} from 'react-icons/fa';

const POLICY_TABS = [
    { key: 'terms_end_user', label: 'תנאי שימוש – משתמשים', icon: FaGavel, fallbackPath: '/legal/terms-end-user.md' },
    { key: 'terms_restaurant', label: 'תנאי שימוש – מסעדנים', icon: FaGavel, fallbackPath: '/legal/terms-restaurant.md' },
    { key: 'privacy_policy', label: 'מדיניות פרטיות', icon: FaUserShield, fallbackPath: '/legal/privacy.md' },
    { key: 'cookie_banner', label: 'באנר עוגיות', icon: FaCookieBite, fallbackPath: null }
];

export default function PolicySettings() {
    const { getAuthHeaders } = useAdminAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(null);
    const [activeTab, setActiveTab] = useState('terms_end_user');
    const [versions, setVersions] = useState([]);
    const [content, setContent] = useState('');

    useEffect(() => {
        fetchPolicies(activeTab);
    }, [activeTab]);

    const fetchPolicies = async (type) => {
        setLoading(true);
        try {
            const response = await api.get(`/super-admin/policies/${type}`, {
                headers: getAuthHeaders()
            });
            if (response.data.success) {
                const data = response.data.data || response.data.versions || [];
                setVersions(data);
                // Set content to the latest version
                if (data.length > 0) {
                    const latest = data[0];
                    setContent(latest.content || '');
                } else {
                    // No versions in DB - try loading from static markdown file
                    const tab = POLICY_TABS.find(t => t.key === type);
                    if (tab?.fallbackPath) {
                        try {
                            const res = await fetch(tab.fallbackPath);
                            if (res.ok) {
                                const text = await res.text();
                                setContent(text);
                            } else {
                                setContent('');
                            }
                        } catch {
                            setContent('');
                        }
                    } else {
                        setContent('');
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load policies:', error);
            toast.error('שגיאה בטעינת מסמכי מדיניות');
            setVersions([]);
            setContent('');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveDraft = async () => {
        if (!content.trim()) {
            toast.error('אין אפשרות לשמור מסמך ריק');
            return;
        }
        setSaving(true);
        try {
            const response = await api.post('/super-admin/policies', {
                policy_type: activeTab,
                content: content
            }, {
                headers: getAuthHeaders()
            });

            if (response.data.success) {
                toast.success('טיוטה נשמרה בהצלחה');
                fetchPolicies(activeTab);
            }
        } catch (error) {
            console.error('Failed to save draft:', error);
            toast.error(error.response?.data?.message || 'שגיאה בשמירת טיוטה');
        } finally {
            setSaving(false);
        }
    };

    const handlePublish = async (policyId) => {
        setPublishing(policyId);
        try {
            const response = await api.post(`/super-admin/policies/${policyId}/publish`, {}, {
                headers: getAuthHeaders()
            });

            if (response.data.success) {
                toast.success('הגרסה פורסמה בהצלחה');
                fetchPolicies(activeTab);
            }
        } catch (error) {
            console.error('Failed to publish policy:', error);
            toast.error(error.response?.data?.message || 'שגיאה בפרסום הגרסה');
        } finally {
            setPublishing(null);
        }
    };

    const currentTabInfo = POLICY_TABS.find(t => t.key === activeTab);

    return (
        <SuperAdminLayout>
            <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-4">
                {/* Back link */}
                <Link
                    to="/super-admin/settings"
                    className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-brand-primary transition-colors mb-6"
                >
                    <FaArrowRight size={12} />
                    חזרה להגדרות
                </Link>

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                        <div className="p-2.5 bg-brand-primary/10 rounded-xl">
                            <FaShieldAlt className="text-brand-primary" size={20} />
                        </div>
                        מדיניות ותנאי שימוש
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">ניהול מסמכים משפטיים, תנאי שימוש ומדיניות פרטיות</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar mb-6">
                    {POLICY_TABS.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border whitespace-nowrap flex items-center gap-2 ${activeTab === tab.key
                                        ? 'bg-brand-primary text-white border-brand-primary shadow-lg shadow-brand-primary/20'
                                        : 'bg-white text-gray-600 border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                                    }`}
                            >
                                <Icon size={12} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center min-h-[40vh]">
                        <FaSpinner className="animate-spin text-brand-primary" size={32} />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Editor */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                                        <FaFileAlt className="text-gray-400" size={12} />
                                        עורך תוכן - {currentTabInfo?.label}
                                    </h2>
                                </div>

                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder={`הזן את תוכן ה${currentTabInfo?.label} כאן...`}
                                    rows="18"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium resize-none leading-relaxed"
                                    dir="rtl"
                                />

                                <div className="flex justify-end mt-4">
                                    <button
                                        onClick={handleSaveDraft}
                                        disabled={saving}
                                        className="px-6 py-3 bg-brand-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {saving ? (
                                            <>
                                                <FaSpinner className="animate-spin" size={12} />
                                                שומר...
                                            </>
                                        ) : (
                                            <>
                                                <FaSave size={12} />
                                                שמור טיוטה
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Versions Sidebar */}
                        <div className="space-y-4">
                            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                                <h3 className="text-sm font-black text-gray-900 mb-4 flex items-center gap-2">
                                    <FaClock className="text-gray-400" size={12} />
                                    היסטוריית גרסאות
                                </h3>

                                {versions.length === 0 ? (
                                    <div className="text-center py-6">
                                        <FaFileAlt className="mx-auto text-gray-200 mb-3" size={28} />
                                        <p className="text-xs text-gray-400 font-bold">אין גרסאות קיימות</p>
                                        <p className="text-[10px] text-gray-300 mt-1">שמור טיוטה ראשונה כדי להתחיל</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                                        {versions.map((version) => (
                                            <div
                                                key={version.id}
                                                className="p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-all"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-black text-gray-900">
                                                        גרסה {version.version || version.id}
                                                    </span>
                                                    {version.is_published || version.published ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-green-100 text-green-700 border border-green-200">
                                                            <FaCheckCircle size={8} />
                                                            פורסם
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-gray-100 text-gray-500 border border-gray-200">
                                                            טיוטה
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="text-[10px] text-gray-400 mb-2 flex items-center gap-1">
                                                    <FaClock size={8} />
                                                    {new Date(version.created_at).toLocaleDateString('he-IL', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: '2-digit',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </p>

                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setContent(version.content || '')}
                                                        className="flex-1 px-3 py-1.5 bg-white text-gray-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-gray-100 transition-all border border-gray-200"
                                                    >
                                                        טען
                                                    </button>
                                                    {!(version.is_published || version.published) && (
                                                        <button
                                                            onClick={() => handlePublish(version.id)}
                                                            disabled={publishing === version.id}
                                                            className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                                                        >
                                                            {publishing === version.id ? (
                                                                <FaSpinner className="animate-spin" size={8} />
                                                            ) : (
                                                                <>
                                                                    <FaUpload size={8} />
                                                                    פרסם
                                                                </>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </SuperAdminLayout>
    );
}
