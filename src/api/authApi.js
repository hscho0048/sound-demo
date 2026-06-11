import { DEV_AUTH_PROFILE, request, tokenStorage, isMockApiEnabled } from './client.js';
import { DEMO_AUTH_TOKEN, defaultAuthUser, withApiFallback } from './fallbacks.js';

export async function loginWithGoogle(idToken, profile = {}) {
  const authProfile = {
    ...DEV_AUTH_PROFILE,
    ...profile,
    idToken: idToken || profile.idToken || DEV_AUTH_PROFILE.idToken
  };

  if (isMockApiEnabled()) {
    const token = DEMO_AUTH_TOKEN;
    tokenStorage.set(token);
    return {
      accessToken: token,
      user: defaultAuthUser(authProfile)
    };
  }

  const result = await request('/api/auth/google', {
    method: 'POST',
    body: authProfile
  }).catch((error) => withApiFallback(error, () => ({
    accessToken: DEMO_AUTH_TOKEN,
    user: defaultAuthUser(authProfile)
  }), 'Google login'));

  if (result?.accessToken) {
    tokenStorage.set(result.accessToken);
  }
  return result;
}

export function loginWithLocalDev() {
  // 테스트용: 백엔드 없이 데모 토큰으로 즉시 로그인
  const token = DEMO_AUTH_TOKEN;
  tokenStorage.set(token);
  return Promise.resolve({
    accessToken: token,
    user: defaultAuthUser(DEV_AUTH_PROFILE)
  });
}

export async function getMe() {
  if (isMockApiEnabled()) {
    return defaultAuthUser(DEV_AUTH_PROFILE);
  }
  return request('/api/auth/me')
    .catch((error) => withApiFallback(error, () => defaultAuthUser(DEV_AUTH_PROFILE), 'current user'));
}

export function logout() {
  tokenStorage.clear();
}
