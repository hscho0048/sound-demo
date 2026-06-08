import { createInteractiveHomeScene } from '../three/interactiveHomeScene.js';

let sceneController = null;

const applianceCards = [
  { name: 'Robot vacuum', room: 'Kitchen', decibel: 50 },
  { name: 'Washing Machine', room: 'Laundry room', decibel: 73 },
  { name: 'Refrigerator', room: 'Kitchen', decibel: 42 },
  { name: 'AI home hub', room: 'Living room', decibel: 7 }
];

export async function renderThreeDHomePage() {
  return `
    <section class="page three-view-page" aria-label="3D Home View Screen">
      <header class="dashboard-household-header three-view-household-header">
        <h1 class="three-view-desktop-title">Household: Cho Home</h1>
        <div class="three-view-mobile-title">
          <h1>3D Home</h1>
          <p>Seocho Home · Laundry event</p>
        </div>
      </header>
      <p class="three-view-active-pill"><span></span>Active · 42 dB</p>

      <div class="three-view-content">
        <section class="three-view-stage" aria-label="3D home canvas">
          <h2>
            <span class="three-title-desktop">3D Home</span>
            <span class="three-title-mobile">Room map · active event</span>
          </h2>
          <p class="three-view-mobile-source">Noise source: Laundry Area</p>
          <div id="three-home-container" class="three-view-container" aria-label="Interactive 3D home"></div>
        </section>

        <aside class="appliance-noise-panel" aria-label="Appliance noise status">
          ${applianceCards
            .map(
              (item) => `
                <section class="appliance-noise-card">
                  <h2>${item.name}</h2>
                  <p>${item.room}</p>
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
