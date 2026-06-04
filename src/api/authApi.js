import { request, tokenStorage, isMockApiEnabled } from './client.js';

export async function loginWithGoogle(idToken) {
  if (isMockApiEnabled()) {
    const token = 'dev-placeholder-jwt-token';
    tokenStorage.set(token);
    return {
      accessToken: token,
      user: {
        id: 'user-demo-001',
        email: 'demo@soundcare.local',
        displayName: 'SoundCare 데모 사용자',
        roles: ['USER']
      }
    };
  }
  const result = await request('/api/auth/google', {
    method: 'POST',
    body: { idToken }
  });
  if (result?.accessToken) {
    tokenStorage.set(result.accessToken);
  }
  return result;
}

export async function getMe() {
  if (isMockApiEnabled()) {
    return {
      id: 'user-demo-001',
      email: 'demo@soundcare.local',
      displayName: 'SoundCare 데모 사용자',
      roles: ['USER']
    };
  }
  return request('/api/me');
}

export function logout() {
  tokenStorage.clear();
}
