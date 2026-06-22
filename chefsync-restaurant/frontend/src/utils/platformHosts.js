/**
 * Platform hosts — custom domains resolve via /api/public/resolve-host.
 * Includes *.takeeat.co.il / *.chefsync.co.il (subdomains blocked as custom domains).
 */

const DEFAULT_PLATFORM_HOSTS = [
    'localhost',
    '127.0.0.1',
    'takeeat.co.il',
    'www.takeeat.co.il',
    'chefsync.co.il',
    'www.chefsync.co.il',
    'appointed.cloud',
    'www.appointed.cloud',
    'buildix.site',
    'www.buildix.site',
];

const DEFAULT_PLATFORM_ROOTS = [
    'takeeat.co.il',
    'chefsync.co.il',
    'appointed.cloud',
    'buildix.site',
];

function parseEnvList(value) {
    if (!value || typeof value !== 'string') return [];
    return value.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
}

export function getPlatformHosts() {
    const fromEnv = parseEnvList(import.meta.env.VITE_PLATFORM_HOSTS);
    const roots = parseEnvList(import.meta.env.VITE_PLATFORM_ROOT_DOMAINS);
    const hosts = fromEnv.length > 0 ? fromEnv : DEFAULT_PLATFORM_HOSTS;
    const rootDomains = roots.length > 0 ? roots : DEFAULT_PLATFORM_ROOTS;
    return { hosts, rootDomains };
}

export function normalizeHostname(hostname) {
    return String(hostname || '').toLowerCase().trim().replace(/:\d+$/, '');
}

export function isPlatformHost(hostname) {
    const host = normalizeHostname(hostname);
    if (!host) return true;

    const { hosts, rootDomains } = getPlatformHosts();

    if (hosts.includes(host)) {
        return true;
    }

    for (const root of rootDomains) {
        if (host === root || host.endsWith(`.${root}`)) {
            return true;
        }
    }

    return false;
}
