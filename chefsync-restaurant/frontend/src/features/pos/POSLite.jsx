import { useState, useEffect, useCallback, useRef } from 'react';
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
import { sendRestaurantAdminPageView } from '../../services/analyticsBeacon';

function isAnyFullscreenActive() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
}

function enterPosFullscreen() {
    const el = document.documentElement;
    try {
        if (typeof el.requestFullscreen === 'function') {
            const p = el.requestFullscreen({ navigationUI: 'hide' });
            if (p && typeof p.catch === 'function') {
                p.catch(() => {
                    try {
                        el.webkitRequestFullscreen?.();
                    } catch {
                        /* ignore */
                    }
                });
            }
            return;
        }
    } catch {
        /* fall through */
    }
    try {
        el.webkitRequestFullscreen?.();
    } catch {
        /* ignore */
    }
    try {
        el.mozRequestFullScreen?.();
    } catch {
        /* ignore */
    }
}

function exitPosFullscreen() {
    try {
        if (document.fullscreenElement) document.exitFullscreen?.();
    } catch {
        /* ignore */
    }
    try {
        if (document.webkitFullscreenElement) document.webkitExitFullscreen?.();
    } catch {
        /* ignore */
    }
}

export default function POSLite() {
    const navigate = useNavigate();
    const { isManager: isManagerFn, getAuthHeaders } = useAdminAuth();
    const posAnalyticsSentRef = useRef(false);
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
    const [needFullscreenRestore, setNeedFullscreenRestore] = useState(false);

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

    const fetchPendingQueueCount = useCallback(async () => {
        if (!isAuthenticated || !headers) return;
        try {
            const res = await posApi.getPendingPaymentOrders(headers, posToken);
            if (res.data.success) {
                setPendingCount((res.data.orders || []).length);
            }
        } catch {
            /* ignore */
        }
    }, [isAuthenticated, headers, posToken]);

    // Poll pending payment + refund queue count
    useEffect(() => {
        if (!isAuthenticated) return;
        fetchPendingQueueCount();
        const interval = setInterval(fetchPendingQueueCount, 15000);
        return () => clearInterval(interval);
    }, [isAuthenticated, fetchPendingQueueCount]);

    // Fullscreen on enter (כולל Safari / webkit)
    useEffect(() => {
        if (isAuthenticated) {
            enterPosFullscreen();
        }
        return () => {
            exitPosFullscreen();
        };
    }, [isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated) return;
        const onLost = () => setNeedFullscreenRestore(true);
        window.addEventListener('takeeat:pos-fullscreen-lost', onLost);
        return () => window.removeEventListener('takeeat:pos-fullscreen-lost', onLost);
    }, [isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated) return;
        const onFs = () => {
            if (isAnyFullscreenActive()) setNeedFullscreenRestore(false);
        };
        document.addEventListener('fullscreenchange', onFs);
        document.addEventListener('webkitfullscreenchange', onFs);
        return () => {
            document.removeEventListener('fullscreenchange', onFs);
            document.removeEventListener('webkitfullscreenchange', onFs);
        };
    }, [isAuthenticated]);

    const handleExit = useCallback(() => {
        logout();
        exitPosFullscreen();
        navigate('/admin/dashboard');
    }, [logout, navigate]);

    const handleLock = useCallback(() => {
        lock();
    }, [lock]);

    useEffect(() => {
        if (!isAuthenticated || posAnalyticsSentRef.current) return;
        posAnalyticsSentRef.current = true;
        sendRestaurantAdminPageView('admin_pos', getAuthHeaders, {
            path: typeof window !== 'undefined' ? window.location.pathname : '/admin/pos',
        });
    }, [isAuthenticated, getAuthHeaders]);

    const handleShiftChange = useCallback((s) => {
        setShift(s);
    }, []);

    // סשן POS בוטל בשרת (מכשיר אחר, פג תוקף, נעילה) — חזרה למסך PIN
    useEffect(() => {
        const onSessionLost = () => logout();
        window.addEventListener('takeeat:pos-session-lost', onSessionLost);
        return () => window.removeEventListener('takeeat:pos-session-lost', onSessionLost);
    }, [logout]);

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
                headers={headers}
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
                        fetchPendingQueueCount();
                    }}
                />
            )}

            {needFullscreenRestore && (
                <button
                    type="button"
                    className="fixed inset-0 z-[5000] flex flex-col items-center justify-center gap-3 bg-black/90 text-white px-8 cursor-pointer border-0 font-black"
                    onClick={() => {
                        enterPosFullscreen();
                        setNeedFullscreenRestore(false);
                    }}
                >
                    <span className="text-xl sm:text-2xl text-center">הקשו כאן לחזרה למסך מלא</span>
                    <span className="text-sm font-medium text-slate-400 text-center max-w-sm">
                        הדפדפן יוצא ממסך מלא בעת הדפסה; אם לא חזר אוטומטית — לחיצה אחת מחזירה לקופה.
                    </span>
                </button>
            )}
        </div>
    );
}
