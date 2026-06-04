import mockHomeStatus from '../data/mockHomeStatus.json';
import { request, isMockApiEnabled, buildQuery } from './client.js';

export async function getCurrentHomeStatus() {
  if (isMockApiEnabled()) {
    return mockHomeStatus;
  }
  return request('/api/home/current-status');
}

export async function getNoiseEvents(params = {}) {
  if (isMockApiEnabled()) {
    return [
      {
        id: 'event-001',
        roomName: mockHomeStatus.roomName,
        serviceLabel: mockHomeStatus.currentServiceLabel,
        decibelMax: mockHomeStatus.decibelMax,
        confidence: mockHomeStatus.confidence,
        createdAt: mockHomeStatus.createdAt
      }
    ];
  }
  return request(`/api/iot/events${buildQuery(params)}`);
}

export async function getRobotAvoidanceEvents(params = {}) {
  if (isMockApiEnabled()) {
    return [mockHomeStatus.robotAvoidanceEvent];
  }
  return request(`/api/robot-avoidance-events${buildQuery(params)}`);
}
