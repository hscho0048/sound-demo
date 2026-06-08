import { createHomeScene } from './homeSceneCore.js';

export function createInteractiveHomeScene(container) {
  return createHomeScene(container, { mode: 'interactive' });
}
