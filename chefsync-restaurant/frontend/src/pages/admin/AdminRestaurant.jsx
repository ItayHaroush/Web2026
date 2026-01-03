import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import AdminLayout from '../../layouts/AdminLayout';
import api from '../../services/apiClient';

export default function AdminRestaurant() {
    const { getAuthHeaders, isOwner } = useAdminAuth();
    const [restaurant, setRestaurant] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [logoPreview, setLogoPreview] = useState(null);

    useEffect(() => {
        fetchRestaurant();
    }, []);

    const fetchRestaurant = async () => {
        try {
            const response = await api.get('/admin/restaurant', { headers: getAuthHeaders() });
            if (response.data.success) {
                setRestaurant(response.data.restaurant);
                setLogoPreview(response.data.restaurant.logo_url || null);
            }
        } catch (error) {
            console.error('Failed to fetch restaurant:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field, value) => {
        setRestaurant((prev) => ({ ...prev, [field]: value }));
    };

    const handleLogo = (file) => {
        setRestaurant((prev) => ({ ...prev, logo: file }));
        setLogoPreview(URL.createObjectURL(file));
    };

    const save = async (e) => {
        e.preventDefault();
        if (!isOwner()) {
            alert('רק בעל המסעדה יכול לעדכן פרטים');
            return;
        }
        setSaving(true);
        try {
            const formData = new FormData();
            ['name', 'description', 'phone', 'address', 'is_open'].forEach((field) => {
                if (restaurant[field] !== undefined && restaurant[field] !== null) {
                    formData.append(field, restaurant[field]);
                }
            });
            if (restaurant.logo) {
                formData.append('logo', restaurant.logo);
            }

            await api.put('/admin/restaurant', formData, {
                headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' },
            });
            alert('נשמר בהצלחה');
            fetchRestaurant();
        } catch (error) {
            console.error('Failed to save restaurant:', error);
            alert(error.response?.data?.message || 'שגיאה בשמירה');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
                </div>
            </AdminLayout>
        );
    }

    if (!restaurant) {
        return (
            <AdminLayout>
                <div className="p-8 text-center text-gray-500">לא נמצאו נתוני מסעדה</div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="max-w-3xl mx-auto">
                <h1 className="text-2xl font-bold text-gray-800 mb-6">🏪 פרטי מסעדה</h1>
                <form onSubmit={save} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-6">
                        <div className="flex-1 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">שם</label>
                                <input
                                    type="text"
                                    value={restaurant.name || ''}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                    required
                                    className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">תיאור</label>
                                <textarea
                                    value={restaurant.description || ''}
                                    onChange={(e) => handleChange('description', e.target.value)}
                                    rows={3}
                                    className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                />
                            </div>
                        </div>
                        <div className="w-full sm:w-48">
                            <div className="bg-gray-50 rounded-2xl p-4 text-center">
                                {logoPreview ? (
                                    <img src={logoPreview} alt="logo" className="w-32 h-32 object-contain mx-auto mb-2" />
                                ) : (
                                    <div className="w-32 h-32 mx-auto bg-white border rounded-2xl flex items-center justify-center text-3xl">🏪</div>
                                )}
                                <label className="block mt-3 text-sm font-medium text-brand-primary cursor-pointer">
                                    העלאת לוגו
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogo(e.target.files[0])} />
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
                            <input
                                type="text"
                                value={restaurant.phone || ''}
                                onChange={(e) => handleChange('phone', e.target.value)}
                                className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">כתובת</label>
                            <input
                                type="text"
                                value={restaurant.address || ''}
                                onChange={(e) => handleChange('address', e.target.value)}
                                className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <label className="text-sm text-gray-700">סטטוס פתיחה</label>
                        <button
                            type="button"
                            onClick={() => handleChange('is_open', !restaurant.is_open)}
                            className={`px-4 py-2 rounded-full text-sm font-medium ${restaurant.is_open ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}
                        >
                            {restaurant.is_open ? 'פתוח' : 'סגור'}
                        </button>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 bg-brand-primary text-white py-3 rounded-xl font-medium hover:bg-brand-dark disabled:opacity-50"
                        >
                            {saving ? 'שומר...' : 'שמור'}
                        </button>
                        <button
                            type="button"
                            onClick={fetchRestaurant}
                            className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200"
                        >
                            רענן
                        </button>
                    </div>
                </form>
            </div>
        </AdminLayout>
    );
}
