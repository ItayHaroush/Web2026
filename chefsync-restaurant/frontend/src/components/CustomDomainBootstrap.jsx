import { Navigate, useLocation } from 'react-router-dom';
import { useCustomDomainTenant } from '../hooks/useCustomDomainTenant';
import NotFoundPage from '../pages/NotFoundPage';

function BootstrapLoader() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-white" role="status" aria-live="polite">
            <div className="relative h-14 w-14">
                <div className="absolute inset-0 rounded-full border-4 border-brand-primary/15" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand-primary border-r-brand-primary animate-spin" />
            </div>
            <span className="sr-only">טוען...</span>
        </div>
    );
}

/**
 * Blocks rendering until custom domain host is resolved.
 * Unknown custom domain → 404 (no TakeEat fallback).
 */
export default function CustomDomainBootstrap({ children }) {
    const custom = useCustomDomainTenant();
    const location = useLocation();

    if (custom.status === 'loading') {
        return <BootstrapLoader />;
    }

    if (custom.status === 'not_found') {
        return <NotFoundPage variant="domain" host={custom.host} />;
    }

    if (custom.isCustomDomain && custom.tenantId && location.pathname === '/') {
        return <Navigate to={`/${custom.tenantId}/menu`} replace />;
    }

    if (custom.isCustomDomain) {
        const blocked = [
            '/landing',
            '/register-restaurant',
            '/restaurants',
            '/restaurants/new',
            '/about',
        ];
        if (blocked.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`))) {
            return <Navigate to={`/${custom.tenantId}/menu`} replace />;
        }
    }

    return children;
}
