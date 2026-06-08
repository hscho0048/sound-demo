import { createHomeScene } from './homeSceneCore.js';

export function createDashboardHomeScene(container) {
  return createHomeScene(container, { mode: 'dashboard' });
}
