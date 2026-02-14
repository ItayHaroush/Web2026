import { useState, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { FaTimes, FaPlus } from 'react-icons/fa';
import useKioskData from '../components/kiosk/viewer/useKioskData';
import useKioskCart from '../components/kiosk/viewer/useKioskCart';
import KioskWelcome from '../components/kiosk/viewer/KioskWelcome';
import KioskHeader from '../components/kiosk/viewer/KioskHeader';
import KioskMenu from '../components/kiosk/viewer/KioskMenu';
import KioskItemDetail from '../components/kiosk/viewer/KioskItemDetail';
import KioskCart from '../components/kiosk/viewer/KioskCart';
import KioskOrderConfirm from '../components/kiosk/viewer/KioskOrderConfirm';
import KioskOrderType from '../components/kiosk/viewer/KioskOrderType';
import { placeKioskOrder } from '../services/kioskService';
import { getSuggestions } from '../components/SuggestionCards';

export default function KioskViewer() {
    const { token } = useParams();
    const [searchParams] = useSearchParams();
    const tableNumber = searchParams.get('table') || null;
    const {
        loading, error, isIdle, setIsIdle,
        kiosk, restaurant, categories, items, promotions,
    } = useKioskData(token);

    const cart = useKioskCart();

    // Build categories with items for suggestion logic
    const categoriesWithItems = useMemo(() => {
        return categories.map(cat => ({
            ...cat,
            items: items.filter(item => item.category_id === cat.id),
        }));
    }, [categories, items]);

    // Cart items mapped with categoryId for suggestions
    const cartItemsForSuggestions = useMemo(() => {
        return cart.items.map(item => ({
            ...item,
            categoryId: items.find(i => i.id === item.menuItemId)?.category_id,
        }));
    }, [cart.items, items]);

    const kioskSuggestions = useMemo(() => {
        if (categoriesWithItems.length === 0 || cart.items.length === 0) return [];
        return getSuggestions(categoriesWithItems, cartItemsForSuggestions);
    }, [categoriesWithItems, cartItemsForSuggestions, cart.items.length]);

    // Steps: welcome | order_type | menu | confirm
    const [step, setStep] = useState('welcome');
    const [orderType, setOrderType] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [showCart, setShowCart] = useState(false);
    const [showSuggestionModal, setShowSuggestionModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [confirmedOrder, setConfirmedOrder] = useState(null);
    const [promoCategoryModal, setPromoCategoryModal] = useState(null); // { categoryId, categoryName }

    // Pre-cart suggestion: intercept cart click
    const handleCartClick = () => {
        if (kioskSuggestions.length > 0) {
            setShowSuggestionModal(true);
        } else {
            setShowCart(true);
        }
    };

    const handleSuggestionQuickAdd = (item) => {
        cart.addItem(item, null, [], 1, 0);
    };

    const goToCart = () => {
        setShowSuggestionModal(false);
        setShowCart(true);
    };

    // Reset everything back to welcome
    const resetAll = useCallback(() => {
        cart.clearCart();
        setStep('welcome');
        setOrderType(null);
        setSelectedItem(null);
        setShowCart(false);
        setSubmitting(false);
        setConfirmedOrder(null);
        setIsIdle(false);
    }, [cart, setIsIdle]);

    // When idle, go back to welcome
    if (isIdle && step !== 'welcome' && step !== 'confirm') {
        resetAll();
    }

    // Submit order
    const handleSubmitOrder = async (customerName, paymentMethod) => {
        setSubmitting(true);
        try {
            const payload = cart.toOrderPayload(customerName, orderType, tableNumber, paymentMethod);
            const result = await placeKioskOrder(token, payload);
            if (result.success) {
                setShowCart(false);
                setConfirmedOrder({
                    orderId: result.data.order_id,
                    totalAmount: cart.totalPrice,
                });
                cart.clearCart();
                setStep('confirm');
            } else {
                alert(result.message || 'שגיאה בשליחת ההזמנה');
            }
        } catch (err) {
            alert('שגיאה בשליחת ההזמנה');
        } finally {
            setSubmitting(false);
        }
    };

    // Error state
    if (error && !kiosk) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center" dir="rtl">
                <div className="text-center">
                    <div className="text-6xl mb-6">📱</div>
                    <h1 className="text-3xl font-black text-white mb-3">קיוסק לא נמצא</h1>
                    <p className="text-gray-400 text-lg">הקישור אינו תקין או שהקיוסק הושבת</p>
                </div>
            </div>
        );
    }

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white"></div>
            </div>
        );
    }

    // Confirmation screen
    if (step === 'confirm' && confirmedOrder) {
        return (
            <div dir="rtl">
                <KioskOrderConfirm
                    orderId={confirmedOrder.orderId}
                    totalAmount={confirmedOrder.totalAmount}
                    onReset={resetAll}
                />
            </div>
        );
    }

    // Welcome screen
    if (step === 'welcome') {
        return (
            <div dir="rtl">
                <KioskWelcome
                    restaurant={restaurant}
                    tableNumber={tableNumber}
                    onStart={() => setStep('order_type')}
                />
            </div>
        );
    }

    // Order type selection
    if (step === 'order_type') {
        return (
            <div dir="rtl">
                <KioskOrderType
                    onSelect={(type) => {
                        setOrderType(type);
                        setStep('menu');
                    }}
                />
            </div>
        );
    }

    // Menu screen (step === 'menu')
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col" dir="rtl">
            <KioskHeader
                restaurant={restaurant}
                totalItems={cart.totalItems}
                totalPrice={cart.totalPrice}
                onCartClick={handleCartClick}
            />

            <KioskMenu
                categories={categories}
                items={items}
                onSelectItem={(item) => setSelectedItem(item)}
                orderType={orderType}
                enableDineInPricing={restaurant?.enable_dine_in_pricing}
                promotions={promotions}
                onPromotionClick={(categoryId, categoryName) => setPromoCategoryModal({ categoryId, categoryName })}
            />

            {/* Promotion Category Items Modal */}
            {promoCategoryModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-3xl rounded-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 shrink-0">
                            <h2 className="text-lg sm:text-xl font-black text-gray-900">{promoCategoryModal.categoryName}</h2>
                            <button
                                onClick={() => setPromoCategoryModal(null)}
                                className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                            >
                                <FaTimes size={18} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {items
                                    .filter(item => item.category_id === promoCategoryModal.categoryId)
                                    .map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => {
                                                setPromoCategoryModal(null);
                                                setSelectedItem(item);
                                            }}
                                            className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-lg hover:border-amber-200 active:scale-[0.98] transition-all text-right"
                                        >
                                            {item.image_url ? (
                                                <img src={item.image_url} alt={item.name} className="w-full h-28 object-cover" />
                                            ) : (
                                                <div className="w-full h-28 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                                                    <span className="text-3xl">🍽️</span>
                                                </div>
                                            )}
                                            <div className="p-3">
                                                <h3 className="font-black text-gray-900 text-sm truncate">{item.name}</h3>
                                                <div className="mt-1 font-black text-amber-600 text-base">
                                                    {item.price?.toFixed(2)} ₪
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                            </div>
                            {items.filter(item => item.category_id === promoCategoryModal.categoryId).length === 0 && (
                                <div className="text-center py-12 text-gray-400 font-bold">אין פריטים בקטגוריה זו</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Item Detail Modal */}
            {selectedItem && (
                <KioskItemDetail
                    item={selectedItem}
                    onAddToCart={cart.addItem}
                    onClose={() => setSelectedItem(null)}
                    orderType={orderType}
                    enableDineInPricing={restaurant?.enable_dine_in_pricing}
                />
            )}

            {/* Cart Modal */}
            {showCart && (
                <KioskCart
                    items={cart.items}
                    totalPrice={cart.totalPrice}
                    requireName={kiosk?.require_name || false}
                    onUpdateQty={cart.updateQty}
                    onRemove={cart.removeItem}
                    onSubmit={handleSubmitOrder}
                    onClose={() => setShowCart(false)}
                    submitting={submitting}
                    acceptedPaymentMethods={restaurant?.accepted_payment_methods || ['cash']}
                />
            )}

            {/* Pre-cart Suggestion Modal */}
            {showSuggestionModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-2xl rounded-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
                            <h2 className="text-xl font-black text-gray-900">רגע לפני שממשיכים...</h2>
                            <button
                                onClick={goToCart}
                                className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                            >
                                <FaTimes size={18} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {kioskSuggestions.map((suggestion) => {
                                const Icon = suggestion.icon;
                                return (
                                    <div key={suggestion.type} className="bg-gradient-to-l from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="bg-blue-100 p-2 rounded-xl">
                                                <Icon className="text-blue-600" size={18} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-800 text-base">{suggestion.title}</p>
                                                <p className="text-sm text-gray-500">{suggestion.subtitle}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                                            {suggestion.items.map((item) => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => {
                                                        if (item.variants?.length > 0 || item.addon_groups?.length > 0) {
                                                            setShowSuggestionModal(false);
                                                            setSelectedItem(item);
                                                        } else {
                                                            handleSuggestionQuickAdd(item);
                                                        }
                                                    }}
                                                    className="flex-shrink-0 w-28 bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md active:scale-95 transition-all text-right"
                                                >
                                                    {item.image_url && (
                                                        <div className="h-20 bg-gray-50 overflow-hidden">
                                                            <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                                                        </div>
                                                    )}
                                                    <div className="p-2">
                                                        <p className="text-xs font-bold text-gray-800 truncate">{item.name}</p>
                                                        <div className="flex items-center justify-between mt-1">
                                                            <span className="text-xs text-amber-600 font-bold">{item.price} ₪</span>
                                                            <span className="bg-amber-500 text-white w-5 h-5 rounded-full flex items-center justify-center">
                                                                <FaPlus size={8} />
                                                            </span>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="p-4 border-t border-gray-100 shrink-0">
                            <button
                                onClick={goToCart}
                                className="w-full bg-green-500 hover:bg-green-400 text-white font-black text-lg py-4 rounded-2xl shadow-xl shadow-green-500/20 active:scale-95 transition-all"
                            >
                                המשך לסל
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
