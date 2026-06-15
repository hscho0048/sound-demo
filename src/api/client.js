const env = import.meta.env ?? {};

export const API_BASE_URL = env.VITE_SOUNDCARE_API_BASE_URL || 'http://localhost:18080';
export const USE_MOCK_API = String(env.VITE_USE_MOCK_API ?? 'false').toLowerCase() === 'true';
export const USE_API_FALLBACK = String(env.VITE_USE_API_FALLBACK ?? 'false').toLowerCase() === 'true';
export const TOKEN_STORAGE_KEY = 'soundcare.accessToken';
// 설정 시 LoginPage가 실제 Google Identity Services 버튼을 렌더링한다.
export const GOOGLE_CLIENT_ID = env.VITE_GOOGLE_CLIENT_ID || '';
export const DEV_AUTH_PROFILE = {
  idToken: env.VITE_DEV_AUTH_ID_TOKEN || 'soundcare-tauri-local-dev',
  email: env.VITE_DEV_AUTH_EMAIL || 'tauri.local@soundcare.local',
  nickname: env.VITE_DEV_AUTH_NICKNAME || env.VITE_DEV_AUTH_DISPLAY_NAME || 'SoundCare Local Tester'
};

export const tokenStorage = {
  get() {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  },
  set(token) {
    // TODO: 운영 환경에서는 Tauri secure storage plugin 또는 OS keychain을 사용한다.
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  },
  clear() {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
};

export function isMockApiEnabled() {
  return USE_MOCK_API;
}

export function isApiFallbackEnabled() {
  return USE_API_FALLBACK;
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
    const json = await response.json();
    if (
      json
      && typeof json === 'object'
      && Object.prototype.hasOwnProperty.call(json, 'success')
      && Object.prototype.hasOwnProperty.call(json, 'data')
    ) {
      if (json.success === false) {
        throw new Error(json.message || 'SoundCare API request failed');
      }
      return json.data;
    }
    return json;
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
