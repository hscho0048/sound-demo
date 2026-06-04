import mockHomeStatus from '../data/mockHomeStatus.json';
import { request, isMockApiEnabled } from './client.js';

export async function getRoutineRecommendations() {
  if (isMockApiEnabled()) {
    return mockHomeStatus.routineRecommendations;
  }
  return request('/api/routines/recommendations');
}

export async function generateRoutineRecommendations() {
  if (isMockApiEnabled()) {
    return { created: 1, items: mockHomeStatus.routineRecommendations };
  }
  return request('/api/routines/generate', { method: 'POST' });
}

export async function applyRoutine(routineId) {
  if (isMockApiEnabled()) {
    return { id: routineId, status: 'APPLIED' };
  }
  return request(`/api/routines/${encodeURIComponent(routineId)}/apply`, { method: 'PATCH' });
}

export async function dismissRoutine(routineId) {
  if (isMockApiEnabled()) {
    return { id: routineId, status: 'DISMISSED' };
  }
  return request(`/api/routines/${encodeURIComponent(routineId)}/dismiss`, { method: 'PATCH' });
}
