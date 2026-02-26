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
import useBrowserPrint from './hooks/useBrowserPrint';

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
    } = usePosSession();

    const [activeTab, setActiveTab] = useState('orders');
    const [shift, setShift] = useState(null);

    useBrowserPrint(headers, posToken, isAuthenticated);

    const isBasicTier = subscriptionInfo?.tier === 'basic';

    // Fullscreen on enter
    useEffect(() => {
        if (isAuthenticated) {
            try {
                document.documentElement.requestFullscreen?.();
            } catch {}
        }
        return () => {
            try {
                if (document.fullscreenElement) document.exitFullscreen?.();
            } catch {}
        };
    }, [isAuthenticated]);

    const handleExit = useCallback(() => {
        logout();
        try {
            if (document.fullscreenElement) document.exitFullscreen?.();
        } catch {}
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
        </div>
    );
}
