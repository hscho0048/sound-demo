import { createInteractiveHomeScene } from '../three/interactiveHomeScene.js';

let sceneController = null;

const applianceCards = [
  { name: '세탁기', decibel: 62 },
  { name: '냉장고', decibel: 62 },
  { name: '로봇청소기', decibel: 62 }
];

export async function renderThreeDHomePage() {
  return `
    <section class="page three-view-page" aria-label="3D Home View Screen">
      <header class="dashboard-household-header three-view-household-header">
        <h1>Household: Cho Home</h1>
      </header>

      <div class="three-view-content">
        <section class="three-view-stage" aria-label="3D home canvas">
          <h2>3D Home</h2>
          <div id="three-home-container" class="three-view-container" aria-label="Interactive 3D home"></div>
        </section>

        <aside class="appliance-noise-panel" aria-label="Appliance noise status">
          ${applianceCards
            .map(
              (item) => `
                <section class="appliance-noise-card">
                  <h2>${item.name}</h2>
                  <div class="appliance-noise-card__body">
                    <div class="appliance-picture-slot" aria-label="${item.name} picture placeholder"></div>
                    <strong>${item.decibel} dB</strong>
                  </div>
                </section>
              `
            )
            .join('')}
        </aside>
      </div>
    </section>
  `;
}

export function mountThreeDHomePage() {
  const container = document.querySelector('#three-home-container');
  if (!container) return;

  cleanupThreeDHomePage();
  sceneController = createInteractiveHomeScene(container);
}

export function cleanupThreeDHomePage() {
  sceneController?.dispose?.();
  sceneController = null;
}
