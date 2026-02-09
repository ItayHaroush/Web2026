import { useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
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

export default function KioskViewer() {
    const { token } = useParams();
    const [searchParams] = useSearchParams();
    const tableNumber = searchParams.get('table') || null;
    const {
        loading, error, isIdle, setIsIdle,
        kiosk, restaurant, categories, items,
    } = useKioskData(token);

    const cart = useKioskCart();

    // Steps: welcome | order_type | menu | confirm
    const [step, setStep] = useState('welcome');
    const [orderType, setOrderType] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [showCart, setShowCart] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [confirmedOrder, setConfirmedOrder] = useState(null);

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
    const handleSubmitOrder = async (customerName) => {
        setSubmitting(true);
        try {
            const payload = cart.toOrderPayload(customerName, orderType, tableNumber);
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
                onCartClick={() => setShowCart(true)}
            />

            <KioskMenu
                categories={categories}
                items={items}
                onSelectItem={(item) => setSelectedItem(item)}
                orderType={orderType}
                enableDineInPricing={restaurant?.enable_dine_in_pricing}
            />

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
                />
            )}
        </div>
    );
}
