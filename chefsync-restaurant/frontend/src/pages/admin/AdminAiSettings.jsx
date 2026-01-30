import { useState, useEffect } from 'react';
import { FaBrain, FaImage, FaDollarSign, FaToggleOn, FaToggleOff, FaChartLine } from 'react-icons/fa';
import { MdDescription, MdRestaurantMenu } from 'react-icons/md';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { getAuthHeaders } from '../../utils/auth';

/**
 * מסך ניהול פיצ'רים מתקדמים של AI - למנהל מערכת בלבד
 * מאפשר לכבות/להפעיל פיצ'רים לכל מסעדה
 */
export default function SuperAdminAiSettings() {
    const [restaurants, setRestaurants] = useState([]);
    const [selectedRestaurant, setSelectedRestaurant] = useState(null);
    const [settings, setSettings] = useState({
        description_generator: true,
        price_suggestion: true,
        image_enhancement: true,
    });
    const [stats, setStats] = useState({
        total_credits_used: 0,
        total_credits_remaining: 0,
        descriptions_generated: 0,
        images_enhanced: 0,
        prices_suggested: 0,
    });
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();

    useEffect(() => {
        fetchRestaurants();
    }, []);

    useEffect(() => {
        if (selectedRestaurant) {
            fetchData();
        }
    }, [selectedRestaurant]);

    const fetchRestaurants = async () => {
        try {
            const response = await api.get('/super-admin/restaurants', { headers: getAuthHeaders() });
            if (response.data.success) {
                setRestaurants(response.data.restaurants);
                if (response.data.restaurants.length > 0) {
                    setSelectedRestaurant(response.data.restaurants[0].id);
                }
            }
        } catch (error) {
            console.error('Error fetching restaurants:', error);
            addToast('שגיאה בטעינת מסעדות', 'error');
        }
    };

    const fetchData = async () => {
        if (!selectedRestaurant) return;

        try {
            const [settingsRes, statsRes] = await Promise.all([
                api.get(`/super-admin/ai/settings/${selectedRestaurant}`, { headers: getAuthHeaders() }),
                api.get(`/super-admin/ai/stats/${selectedRestaurant}`, { headers: getAuthHeaders() })
            ]);

            if (settingsRes.data.success) {
                setSettings(settingsRes.data.data);
            }
            if (statsRes.data.success) {
                setStats(statsRes.data.data);
            }
        } catch (error) {
            console.error('Error fetching AI settings:', error);
            addToast('שגיאה בטעינת הגדרות AI', 'error');
        } finally {
            setLoading(false);
        }
    };

    const toggleFeature = async (feature) => {
        try {
            const newValue = !settings[feature];
            const response = await api.post('/super-admin/ai/toggle-feature', {
                restaurant_id: selectedRestaurant,
                feature,
                enabled: newValue
            }, { headers: getAuthHeaders() });

            if (response.data.success) {
                setSettings(prev => ({ ...prev, [feature]: newValue }));
                addToast(
                    `פיצ'ר ${getFeatureName(feature)} ${newValue ? 'הופעל' : 'כובה'} בהצלחה`,
                    'success'
                );
            }
        } catch (error) {
            console.error('Error toggling feature:', error);
            addToast('שגיאה בעדכון הגדרות', 'error');
        }
    };

    const getFeatureName = (feature) => {
        const names = {
            description_generator: 'יצירת תיאורים',
            price_suggestion: 'הצעת מחירים',
            image_enhancement: 'שיפור תמונות',
        };
        return names[feature] || feature;
    };

    const features = [
        {
            key: 'description_generator',
            name: 'יצירת תיאורים אוטומטית',
            description: 'AI יוצר תיאורים מושכים למנות על בסיס השם',
            icon: <MdDescription className="text-3xl" />,
            color: 'blue',
            costPerUse: '1 קרדיט',
        },
        {
            key: 'price_suggestion',
            name: 'הצעת מחירים חכמה',
            description: 'המלצות מחיר על בסיס מרכיבים וקטגוריה',
            icon: <FaDollarSign className="text-3xl" />,
            color: 'green',
            costPerUse: '1 קרדיט',
        },
        {
            key: 'image_enhancement',
            name: 'שיפור תמונות עם AI',
            description: 'Stability AI משפר תמונות מזון לרמה מקצועית',
            icon: <FaImage className="text-3xl" />,
            color: 'purple',
            costPerUse: '1 קרדיט',
        },
    ];

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
                    <p className="text-gray-600">טוען הגדרות AI...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                                <FaBrain className="text-3xl text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-800">ניהול פיצ'רים מתקדמים</h1>
                                <p className="text-gray-600">שלוט ביכולות AI של כל מסעדה</p>
                            </div>
                        </div>
                    </div>

                    {/* Restaurant Selector */}
                    <div className="mt-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            בחר מסעדה:
                        </label>
                        <select
                            value={selectedRestaurant || ''}
                            onChange={(e) => setSelectedRestaurant(Number(e.target.value))}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none"
                        >
                            {restaurants.map(restaurant => (
                                <option key={restaurant.id} value={restaurant.id}>
                                    {restaurant.name} - {restaurant.slug}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Credits Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 text-white">
                        <div className="flex items-center justify-between mb-2">
                            <FaChartLine className="text-3xl opacity-80" />
                            <span className="text-2xl font-bold">{stats.total_credits_remaining}</span>
                        </div>
                        <h3 className="text-lg font-semibold opacity-90">קרדיטים נותרים</h3>
                        <p className="text-sm opacity-75">זמינים לשימוש</p>
                    </div>

                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg p-6 text-white">
                        <div className="flex items-center justify-between mb-2">
                            <FaDollarSign className="text-3xl opacity-80" />
                            <span className="text-2xl font-bold">{stats.total_credits_used}</span>
                        </div>
                        <h3 className="text-lg font-semibold opacity-90">קרדיטים בשימוש</h3>
                        <p className="text-sm opacity-75">החודש</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white">
                        <div className="flex items-center justify-between mb-2">
                            <MdRestaurantMenu className="text-3xl opacity-80" />
                            <span className="text-2xl font-bold">{stats.descriptions_generated + stats.images_enhanced}</span>
                        </div>
                        <h3 className="text-lg font-semibold opacity-90">פעולות AI</h3>
                        <p className="text-sm opacity-75">סה"כ החודש</p>
                    </div>
                </div>

                {/* Features Toggle */}
                <div className="space-y-4">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FaToggleOn className="text-brand-primary" />
                        <span>פיצ'רים זמינים</span>
                    </h2>

                    {features.map((feature) => (
                        <div
                            key={feature.key}
                            className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 flex-1">
                                    <div className={`p-4 bg-${feature.color}-100 rounded-xl text-${feature.color}-600`}>
                                        {feature.icon}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-gray-800 mb-1">{feature.name}</h3>
                                        <p className="text-gray-600 text-sm mb-2">{feature.description}</p>
                                        <div className="flex items-center gap-4 text-sm">
                                            <span className="text-gray-500">עלות: {feature.costPerUse}</span>
                                            {feature.key === 'description_generator' && (
                                                <span className="text-green-600 font-semibold">
                                                    שימושים: {stats.descriptions_generated}
                                                </span>
                                            )}
                                            {feature.key === 'image_enhancement' && (
                                                <span className="text-purple-600 font-semibold">
                                                    שימושים: {stats.images_enhanced}
                                                </span>
                                            )}
                                            {feature.key === 'price_suggestion' && (
                                                <span className="text-blue-600 font-semibold">
                                                    שימושים: {stats.prices_suggested}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Toggle Button */}
                                <button
                                    onClick={() => toggleFeature(feature.key)}
                                    className={`relative inline-flex h-12 w-24 items-center rounded-full transition-colors ${settings[feature.key]
                                            ? 'bg-green-500'
                                            : 'bg-gray-300'
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-10 w-10 transform rounded-full bg-white shadow-lg transition-transform ${settings[feature.key] ? 'translate-x-12' : 'translate-x-1'
                                            }`}
                                    >
                                        {settings[feature.key] ? (
                                            <FaToggleOn className="h-10 w-10 text-green-500" />
                                        ) : (
                                            <FaToggleOff className="h-10 w-10 text-gray-400" />
                                        )}
                                    </span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Info Box */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <FaBrain className="text-blue-600" />
                        <span>מידע חשוב</span>
                    </h3>
                    <ul className="space-y-2 text-gray-700">
                        <li className="flex items-start gap-2">
                            <span className="text-blue-600 font-bold">•</span>
                            <span>כל פיצ'ר משתמש בקרדיטים - וודא שיש לך מספיק קרדיטים לפני השימוש</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-600 font-bold">•</span>
                            <span>כיבוי פיצ'ר לא ישפיע על תוכן קיים, רק על יצירה חדשה</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-600 font-bold">•</span>
                            <span>שיפור תמונות (Stability AI) - עכשיו עם strength 70% לשיפור בולט וברור</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
