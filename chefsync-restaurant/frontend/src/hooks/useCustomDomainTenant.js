import { useAuth } from '../context/AuthContext';

/**
 * Custom domain tenant state (resolved in AuthContext bootstrap).
 */
export function useCustomDomainTenant() {
    const {
        tenantId,
        isCustomDomain,
        customDomainError,
        customDomainResolved,
        customDomainHost,
    } = useAuth();

    let status = 'loading';
    if (customDomainResolved) {
        status = customDomainError ? 'not_found' : 'ready';
    }

    return {
        status,
        tenantId: isCustomDomain ? tenantId : null,
        isCustomDomain,
        host: customDomainHost,
        error: customDomainError,
    };
}
