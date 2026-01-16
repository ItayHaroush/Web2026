import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FaPhoneAlt, FaUtensils, FaMotorcycle, FaShoppingBag } from 'react-icons/fa';
import { SiWaze } from 'react-icons/si';
import apiClient from '../services/apiClient';
import { resolveAssetUrl } from '../utils/assets';
import { useCart } from '../context/CartContext';

const normalizeOrderType = (type) => {
    if (type === 'delivery' || type === 'pickup') return type;
    return null;
};

const buildShareUrl = ({ origin, slug, type }) => {
    const base = `${origin}/r/${encodeURIComponent(slug)}`;
    if (!type) return base;
    return `${base}?type=${encodeURIComponent(type)}`;
};

const DEFAULT_INCENTIVE_TEXT = [
    'הרעב מתחיל כאן.',
    'הזמינו בקלות ובמהירות',
    'בלי לחכות בתור ובלי להמתין למלצר',
].join('\n');

export default function RestaurantSharePage() {
    const { slug: slugParam } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { setCustomerInfo } = useCart();

    const [restaurant, setRestaurant] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const orderType = normalizeOrderType(searchParams.get('type'));

    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    useEffect(() => {
        if (!slugParam) return;

        const load = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await apiClient.get(`/restaurants/by-tenant/${encodeURIComponent(slugParam)}`);
                const data = response.data?.data || null;

                if (!data?.tenant_id || !data?.slug) {
                    throw new Error('Invalid restaurant response');
                }

                // Canonical redirect: support /r/{tenant_id} but prefer /r/{slug}
                if (slugParam !== data.slug) {
                    const target = buildShareUrl({ origin: window.location.origin, slug: data.slug, type: orderType });
                    navigate(target.replace(window.location.origin, ''), { replace: true });
                }

                // Ensure tenant is set for the rest of the app (X-Tenant-ID)
                localStorage.setItem('tenantId', data.tenant_id);

                // Preselect order type (delivery/pickup) if provided
                if (orderType) {
                    setCustomerInfo((prev) => ({ ...prev, delivery_method: orderType }));
                }

                setRestaurant(data);
            } catch (e) {
                console.error('Failed to load restaurant share page:', e);
                setError('לא הצלחנו לטעון את עמוד המסעדה.');
            } finally {
                setLoading(false);
            }
        };

        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slugParam]);

    const isOpenNow = restaurant?.is_open_now ?? restaurant?.is_open;
    const isClosed = isOpenNow === false;

    const canDelivery = (restaurant?.has_delivery ?? true) && !isClosed;
    const canPickup = (restaurant?.has_pickup ?? true) && !isClosed;

    const incentiveText = (restaurant?.share_incentive_text || DEFAULT_INCENTIVE_TEXT).trim();
    const incentiveLines = incentiveText.split(/\r?\n/).filter(Boolean);
    const [line1, line2, ...restLines] = incentiveLines;

    const deliveryTime = restaurant?.delivery_time_minutes;
    const pickupTime = restaurant?.pickup_time_minutes;
    const deliveryNote = restaurant?.delivery_time_note;
    const pickupNote = restaurant?.pickup_time_note;

    const goToMenu = (type) => {
        const normalized = normalizeOrderType(type);
        if (!restaurant?.tenant_id) return;

        if (normalized) {
            setCustomerInfo((prev) => ({ ...prev, delivery_method: normalized }));
        }

        const target = `/${encodeURIComponent(restaurant.tenant_id)}/menu${normalized ? `?type=${normalized}` : ''}`;
        navigate(target);
    };

    const phoneDigits = (restaurant?.phone || '').replace(/[^\d+]/g, '');
    const phoneHref = phoneDigits ? `tel:${phoneDigits}` : null;

    const wazeQuery = [restaurant?.address, restaurant?.city].filter(Boolean).join(' ');
    const wazeHref = wazeQuery
        ? `https://waze.com/ul?q=${encodeURIComponent(wazeQuery)}&navigate=yes`
        : null;

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6" dir="rtl">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="w-24 h-24 bg-gray-800 rounded-full"></div>
                    <div className="w-48 h-6 bg-gray-800 rounded"></div>
                </div>
            </div>
        );
    }

    if (error || !restaurant) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6 text-center" dir="rtl">
                <div className="max-w-md">
                    <h1 className="text-xl font-bold mb-2">שגיאה בטעינת העמוד</h1>
                    <p className="text-gray-400 mb-4">{error || 'המסעדה לא נמצאה'}</p>
                    <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 rounded-lg">נסה שוב</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white font-[Rubik] relative overflow-hidden flex flex-col items-center py-12 px-6" dir="rtl">
            {/* Background Overlay */}
            <div
                className="absolute inset-0 z-0 bg-cover bg-center opacity-20 pointer-events-none blur-3xl scale-110 grayscale"
                style={{
                    backgroundImage: restaurant.logo_url ? `url(${resolveAssetUrl(restaurant.logo_url)})` : 'none',
                    backgroundColor: '#111827' // fallback
                }}
            ></div>

            <div className="relative z-10 w-full max-w-md flex flex-col gap-8 text-center animate-[slideDown_0.5s_ease-out]">
                {/* Identity */}

                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        {restaurant.logo_url ? (
                            <img
                                src={resolveAssetUrl(restaurant.logo_url)}
                                alt={restaurant.name}
                                className="w-32 h-32 rounded-full border-4 border-gray-800 shadow-2xl object-cover bg-white"
                            />
                        ) : (
                            <div className="w-32 h-32 rounded-full border-4 border-gray-800 bg-gray-800 flex items-center justify-center text-4xl font-bold shadow-2xl">
                                {restaurant.name?.charAt(0)}
                            </div>
                        )}
                        <div className={`absolute bottom-0 right-0 w-8 h-8 rounded-full border-4 border-gray-900 flex items-center justify-center ${isClosed ? 'bg-red-500' : 'bg-green-500'}`}>
                        </div>
                    </div>

                    <div>
                        <h1 className="text-3xl font-bold mb-2 drop-shadow-md tracking-wide">{restaurant.name}</h1>
                        <p className="text-gray-400 text-lg flex items-center justify-center gap-2">
                            {restaurant.address} {restaurant.city && `• ${restaurant.city}`}
                        </p>
                    </div>
                </div>

                {/* Incentive Text */}
                <div className="py-2">
                    <h2 className="text-xl font-medium text-gray-200 leading-relaxed">
                        {line1 || 'ברוכים הבאים'}
                        {line2 && (
                            <>
                                <br />
                                <span className="text-blue-400 font-bold text-2xl">{line2}</span>
                            </>
                        )}
                        {restLines.length > 0 && (
                            <>
                                <br />
                                <span className="text-sm text-gray-500 mt-1 block">
                                    {restLines.join(' · ')}
                                </span>
                            </>
                        )}
                    </h2>
                </div>

                {isClosed && (
                    <div className="bg-red-900/20 border border-red-900/50 p-4 rounded-xl backdrop-blur-sm">
                        <p className="text-red-300 font-medium">
                            המסעדה סגורה כרגע 😴
                        </p>
                        <p className="text-red-400/80 text-sm mt-1">
                            אבל אל דאגה, התפריט פתוח להתרשמות
                        </p>
                    </div>
                )}
                {/* Main Actions */}
                <div className="flex flex-col gap-4 w-full">
                    <button
                        onClick={() => goToMenu(null)}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-blue-900/30 transition-all transform active:scale-95 flex items-center justify-center gap-3 text-lg border border-blue-500"
                    >
                        <FaUtensils className="text-xl" /> לתפריט המלא
                    </button>

                    <div className="grid grid-cols-2 gap-4">
                        {canDelivery && (
                            <div className="flex flex-col items-center gap-2">
                                <button
                                    onClick={() => goToMenu('delivery')}
                                    className="w-full py-4 px-4 rounded-2xl font-bold flex flex-col items-center justify-center gap-2 transition-all border bg-gray-800 border-gray-700 hover:bg-gray-750 hover:border-gray-600 text-white shadow-lg active:scale-95"
                                >
                                    <FaMotorcycle size={24} className="text-blue-400" />
                                    <span>משלוח</span>
                                </button>
                                {deliveryTime && (
                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                        <span>⏱️ {deliveryTime} דק'</span>
                                        {deliveryNote && (
                                            <div className="relative group">
                                                <button
                                                    type="button"
                                                    className="w-4 h-4 rounded-full bg-amber-400 text-gray-900 text-[10px] font-bold flex items-center justify-center"
                                                    aria-label="מידע נוסף על זמן משלוח"
                                                >
                                                    !
                                                </button>
                                                <div className="absolute z-10 hidden group-hover:block group-focus-within:block top-6 right-0 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg max-w-xs whitespace-pre-wrap">
                                                    {deliveryNote}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {canPickup && (
                            <div className="flex flex-col items-center gap-2">
                                <button
                                    onClick={() => goToMenu('pickup')}
                                    className="w-full py-4 px-4 rounded-2xl font-bold flex flex-col items-center justify-center gap-2 transition-all border bg-gray-800 border-gray-700 hover:bg-gray-750 hover:border-gray-600 text-white shadow-lg active:scale-95"
                                >
                                    <FaShoppingBag size={24} className="text-emerald-400" />
                                    <span>איסוף עצמי</span>
                                </button>
                                {pickupTime && (
                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                        <span>⏱️ {pickupTime} דק'</span>
                                        {pickupNote && (
                                            <div className="relative group">
                                                <button
                                                    type="button"
                                                    className="w-4 h-4 rounded-full bg-amber-400 text-gray-900 text-[10px] font-bold flex items-center justify-center"
                                                    aria-label="מידע נוסף על זמן איסוף"
                                                >
                                                    !
                                                </button>
                                                <div className="absolute z-10 hidden group-hover:block group-focus-within:block top-6 right-0 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg max-w-xs whitespace-pre-wrap">
                                                    {pickupNote}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Live Links */}
                <div className="flex justify-center gap-8 mt-4 pt-6 border-t border-gray-800 w-full">
                    {wazeHref && (
                        <a href={wazeHref} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-2 text-gray-400 hover:text-white transition-colors group w-20">
                            <div className="p-4 bg-gray-800 rounded-2xl group-hover:bg-blue-500 group-hover:text-white transition-all shadow-md group-hover:shadow-blue-500/20">
                                <SiWaze size={28} />
                            </div>
                            <span className="text-sm font-medium">ניווט</span>
                        </a>
                    )}
                    {phoneHref && (
                        <a href={phoneHref} className="flex flex-col items-center gap-2 text-gray-400 hover:text-white transition-colors group w-20">
                            <div className="p-4 bg-gray-800 rounded-2xl group-hover:bg-green-500 group-hover:text-white transition-all shadow-md group-hover:shadow-green-500/20">
                                <FaPhoneAlt size={24} />
                            </div>
                            <span className="text-sm font-medium">חייג</span>
                        </a>
                    )}
                </div>

            </div>

            {/* Branding Footer */}
            <div className="mt-auto pt-6 relative z-10 text-center opacity-30 text-xs">
                TakeEat Powered
            </div>
        </div>
    );
}
