import mockHomeStatus from '../data/mockHomeStatus.json';
import { request, isMockApiEnabled } from './client.js';

export async function getSensitiveAppliances() {
  if (isMockApiEnabled()) {
    return mockHomeStatus.sensitiveAppliances;
  }
  return request('/api/sensitive-appliances');
}

export async function saveSensitiveAppliances(settings) {
  if (isMockApiEnabled()) {
    window.localStorage.setItem('soundcare.sensitiveAppliances', JSON.stringify(settings));
    return { saved: true, settingsVersion: `local-${Date.now()}`, items: settings };
  }
  return request('/api/sensitive-appliances', {
    method: 'PATCH',
    body: { items: settings }
  });
}

export async function getControlPolicies() {
  if (isMockApiEnabled()) {
    return mockHomeStatus.sensitiveAppliances.map((item) => ({
      serviceLabel: item.serviceLabel,
      automaticResponseMode: item.automaticResponseMode,
      responseDbThreshold: item.responseDbThreshold
    }));
  }
  return request('/api/control-policies');
}

export async function updateControlPolicy(serviceLabel, policy) {
  if (isMockApiEnabled()) {
    return { serviceLabel, ...policy, saved: true };
  }
  return request(`/api/control-policies/${encodeURIComponent(serviceLabel)}`, {
    method: 'PATCH',
    body: policy
  });
}
