import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useRestaurantStatus } from '../../context/RestaurantStatusContext';
import ProFeatureGate from '../../components/ProFeatureGate';
import usePosSession from './hooks/usePosSession';
import POSPinLock from './components/POSPinLock';
import POSHeader from './components/POSHeader';
import POSTabBar from './components/POSTabBar';
import POSOrderPanel from './components/POSOrderPanel';
import POSNewOrder from './components/POSNewOrder';
import POSCashRegister from './components/POSCashRegister';
import POSTablesView from './components/POSTablesView';
import POSPendingPaymentModal from './components/POSPendingPaymentModal';
import useBrowserPrint from './hooks/useBrowserPrint';
import posApi from './api/posApi';

export default function POSLite() {
    const navigate = useNavigate();
    const { isManager: isManagerFn } = useAdminAuth();
    const { subscriptionInfo } = useRestaurantStatus();
    const isManager = isManagerFn();
    const {
        posToken,
        posUser,
        isLocked,
        isAuthenticated,
        login,
        lock,
        unlock,
        logout,
        headers,
        hasBypass,
    } = usePosSession();

    const [activeTab, setActiveTab] = useState('orders');
    const [shift, setShift] = useState(null);
    const [showPendingModal, setShowPendingModal] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);

    useBrowserPrint(headers, posToken, isAuthenticated);

    const isBasicTier = subscriptionInfo?.tier === 'basic';

    // Fetch current shift on load
    useEffect(() => {
        if (!isAuthenticated) return;
        const fetchShift = async () => {
            try {
                const res = await posApi.currentShift(headers, posToken);
                if (res.data.success && res.data.shift) {
                    setShift(res.data.shift);
                }
            } catch { }
        };
        fetchShift();
    }, [isAuthenticated, headers, posToken]);

    // Poll pending payment count
    useEffect(() => {
        if (!isAuthenticated) return;
        const fetchCount = async () => {
            try {
                const res = await posApi.getPendingPaymentOrders(headers, posToken);
                if (res.data.success) {
                    setPendingCount((res.data.orders || []).length);
                }
            } catch { }
        };
        fetchCount();
        const interval = setInterval(fetchCount, 15000);
        return () => clearInterval(interval);
    }, [isAuthenticated, headers, posToken]);

    // Fullscreen on enter
    useEffect(() => {
        if (isAuthenticated) {
            try {
                document.documentElement.requestFullscreen?.();
            } catch { }
        }
        return () => {
            try {
                if (document.fullscreenElement) document.exitFullscreen?.();
            } catch { }
        };
    }, [isAuthenticated]);

    const handleExit = useCallback(() => {
        logout();
        try {
            if (document.fullscreenElement) document.exitFullscreen?.();
        } catch { }
        navigate('/admin/dashboard');
    }, [logout, navigate]);

    const handleLock = useCallback(() => {
        lock();
    }, [lock]);

    const handleShiftChange = useCallback((s) => {
        setShift(s);
    }, []);

    if (isBasicTier) {
        return <ProFeatureGate featureName="קופה POS" />;
    }

    if (!isAuthenticated) {
        // If bypass is active, show loading while auto-login runs
        if (hasBypass && !isLocked) {
            return (
                <div className="fixed inset-0 bg-[#0f172a] flex items-center justify-center z-[500]">
                    <div className="text-center space-y-4">
                        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-orange-500 mx-auto" />
                        <p className="text-white text-xl font-black">מתחבר...</p>
                    </div>
                </div>
            );
        }
        return (
            <POSPinLock
                onUnlock={isLocked ? unlock : login}
                isRelock={isLocked}
            />
        );
    }

    return (
        <div className="fixed inset-0 bg-[#0f172a] text-white flex flex-col z-[100]" dir="rtl">
            <POSHeader
                posUser={posUser}
                shift={shift}
                onLock={handleLock}
                onExit={handleExit}
                headers={headers}
                posToken={posToken}
                pendingCount={pendingCount}
                onPendingClick={() => setShowPendingModal(true)}
            />

            <main className="flex-1 min-h-0 overflow-hidden">
                {activeTab === 'orders' && (
                    <POSOrderPanel headers={headers} posToken={posToken} />
                )}
                {activeTab === 'new-order' && (
                    <POSNewOrder
                        headers={headers}
                        posToken={posToken}
                        onOrderCreated={() => setActiveTab('orders')}
                        shift={shift}
                    />
                )}
                {activeTab === 'tables' && (
                    <POSTablesView
                        headers={headers}
                        posToken={posToken}
                        shift={shift}
                    />
                )}
                {activeTab === 'cash-register' && (
                    <POSCashRegister
                        headers={headers}
                        posToken={posToken}
                        isManager={isManager}
                        onShiftChange={handleShiftChange}
                    />
                )}
                {activeTab === 'history' && (
                    <POSOrderPanel headers={headers} posToken={posToken} mode="history" />
                )}
            </main>

            <POSTabBar
                activeTab={activeTab}
                onTabChange={setActiveTab}
                isManager={isManager}
            />

            {showPendingModal && (
                <POSPendingPaymentModal
                    headers={headers}
                    posToken={posToken}
                    onClose={() => setShowPendingModal(false)}
                    onPaid={() => {
                        setPendingCount(prev => Math.max(0, prev - 1));
                    }}
                />
            )}
        </div>
    );
}
