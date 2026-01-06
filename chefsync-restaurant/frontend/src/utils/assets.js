// Helper to resolve backend origin and asset URLs (logo images)

const getApiBaseUrl = () => {
  // Prefer value saved by apiClient (reflects failover choice)
  const saved = localStorage.getItem('api_base_url');
  if (saved && typeof saved === 'string') return saved;

  // Fallback to envs
  const localEnv = (import.meta.env.VITE_API_URL_LOCAL || 'http://localhost:8000/api').trim();
  const prodEnv = (import.meta.env.VITE_API_URL_PRODUCTION || 'https://api.chefsync.co.il/api').trim();

  // If running in dev, default local; otherwise prod
  return import.meta.env.DEV ? localEnv : prodEnv;
};

export const getBackendOrigin = () => {
  const base = getApiBaseUrl();
  return base.replace(/\/api$/i, '');
};

export const resolveAssetUrl = (path) => {
  if (!path) return '';
  // If already absolute URL
  if (/^https?:\/\//i.test(path)) return path;
  const origin = getBackendOrigin();
  // Ensure leading slash
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${normalized}`;
};
