const env = import.meta.env ?? {};

export const API_BASE_URL = env.VITE_SOUNDCARE_API_BASE_URL || 'http://localhost:8080';
export const USE_MOCK_API = String(env.VITE_USE_MOCK_API ?? 'true').toLowerCase() === 'true';
export const TOKEN_STORAGE_KEY = 'soundcare.accessToken';

export const tokenStorage = {
  get() {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  },
  set(token) {
    // TODO: 운영 환경에서는 Tauri secure storage plugin 또는 OS keychain을 사용한다.
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  },
  clear() {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
};

export function isMockApiEnabled() {
  return USE_MOCK_API;
}

export async function request(path, options = {}) {
  if (USE_MOCK_API) {
    throw new Error(`Mock API mode is enabled. Skipped request: ${path}`);
  }

  const method = options.method ?? 'GET';
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {})
  };
  const token = tokenStorage.get();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`SoundCare API error ${response.status}: ${message}`);
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

export function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, value);
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}
